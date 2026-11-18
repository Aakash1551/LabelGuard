"""
Extractor for Unit Sale Price (USP) under PCR 2011 Rule 6(1)(f).
Mandatory statutory declaration for multi-unit packages and quantities > 1kg/1L:
'Unit Sale Price Rs. ... / g, kg, ml, l or piece'.
"""

import re
from typing import List, Dict, Any, Optional
from .normalizer import clean_text, fuzzy_match_any, merge_bounding_boxes, are_spatially_adjacent

USP_ANCHORS = [
    "unit sale price", "unit price", "usp", "u.s.p.", "u.s.p", "price per unit"
]

# e.g. "Rs. 0.30 / g", "₹ 150 / kg", "0.25 per ml", "USP Rs 0.40/g"
USP_PATTERN = re.compile(
    r'(?:USP|Unit\s*Sale\s*Price)?[:\s]*(?:(?:RS|RE|INR|[₹\u20B9])\.?\s*)?(\d+(?:\.\d{1,4})?)\s*(?:/|per)\s*(kg|g|gms?|ml|l|ltrs?|unit|piece|u|n)\b',
    re.IGNORECASE
)


def extract_unit_sale_price(tokens: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Extracts Unit Sale Price (USP) declaration.
    """
    if not tokens:
        return None

    candidate_anchor_indices = []

    # 1. Search for USP Anchors or direct pattern
    for idx, token in enumerate(tokens):
        text = token.get("text", "")
        if re.search(r'\b(unit\s*sale\s*price|u\.?s\.?p\.?)\b', text, re.IGNORECASE):
            candidate_anchor_indices.append(idx)
        else:
            is_match, _, _ = fuzzy_match_any(text, USP_ANCHORS, threshold=0.82)
            if is_match:
                candidate_anchor_indices.append(idx)

    # Search anchored first
    for anchor_idx in candidate_anchor_indices:
        anchor_tok = tokens[anchor_idx]
        anchor_text = anchor_tok.get("text", "")
        anchor_bbox = anchor_tok.get("normalized_bbox") or anchor_tok.get("bbox")
        used_indices = [anchor_idx]

        # Check in anchor text itself
        match = USP_PATTERN.search(anchor_text)
        if match:
            price_val = float(match.group(1))
            unit_val = match.group(2)
            return {
                "field_type": "UNIT_SALE_PRICE",
                "raw_text": anchor_text,
                "parsed_value": {
                    "price": price_val,
                    "unit": unit_val.lower(),
                    "currency": "INR",
                },
                "confidence": round(anchor_tok.get("confidence", 0.8), 3),
                "source_token_indices": [anchor_idx],
                "primary_bbox": anchor_bbox,
            }

        # Check adjacent tokens
        for next_idx in range(len(tokens)):
            if next_idx == anchor_idx:
                continue
            next_tok = tokens[next_idx]
            next_bbox = next_tok.get("normalized_bbox") or next_tok.get("bbox")

            if are_spatially_adjacent(anchor_bbox, next_bbox, max_horizontal_gap=0.35, max_vertical_gap=0.08):
                t_text = next_tok.get("text", "")
                match = USP_PATTERN.search(t_text)
                if match:
                    used_indices.append(next_idx)
                    raw_text = " ".join([tokens[i].get("text", "") for i in sorted(used_indices)])
                    avg_conf = sum([tokens[i].get("confidence", 0.8) for i in used_indices]) / len(used_indices)
                    return {
                        "field_type": "UNIT_SALE_PRICE",
                        "raw_text": raw_text,
                        "parsed_value": {
                            "price": float(match.group(1)),
                            "unit": match.group(2).lower(),
                            "currency": "INR",
                        },
                        "confidence": round(avg_conf, 3),
                        "source_token_indices": sorted(used_indices),
                        "primary_bbox": merge_bounding_boxes([tokens[i].get("normalized_bbox", []) for i in used_indices]),
                    }

    # Fallback: direct pattern match across all tokens
    for idx, token in enumerate(tokens):
        text = token.get("text", "")
        match = USP_PATTERN.search(text)
        if match:
            return {
                "field_type": "UNIT_SALE_PRICE",
                "raw_text": text,
                "parsed_value": {
                    "price": float(match.group(1)),
                    "unit": match.group(2).lower(),
                    "currency": "INR",
                },
                "confidence": round(token.get("confidence", 0.75), 3),
                "source_token_indices": [idx],
                "primary_bbox": token.get("normalized_bbox") or token.get("bbox"),
            }

    return None
