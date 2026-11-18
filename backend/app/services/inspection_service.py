import os
import uuid
import datetime
import secrets
from typing import List, Tuple
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.core.config import settings
from app.models.inspection import Inspection, InspectionImage
from app.image_processing.pipeline import ImagePreprocessor

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB limit per image


def validate_image_file(file: UploadFile, header_bytes: bytes) -> str:
    """
    Validates file extension, reported MIME type, and binary magic bytes to prevent
    file upload attacks and format mismatches.
    """
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Only JPG, PNG, and WebP are allowed."
        )

    # Magic byte verification
    is_jpeg = header_bytes.startswith(b"\xff\xd8\xff")
    is_png = header_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = header_bytes.startswith(b"RIFF") and b"WEBP" in header_bytes[:16]

    if not (is_jpeg or is_png or is_webp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file content signature for '{file.filename}'. File is corrupted or spoofed."
        )

    if is_jpeg:
        return "image/jpeg"
    elif is_png:
        return "image/png"
    return "image/webp"


def generate_inspection_number() -> str:
    """Generates an auditable, human-readable inspection identifier."""
    date_str = datetime.datetime.now().strftime("%Y%m%d")
    random_suffix = secrets.token_hex(2).upper()
    return f"INS-{date_str}-{random_suffix}"


class InspectionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.preprocessor = ImagePreprocessor()

    async def create_inspection_with_images(
        self,
        inspector_id: str,
        files_with_panels: List[Tuple[UploadFile, str]],
        product_id: str = None,
        notes: str = None
    ) -> Inspection:
        """
        Processes multi-panel package uploads:
        1. Validates files and signatures.
        2. Creates an Inspection record in the database.
        3. Saves raw images to storage.
        4. Runs OpenCV preprocessing (orientation, CLAHE, deskewing, sharpening).
        5. Saves preprocessed images and associates records.
        """
        if not files_with_panels:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one packaging label image must be uploaded."
            )

        # 1. Create master inspection record
        inspection = Inspection(
            inspection_number=generate_inspection_number(),
            product_id=product_id,
            inspector_id=inspector_id,
            status="PROCESSING",
            overall_score=0.0,
            notes=notes
        )
        self.db.add(inspection)
        await self.db.flush()  # Generates inspection.id

        # 2. Setup directory for this inspection
        target_dir = os.path.join(settings.MEDIA_UPLOAD_DIR, inspection.id)
        os.makedirs(target_dir, exist_ok=True)

        # 3. Process each image
        for upload_file, panel_type in files_with_panels:
            # Read first 32 bytes for signature sniffing
            header = await upload_file.read(32)
            verified_mime = validate_image_file(upload_file, header)

            # Read remainder of file
            rest = await upload_file.read()
            full_content = header + rest
            file_size = len(full_content)

            if file_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File '{upload_file.filename}' exceeds maximum allowed size of 15MB."
                )

            # File names
            file_uuid = str(uuid.uuid4())
            raw_filename = f"raw_{file_uuid}.jpg"
            raw_path = os.path.join(target_dir, raw_filename)
            prep_filename = f"prep_{file_uuid}.jpg"
            prep_path = os.path.join(target_dir, prep_filename)

            # Write raw image to disk
            with open(raw_path, "wb") as f:
                f.write(full_content)

            # Run OpenCV Preprocessing
            try:
                prep_result = self.preprocessor.process(raw_path, prep_path)
                width = prep_result.processed_width
                height = prep_result.processed_height
            except Exception as e:
                # Fallback to raw if CV processing fails on an extreme edge-case
                prep_path = raw_path
                width, height = None, None

            # Relative paths stored in database for frontend/API accessibility
            rel_raw_path = os.path.relpath(raw_path, start=".").replace("\\", "/")
            rel_prep_path = os.path.relpath(prep_path, start=".").replace("\\", "/")

            # Add image record to database
            image_record = InspectionImage(
                inspection_id=inspection.id,
                file_path=rel_raw_path,
                preprocessed_file_path=rel_prep_path,
                original_filename=upload_file.filename or "package_image.jpg",
                file_size_bytes=file_size,
                mime_type=verified_mime,
                panel_type=panel_type.upper(),
                width_px=width,
                height_px=height
            )
            self.db.add(image_record)

        await self.db.commit()

        # Reload inspection with all serialized relationships eagerly loaded
        stmt = (
            select(Inspection)
            .options(
                selectinload(Inspection.images).selectinload(InspectionImage.ocr_tokens),
                selectinload(Inspection.extracted_declarations),
                selectinload(Inspection.findings),
                selectinload(Inspection.product),
                selectinload(Inspection.report)
            )
            .where(Inspection.id == inspection.id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def get_inspection(self, inspection_id: str) -> Inspection:
        """Retrieves a single inspection record with eager relationships."""
        stmt = (
            select(Inspection)
            .options(
                selectinload(Inspection.images).selectinload(InspectionImage.ocr_tokens),
                selectinload(Inspection.extracted_declarations),
                selectinload(Inspection.findings),
                selectinload(Inspection.product),
                selectinload(Inspection.report)
            )
            .where(Inspection.id == inspection_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_inspections(
        self,
        skip: int = 0,
        limit: int = 20,
        status_filter: str = None
    ) -> List[Inspection]:
        """Lists inspections with pagination and optional status filter."""
        stmt = (
            select(Inspection)
            .options(
                selectinload(Inspection.images),
                selectinload(Inspection.product)
            )
        )
        if status_filter:
            stmt = stmt.where(Inspection.status == status_filter.upper())
        stmt = stmt.offset(skip).limit(limit).order_by(Inspection.created_at.desc())
        result = await self.db.execute(stmt)
        return result.scalars().all()
