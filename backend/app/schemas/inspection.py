from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.product import ProductResponse
from app.schemas.rule import ComplianceFindingResponse


class OCRTokenResponse(BaseModel):
    id: str
    image_id: str
    detected_text: str
    confidence: float
    polygon_bbox: Any
    line_index: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InspectionImageResponse(BaseModel):
    id: str
    inspection_id: str
    file_path: str
    original_filename: str
    file_size_bytes: int
    mime_type: str
    panel_type: str
    width_px: Optional[int] = None
    height_px: Optional[int] = None
    preprocessed_file_path: Optional[str] = None
    created_at: datetime
    ocr_tokens: List[OCRTokenResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ExtractedDeclarationResponse(BaseModel):
    id: str
    inspection_id: str
    source_image_id: Optional[str] = None
    field_type: str
    raw_text: str
    parsed_value: Any
    confidence: float
    primary_bbox: Optional[Any] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InspectionReportResponse(BaseModel):
    id: str
    inspection_id: str
    report_number: str
    pdf_file_path: str
    file_size_bytes: int
    sha256_hash: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InspectionCreate(BaseModel):
    product_id: Optional[str] = None
    notes: Optional[str] = None


class InspectionUpdate(BaseModel):
    notes: Optional[str] = None


class ManualOverrideRequest(BaseModel):
    status: str = Field(..., pattern="^(COMPLIANT|POTENTIALLY_NON_COMPLIANT|REQUIRES_MANUAL_REVIEW)$")
    reason: str = Field(..., min_length=5, max_length=1000)


class InspectionResponse(BaseModel):
    id: str
    inspection_number: str
    product_id: Optional[str] = None
    inspector_id: str
    status: str
    overall_score: float
    notes: Optional[str] = None
    is_manual_override: bool
    manual_override_by_id: Optional[str] = None
    manual_override_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductResponse] = None

    model_config = ConfigDict(from_attributes=True)


class InspectionDetailResponse(InspectionResponse):
    images: List[InspectionImageResponse] = []
    extracted_declarations: List[ExtractedDeclarationResponse] = []
    findings: List[ComplianceFindingResponse] = []
    report: Optional[InspectionReportResponse] = None

    model_config = ConfigDict(from_attributes=True)
