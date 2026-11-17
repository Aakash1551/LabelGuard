import pytest
import pytest_asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.database.base import Base
from app.database.session import get_db
from app.database.init_db import init_db
from app.core.config import settings

# In-memory SQLite async engine for tests
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="function")
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        # Seed admin and rules into test database
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
async def test_health_check(client: httpx.AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["database"] == "healthy"
    assert data["app_name"] == "LabelGuard AI"


@pytest.mark.asyncio
async def test_admin_login(client: httpx.AsyncClient):
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": settings.FIRST_SUPERUSER_EMAIL,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" == "access_token" in data
    assert data["role"] == "ADMIN"
    assert data["email"] == settings.FIRST_SUPERUSER_EMAIL


@pytest.mark.asyncio
async def test_inspector_registration_and_profile(client: httpx.AsyncClient):
    # Register new inspector
    reg_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "inspector.test@gov.in",
            "password": "Password123!",
            "full_name": "Senior Metrology Officer",
            "role": "INSPECTOR",
        },
    )
    assert reg_response.status_code == 201
    reg_data = reg_response.json()
    assert reg_data["email"] == "inspector.test@gov.in"
    assert reg_data["role"] == "INSPECTOR"

    # Login with new inspector
    login_response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "inspector.test@gov.in",
            "password": "Password123!",
        },
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    # Access /me
    me_response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "inspector.test@gov.in"


@pytest.mark.asyncio
async def test_pcr_2011_rules_catalog_seeded(client: httpx.AsyncClient):
    # Login as admin to get token
    login_res = await client.post(
        "/api/v1/auth/login",
        json={
            "email": settings.FIRST_SUPERUSER_EMAIL,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
    )
    token = login_res.json()["access_token"]

    # Fetch rules
    rules_res = await client.get(
        "/api/v1/rules/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rules_res.status_code == 200
    rules = rules_res.json()
    assert len(rules) >= 9

    rule_codes = [r["rule_code"] for r in rules]
    assert "PCR-R06-1-A" in rule_codes  # Manufacturer
    assert "PCR-R06-1-C" in rule_codes  # Net quantity
    assert "PCR-R06-1-D" in rule_codes  # Date of packing
    assert "PCR-R06-1-E" in rule_codes  # MRP
    assert "PCR-R06-1-N" in rule_codes  # Consumer Care


@pytest.mark.asyncio
async def test_product_creation_and_listing(client: httpx.AsyncClient):
    login_res = await client.post(
        "/api/v1/auth/login",
        json={
            "email": settings.FIRST_SUPERUSER_EMAIL,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_res = await client.post(
        "/api/v1/products/",
        headers=headers,
        json={
            "name": "Organic Whole Wheat Atta",
            "brand": "NatureBest Foods",
            "category": "FOOD",
            "barcode_gtin": "8901234567890",
        },
    )
    assert create_res.status_code == 201
    product_data = create_res.json()
    assert product_data["name"] == "Organic Whole Wheat Atta"
    assert product_data["category"] == "FOOD"

    list_res = await client.get("/api/v1/products/", headers=headers)
    assert list_res.status_code == 200
    products = list_res.json()
    assert len(products) >= 1
    assert any(p["name"] == "Organic Whole Wheat Atta" for p in products)
