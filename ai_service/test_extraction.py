"""
Unit Tests for Phase 5 Statutory Declaration Extraction Engine.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.extraction.engine import extract_all_declarations

client = TestClient(app)


def test_mrp_extraction():
    tokens = [
        {"text": "MRP", "confidence": 0.95, "normalized_bbox": [[0.1, 0.1], [0.2, 0.1], [0.2, 0.15], [0.1, 0.15]], "line_index": 0},
        {"text": "Rs. 249.50", "confidence": 0.92, "normalized_bbox": [[0.22, 0.1], [0.35, 0.1], [0.35, 0.15], [0.22, 0.15]], "line_index": 0},
        {"text": "(INCL. OF ALL TAXES)", "confidence": 0.90, "normalized_bbox": [[0.1, 0.16], [0.4, 0.16], [0.4, 0.20], [0.1, 0.20]], "line_index": 1},
    ]

    declarations = extract_all_declarations(tokens)
    mrp = next((d for d in declarations if d["field_type"] == "MRP"), None)

    assert mrp is not None
    assert mrp["parsed_value"]["amount"] == 249.50
    assert mrp["parsed_value"]["currency"] == "INR"
    assert mrp["parsed_value"]["inclusive_of_taxes"] is True
    assert mrp["confidence"] >= 0.90
    print("MRP Extraction: PASSED")


def test_net_quantity_standard_and_non_standard():
    # 1. Standard unit 'g'
    tokens_standard = [
        {"text": "NET QUANTITY: 500 g", "confidence": 0.94, "normalized_bbox": [[0.1, 0.3], [0.4, 0.3], [0.4, 0.35], [0.1, 0.35]], "line_index": 0}
    ]
    decls_std = extract_all_declarations(tokens_standard)
    qty_std = next((d for d in decls_std if d["field_type"] == "NET_QUANTITY"), None)

    assert qty_std is not None
    assert qty_std["parsed_value"]["value"] == 500.0
    assert qty_std["parsed_value"]["unit"] == "g"
    assert qty_std["parsed_value"]["is_standard_unit"] is True

    # 2. Non-standard unit 'gms'
    tokens_non_standard = [
        {"text": "Net Wt 250 gms", "confidence": 0.88, "normalized_bbox": [[0.1, 0.4], [0.35, 0.4], [0.35, 0.45], [0.1, 0.45]], "line_index": 1}
    ]
    decls_non_std = extract_all_declarations(tokens_non_standard)
    qty_non_std = next((d for d in decls_non_std if d["field_type"] == "NET_QUANTITY"), None)

    assert qty_non_std is not None
    assert qty_non_std["parsed_value"]["value"] == 250.0
    assert qty_non_std["parsed_value"]["unit"] == "gms"
    assert qty_std["parsed_value"]["standard_unit"] == "g"
    assert qty_non_std["parsed_value"]["is_standard_unit"] is False
    print("Net Quantity Extraction (Standard & Non-Standard): PASSED")


def test_unit_sale_price_and_dates():
    tokens = [
        {"text": "USP Rs. 0.50 / g", "confidence": 0.91, "normalized_bbox": [[0.1, 0.2], [0.3, 0.2], [0.3, 0.25], [0.1, 0.25]], "line_index": 0},
        {"text": "MFD ON: 03/2024", "confidence": 0.93, "normalized_bbox": [[0.1, 0.3], [0.3, 0.3], [0.3, 0.35], [0.1, 0.35]], "line_index": 1},
        {"text": "BEST BEFORE: 03/2025", "confidence": 0.89, "normalized_bbox": [[0.1, 0.4], [0.35, 0.4], [0.35, 0.45], [0.1, 0.45]], "line_index": 2},
    ]

    declarations = extract_all_declarations(tokens)
    usp = next((d for d in declarations if d["field_type"] == "UNIT_SALE_PRICE"), None)
    mfg = next((d for d in declarations if d["field_type"] == "MFG_DATE"), None)
    exp = next((d for d in declarations if d["field_type"] == "EXPIRY_DATE"), None)

    assert usp is not None
    assert usp["parsed_value"]["price"] == 0.50
    assert usp["parsed_value"]["unit"] == "g"

    assert mfg is not None
    assert mfg["parsed_value"]["month"] == 3
    assert mfg["parsed_value"]["year"] == 2024

    assert exp is not None
    assert exp["parsed_value"]["month"] == 3
    assert exp["parsed_value"]["year"] == 2025
    print("USP & Date Extractions: PASSED")


def test_manufacturer_care_and_origin():
    tokens = [
        {"text": "Manufactured by: Green Valley Agro Ltd", "confidence": 0.92, "normalized_bbox": [[0.1, 0.5], [0.6, 0.5], [0.6, 0.54], [0.1, 0.54]], "line_index": 0},
        {"text": "Plot 42, Food Park, Sonipat 131001 Haryana", "confidence": 0.90, "normalized_bbox": [[0.1, 0.55], [0.6, 0.55], [0.6, 0.59], [0.1, 0.59]], "line_index": 1},
        {"text": "Customer Care: 1800 123 4567 email: support@greenvalley.in", "confidence": 0.95, "normalized_bbox": [[0.1, 0.65], [0.7, 0.65], [0.7, 0.69], [0.1, 0.69]], "line_index": 2},
        {"text": "Country of Origin: India", "confidence": 0.96, "normalized_bbox": [[0.1, 0.72], [0.4, 0.72], [0.4, 0.76], [0.1, 0.76]], "line_index": 3},
    ]

    declarations = extract_all_declarations(tokens)
    mfg = next((d for d in declarations if d["field_type"] == "MANUFACTURER_ADDRESS"), None)
    care = next((d for d in declarations if d["field_type"] == "CONSUMER_CARE"), None)
    origin = next((d for d in declarations if d["field_type"] == "COUNTRY_OF_ORIGIN"), None)

    assert mfg is not None
    assert mfg["parsed_value"]["pincode"] == "131001"
    assert mfg["parsed_value"]["role"] == "MANUFACTURER"

    assert care is not None
    assert care["parsed_value"]["email"] == "support@greenvalley.in"
    assert "1800" in care["parsed_value"]["phone"]

    assert origin is not None
    assert origin["parsed_value"]["country"] == "India"
    print("Manufacturer, Consumer Care & Country of Origin Extractions: PASSED")


def test_api_extract_declarations_endpoint():
    payload = {
        "tokens": [
            {"text": "NET QTY 1 kg", "confidence": 0.95, "normalized_bbox": [[0.1, 0.1], [0.3, 0.1], [0.3, 0.15], [0.1, 0.15]], "line_index": 0},
            {"text": "MRP Rs. 120.00 INCL TAX", "confidence": 0.92, "normalized_bbox": [[0.1, 0.2], [0.4, 0.2], [0.4, 0.25], [0.1, 0.25]], "line_index": 1},
        ]
    }
    response = client.post("/api/v1/extract-declarations", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total_declarations"] == 2
    types = [d["field_type"] for d in data["declarations"]]
    assert "NET_QUANTITY" in types
    assert "MRP" in types
    print("API /api/v1/extract-declarations endpoint: PASSED")


if __name__ == "__main__":
    test_mrp_extraction()
    test_net_quantity_standard_and_non_standard()
    test_unit_sale_price_and_dates()
    test_manufacturer_care_and_origin()
    test_api_extract_declarations_endpoint()
    print("\nALL PHASE 5 EXTRACTION TESTS COMPLETED SUCCESSFULLY!")
