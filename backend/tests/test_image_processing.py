import os
import io
import pytest
import pytest_asyncio
import httpx
import numpy as np
import cv2
from PIL import Image
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.database.base import Base
from app.database.session import get_db
from app.database.init_db import init_db
from app.core.config import settings
from app.image_processing.pipeline import ImagePreprocessor

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="function")
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        await init_db(session)
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


def create_synthetic_image_bytes(width: int = 400, height: int = 300, format: str = "JPEG") -> bytes:
    """Generates a valid binary image in memory with simulated packaging label text."""
    # Create white canvas
    img = np.full((height, width, 3), 255, dtype=np.uint8)
    
    # Draw simulated label text lines
    cv2.putText(img, "NET QUANTITY: 500 g", (30, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(img, "MRP Rs. 120.00 INCL TAXES", (30, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(img, "MFD: 10/2026", (30, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(img, "MANUFACTURED BY ABC FOODS", (30, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    pil_img.save(buf, format=format)
    return buf.getvalue()


def test_cv_preprocessor_direct(tmp_path):
    """Verifies that the ImagePreprocessor executes all CV steps without errors."""
    preprocessor = ImagePreprocessor(max_dimension=1000)

    # 1. Create a large test image (2400 x 1600)
    input_path = str(tmp_path / "test_raw.jpg")
    output_path = str(tmp_path / "test_preprocessed.jpg")
    
    raw_bytes = create_synthetic_image_bytes(width=2400, height=1600)
    with open(input_path, "wb") as f:
        f.write(raw_bytes)

    # 2. Process image
    result = preprocessor.process(input_path, output_path)

    # 3. Assertions
    assert os.path.exists(output_path)
    assert result.original_width == 2400
    assert result.original_height == 1600
    # Clamped dimension must not exceed max_dimension (1000)
    assert result.processed_width == 1000
    assert result.processed_height == int(1600 * (1000 / 2400))
    assert result.processing_time_ms > 0.0


@pytest.mark.asyncio
async def test_upload_spoofed_file_rejected(client: httpx.AsyncClient):
    """Ensures that files with spoofed extensions but invalid magic bytes are rejected."""
    # Login as admin to get auth header
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": settings.FIRST_SUPERUSER_EMAIL, "password": settings.FIRST_SUPERUSER_PASSWORD},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Upload fake image: a text file disguised as .jpg
    fake_payload = b"THIS IS NOT A REAL JPEG IMAGE FILE CONTENT"
    files = [("files", ("malicious.jpg", fake_payload, "image/jpeg"))]

    response = await client.post(
        "/api/v1/inspections/upload",
        headers=headers,
        files=files,
    )
    assert response.status_code == 400
    assert "Invalid file content signature" in response.json()["detail"]


@pytest.mark.asyncio
async def test_multi_panel_image_upload_and_pipeline(client: httpx.AsyncClient, tmp_path):
    """Tests multi-panel upload (Front & Back faces), database persistence, and inspection retrieval."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": settings.FIRST_SUPERUSER_EMAIL, "password": settings.FIRST_SUPERUSER_PASSWORD},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create front and back label images
    front_bytes = create_synthetic_image_bytes(width=600, height=400)
    back_bytes = create_synthetic_image_bytes(width=600, height=800)

    files = [
        ("files", ("front_panel.jpg", front_bytes, "image/jpeg")),
        ("files", ("back_panel.png", back_bytes, "image/png")),
    ]
    data = {
        "panels": '["FRONT", "BACK"]',
        "notes": "Routine market surveillance sample"
    }

    # 1. Trigger upload
    upload_res = await client.post(
        "/api/v1/inspections/upload",
        headers=headers,
        files=files,
        data=data
    )
    assert upload_res.status_code == 201
    inspection_data = upload_res.json()

    assert inspection_data["status"] == "PROCESSING"
    assert inspection_data["inspection_number"].startswith("INS-")
    assert len(inspection_data["images"]) == 2

    # Check panel mappings
    panels = [img["panel_type"] for img in inspection_data["images"]]
    assert "FRONT" in panels
    assert "BACK" in panels

    # Verify both preprocessed file paths are set and files exist
    for img_record in inspection_data["images"]:
        assert img_record["preprocessed_file_path"] is not None
        assert os.path.exists(img_record["preprocessed_file_path"])
        assert img_record["width_px"] > 0
        assert img_record["height_px"] > 0

    inspection_id = inspection_data["id"]

    # 2. Retrieve inspection by ID
    get_res = await client.get(
        f"/api/v1/inspections/{inspection_id}",
        headers=headers
    )
    assert get_res.status_code == 200
    retrieved = get_res.json()
    assert retrieved["id"] == inspection_id
    assert len(retrieved["images"]) == 2

    # 3. List inspections
    list_res = await client.get("/api/v1/inspections/", headers=headers)
    assert list_res.status_code == 200
    inspections_list = list_res.json()
    assert len(inspections_list) >= 1
    assert any(i["id"] == inspection_id for i in inspections_list)
