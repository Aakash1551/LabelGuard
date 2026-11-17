import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.v1.api import api_router
from app.database.session import AsyncSessionLocal
from app.database.init_db import init_db

# Configure application logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("labelguard.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting LabelGuard AI backend services...")

    # Ensure storage directories exist
    os.makedirs(settings.MEDIA_UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.REPORT_OUTPUT_DIR, exist_ok=True)

    # Initialize database tables and statutory rule seed data
    async with AsyncSessionLocal() as session:
        try:
            await init_db(session)
            logger.info("Database schemas and PCR 2011 rule catalog successfully initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}", exc_info=True)

    yield

    # Shutdown actions
    logger.info("Shutting down LabelGuard AI services...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Compliance Intelligence Platform for Packaged Commodities under Indian Legal Metrology Regulations (PCR 2011).",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Set up CORS middleware
origins = settings.CORS_ORIGINS
if isinstance(origins, str):
    origins = [origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded packaging images and reports
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "platform": settings.PROJECT_NAME,
        "purpose": "Automated Legal Metrology Compliance Inspection Platform",
        "api_docs": "/docs",
        "health": f"{settings.API_V1_STR}/health"
    }
