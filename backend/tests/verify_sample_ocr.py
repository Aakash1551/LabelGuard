"""
Standalone verification script testing real packaged commodity label OCR.
"""
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from app.image_processing.pipeline import ImagePreprocessor
from app.ocr.engine import OCREngine


def create_realistic_package_image(output_path: str):
    """Creates a high-resolution simulated packaging label containing all PCR 2011 declarations."""
    width, height = 1200, 900
    img = Image.new("RGB", (width, height), color=(250, 248, 240))
    draw = ImageDraw.Draw(img)

    # Header border
    draw.rectangle([(20, 20), (width - 20, height - 20)], outline=(40, 40, 40), width=3)
    draw.rectangle([(30, 30), (width - 30, 110)], fill=(20, 50, 90))

    # We use default PIL font or draw clear text
    lines = [
        ("NUTRILIFE PREMIUM WHOLE WHEAT ATTA", (50, 50), 30),
        ("MANDATORY DECLARATIONS UNDER LEGAL METROLOGY (PC) RULES 2011", (50, 130), 16),
        ("--------------------------------------------------------------------------------", (50, 155), 14),
        ("Commodity: Whole Wheat Flour", (50, 180), 20),
        ("Net Quantity: 5 kg", (50, 220), 24),
        ("Maximum Retail Price (MRP): Rs. 260.00 (Inclusive of all taxes)", (50, 265), 22),
        ("Unit Sale Price (USP): Rs. 52.00 per kg", (50, 310), 20),
        ("Date of Packing: 11/2026", (50, 355), 22),
        ("Country of Origin: Made in India", (50, 400), 20),
        ("Manufactured & Packed By: NutriLife Agro Foods Pvt Ltd", (50, 450), 18),
        ("Premises: Plot 42, Sector 8, Industrial Estate, Sonipat, Haryana 131001", (50, 485), 16),
        ("Customer Care Executive: Consumer Care Cell", (50, 540), 18),
        ("Toll Free: 1800-11-2233 | Email: customercare@nutrilife.in", (50, 575), 18),
        ("Postal Address: Same as manufacturer address", (50, 610), 16),
        ("FSSAI Lic No: 10019064001234", (50, 660), 18),
        ("Best Before 6 Months from Packing", (50, 710), 18),
    ]

    for text, (x, y), size in lines:
        draw.text((x, y), text, fill=(15, 15, 15))

    img.save(output_path, "JPEG", quality=95)


def run_verification():
    raw_path = "sample_package_label.jpg"
    prep_path = "sample_package_label_prep.jpg"

    create_realistic_package_image(raw_path)
    print(f"[1] Sample package label created at: {raw_path}")

    # Step 1: Preprocessing
    preprocessor = ImagePreprocessor(max_dimension=1600)
    prep_res = preprocessor.process(raw_path, prep_path)
    print(f"[2] OpenCV Preprocessing completed in {prep_res.processing_time_ms}ms")
    print(f"    Dimensions: {prep_res.original_width}x{prep_res.original_height} -> {prep_res.processed_width}x{prep_res.processed_height}")
    print(f"    Deskew angle: {prep_res.estimated_skew_angle:.2f} deg")

    # Step 2: OCR Extraction
    engine = OCREngine(confidence_threshold=0.30)
    ocr_res = engine.extract_text(prep_path)

    print(f"\n[3] OCR Extraction Results:")
    print(f"    Total tokens detected: {ocr_res.total_tokens}")
    print(f"    Average confidence: {ocr_res.avg_confidence:.4f}")
    print(f"\n[4] Sample Detected Tokens (first 10):")
    for i, tok in enumerate(ocr_res.tokens[:10]):
        print(f"    #{i+1:02d} [Line {tok.line_index}] (conf={tok.confidence:.3f}) : {tok.text}")

    # Clean up test files
    if os.path.exists(raw_path):
        os.remove(raw_path)
    if os.path.exists(prep_path):
        os.remove(prep_path)

    return ocr_res.total_tokens > 0


if __name__ == "__main__":
    success = run_verification()
    print(f"\nVerification {'SUCCESSFUL' if success else 'FAILED'}")
