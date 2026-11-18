import os
import uuid
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from app.image_processing.pipeline import ImagePreprocessor
from app.ocr.engine import OCREngine
from app.extraction.engine import extract_all_declarations

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("labelguard.ai_service")

app = FastAPI(
    title="LabelGuard AI Microservice",
    description="Dedicated Computer Vision, RapidOCR (PP-OCRv4 ONNX), and Statutory Declaration Extraction Microservice",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Persistent engine instances
preprocessor = ImagePreprocessor()
ocr_engine = OCREngine()


class ProcessPathRequest(BaseModel):
    image_path: str
    output_path: Optional[str] = None


class ExtractDeclarationsRequest(BaseModel):
    tokens: List[Dict[str, Any]]


@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "LabelGuard AI Microservice",
        "engines": {
            "cv": "OpenCV Headless",
            "ocr": "RapidOCR PP-OCRv4 (ONNX Runtime)",
            "extraction": "PCR 2011 Rule 6 Statutory Parser"
        }
    }


@app.post("/api/v1/process-image")
async def process_image_by_path(payload: ProcessPathRequest):
    """
    Processes an existing image on disk:
    1. Runs OpenCV preprocessing (CLAHE, deskew, dimension clamp, sharpening).
    2. Runs RapidOCR text detection and recognition.
    3. Extracts statutory declarations (Rule 6: MRP, Net Qty, USP, Dates, Packer, Care, Origin).
    4. Returns structured tokens with normalized coordinates and extracted declarations.
    """
    input_path = payload.image_path
    if not os.path.exists(input_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image file not found at: {input_path}"
        )

    output_path = payload.output_path
    if not output_path:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_prep{ext}"

    try:
        prep_res = preprocessor.process(input_path, output_path)
    except Exception as e:
        logger.error(f"Preprocessing error on {input_path}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Computer Vision preprocessing failed: {str(e)}"
        )

    try:
        ocr_res = ocr_engine.extract_text(output_path)
    except Exception as e:
        logger.error(f"OCR error on {output_path}: {e}", exc_info=True)
        ocr_res = None

    tokens_data = []
    if ocr_res:
        for t in ocr_res.tokens:
            tokens_data.append({
                "text": t.text,
                "confidence": t.confidence,
                "polygon_bbox": t.polygon_bbox,
                "normalized_bbox": t.normalized_bbox,
                "line_index": t.line_index
            })

    # Execute Statutory Declaration Extraction Engine (Phase 5)
    declarations = extract_all_declarations(tokens_data)

    return {
        "success": True,
        "original_width": prep_res.original_width,
        "original_height": prep_res.original_height,
        "processed_width": prep_res.processed_width,
        "processed_height": prep_res.processed_height,
        "estimated_skew_angle": prep_res.estimated_skew_angle,
        "is_deskewed": prep_res.is_deskewed,
        "processing_time_ms": prep_res.processing_time_ms,
        "preprocessed_image_path": output_path,
        "total_tokens": len(tokens_data),
        "tokens": tokens_data,
        "total_declarations": len(declarations),
        "declarations": declarations
    }


@app.post("/api/v1/extract-declarations")
async def extract_declarations_endpoint(payload: ExtractDeclarationsRequest):
    """
    Extracts statutory declarations from arbitrary token lists (e.g. aggregated across multiple panels).
    """
    declarations = extract_all_declarations(payload.tokens)
    return {
        "success": True,
        "total_tokens": len(payload.tokens),
        "total_declarations": len(declarations),
        "declarations": declarations
    }
