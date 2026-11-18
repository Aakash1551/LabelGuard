"""
Phase 4 Tests: OCR Engine & Text Tokenization

Tests:
1. Direct OCR on a synthetic label image (unit test).
2. Full upload → preprocess → OCR → token retrieval pipeline (integration test).
3. OCR on a blank/empty image returns zero tokens gracefully (edge case).
"""
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
from app.ocr.engine import OCREngine, OCRResult

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


def create_label_image_bytes(
    width: int = 800,
    height: int = 600,
    texts: list = None,
    format: str = "JPEG"
) -> bytes:
    """
    Creates a synthetic packaged commodity label image with realistic text.
    Uses thick, clear fonts to ensure PaddleOCR can reliably detect them.
    """
    img = np.full((height, width, 3), 245, dtype=np.uint8)  # Light gray background

    if texts is None:
        texts = [
            ("NET WT 500 g", (40, 70), 1.0),
            ("MRP Rs. 120.00 Incl. of all taxes", (40, 140), 0.8),
            ("Mfg Date: 10/2026", (40, 210), 0.8),
            ("Manufactured by: ABC Foods Pvt Ltd", (40, 280), 0.7),
            ("New Delhi, India 110001", (40, 340), 0.7),
            ("Customer Care: 1800-123-4567", (40, 410), 0.7),
        ]

    for text, pos, scale in texts:
        cv2.putText(
            img, text, pos,
            cv2.FONT_HERSHEY_SIMPLEX, scale,
            (10, 10, 10),  # Near-black text
            2, cv2.LINE_AA
        )

    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    pil_img.save(buf, format=format, quality=95)
    return buf.getvalue()


def test_ocr_engine_direct_extraction(tmp_path):
    """
    Unit test: Runs PaddleOCR directly on a synthetic label image and
    verifies that text tokens are extracted with spatial metadata.
    """
    engine = OCREngine(confidence_threshold=0.25)

    # Create a test label with clear text
    img_bytes = create_label_image_bytes(width=800, height=600)
    img_path = str(tmp_path / "test_label.jpg")
    with open(img_path, "wb") as f:
        f.write(img_bytes)

    result = engine.extract_text(img_path)

    # Assertions
    assert isinstance(result, OCRResult)
    assert result.image_width == 800
    assert result.image_height == 600
    assert result.total_tokens > 0, "OCR should detect at least one text region"
    assert result.avg_confidence > 0.0

    # Check that tokens have proper structure
    for token in result.tokens:
        assert len(token.text) > 0
        assert 0.0 <= token.confidence <= 1.0
        assert len(token.polygon_bbox) == 4, "Bounding box must have 4 corner points"
        assert len(token.normalized_bbox) == 4

        # Normalized coordinates must be in [0.0, 1.0] range
        for point in token.normalized_bbox:
            assert 0.0 <= point[0] <= 1.0, f"Normalized x={point[0]} out of [0,1]"
            assert 0.0 <= point[1] <= 1.0, f"Normalized y={point[1]} out of [0,1]"

        # Line indices must be non-negative and monotonically assignable
        assert token.line_index >= 0

    # Verify reading order: line indices should be non-decreasing
    line_indices = [t.line_index for t in result.tokens]
    assert line_indices == sorted(line_indices), "Tokens must be in reading order"


def test_ocr_engine_blank_image(tmp_path):
    """
    Edge case: A completely blank white image should return zero tokens, not crash.
    """
    engine = OCREngine()

    # Create a pure white image (no text at all)
    img = np.full((400, 600, 3), 255, dtype=np.uint8)
    img_path = str(tmp_path / "blank.jpg")
    cv2.imwrite(img_path, img)

    result = engine.extract_text(img_path)

    assert isinstance(result, OCRResult)
    assert result.total_tokens == 0
    assert result.avg_confidence == 0.0
    assert len(result.tokens) == 0


def test_ocr_engine_missing_file():
    """OCR on a non-existent file should raise FileNotFoundError."""
    engine = OCREngine()
    with pytest.raises(FileNotFoundError):
        engine.extract_text("/nonexistent/path/to/image.jpg")


# ── Integration Tests ──

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


@pytest.mark.asyncio
async def test_upload_triggers_ocr_and_stores_tokens(client: httpx.AsyncClient):
    """
    Integration test: Upload a synthetic label → pipeline runs CV preprocessing
    → PaddleOCR extracts text → OCRToken records are persisted → API returns them.
    """
    # Login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": settings.FIRST_SUPERUSER_EMAIL, "password": settings.FIRST_SUPERUSER_PASSWORD},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create a synthetic label with clear text
    label_bytes = create_label_image_bytes(width=800, height=600)
    files = [("files", ("front_label.jpg", label_bytes, "image/jpeg"))]
    data = {"panels": '["FRONT"]', "notes": "OCR integration test"}

    # Upload
    upload_res = await client.post(
        "/api/v1/inspections/upload",
        headers=headers,
        files=files,
        data=data,
    )
    assert upload_res.status_code == 201
    inspection = upload_res.json()

    assert inspection["status"] == "PROCESSING"
    assert len(inspection["images"]) == 1

    # The image should now have OCR tokens attached
    image_data = inspection["images"][0]
    ocr_tokens = image_data.get("ocr_tokens", [])

    assert len(ocr_tokens) > 0, "OCR should have produced tokens for synthetic label text"

    # Verify token structure
    for tok in ocr_tokens:
        assert "detected_text" in tok
        assert "confidence" in tok
        assert "polygon_bbox" in tok
        assert "line_index" in tok
        assert len(tok["detected_text"]) > 0
        assert tok["confidence"] > 0.0

    # Retrieve inspection detail and confirm tokens persist
    detail_res = await client.get(
        f"/api/v1/inspections/{inspection['id']}",
        headers=headers,
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    detail_tokens = detail["images"][0]["ocr_tokens"]
    assert len(detail_tokens) == len(ocr_tokens)
