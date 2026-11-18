import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.services.inspection_service import InspectionService
from app.schemas.inspection import (
    InspectionResponse,
    InspectionDetailResponse,
)

router = APIRouter()


@router.post(
    "/upload",
    response_model=InspectionDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Multi-Panel Packaging Images & Trigger CV Preprocessing"
)
async def upload_packaging_images(
    files: List[UploadFile] = File(..., description="1 or more images of packaging faces"),
    panels: Optional[str] = Form(
        None,
        description="JSON array or comma-separated panel labels (e.g. ['FRONT','BACK'] or 'FRONT,BACK')"
    ),
    product_id: Optional[str] = Form(None, description="Optional linked product UUID"),
    notes: Optional[str] = Form(None, description="Optional inspection notes"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ingests multi-surface images of packaged commodities:
    1. Validates image integrity and magic bytes.
    2. Persists raw packaging captures.
    3. Runs the OpenCV computer vision pipeline (EXIF rotation, CLAHE contrast enhancement, deskewing).
    4. Creates the master inspection dossier in the database.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files were provided for inspection."
        )

    # Parse panel labels
    parsed_panels = []
    if panels:
        try:
            # Try JSON parsing
            loaded = json.loads(panels)
            if isinstance(loaded, list):
                parsed_panels = [str(p).upper() for p in loaded]
        except Exception:
            # Fallback to comma-separated
            parsed_panels = [p.strip().upper() for p in panels.split(",") if p.strip()]

    # Default panel mapping if insufficient labels provided
    default_panel_order = ["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "BOTTOM", "BULK"]
    files_with_panels = []
    for idx, file in enumerate(files):
        if idx < len(parsed_panels):
            panel = parsed_panels[idx]
        elif idx < len(default_panel_order):
            panel = default_panel_order[idx]
        else:
            panel = "OTHER"
        files_with_panels.append((file, panel))

    service = InspectionService(db)
    inspection = await service.create_inspection_with_images(
        inspector_id=current_user.id,
        files_with_panels=files_with_panels,
        product_id=product_id,
        notes=notes
    )

    return inspection


@router.get(
    "/",
    response_model=List[InspectionResponse],
    summary="List Conducted Inspections"
)
async def list_inspections(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, description="Filter by status (COMPLIANT, PROCESSING, etc.)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = InspectionService(db)
    return await service.list_inspections(skip=skip, limit=limit, status_filter=status_filter)


@router.get(
    "/{inspection_id}",
    response_model=InspectionDetailResponse,
    summary="Get Full Inspection Dossier"
)
async def get_inspection_detail(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = InspectionService(db)
    inspection = await service.get_inspection(inspection_id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspection '{inspection_id}' not found."
        )
    return inspection
