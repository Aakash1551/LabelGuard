"""
Extractor for Country of Origin under PCR 2011 Rule 6(1)(aa).
Mandatory statutory declaration: Name of the country of origin or manufacture.
"""

import re
from typing import List, Dict, Any, Optional
from .normalizer import clean_text, fuzzy_match_any, merge_bounding_boxes, are_spatially_adjacent

ORIGIN_ANCHORS = [
    "country of origin", "made in", "product of", "origin", "manufactured in"
]

COMMON_COUNTRIES = [
    "india", "bharat", "china", "usa", "united states", "uk", "united kingdom",
    "germany", "japan", "bangladesh", "sri lanka", "nepal", "thailand",
    "vietnam", "malaysia", "indonesia", "italy", "france", "australia", "canada"
]


def extract_country_of_origin(tokens: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Extracts Country of Origin declaration.
    """
    if not tokens:
        return None

    # Case A: Pattern matching in tokens directly (e.g. "Country of Origin: India", "Made in India")
    for idx, token in enumerate(tokens):
        text = token.get("text", "")
        # Check "Country of Origin: <Country>" or "Made in <Country>"
        m = re.search(r'(?:country\s*of\s*origin|made\s*in|product\s*of)[:\s]*([a-zA-Z\s]+)', text, re.IGNORECASE)
        if m:
            candidate_country = m.group(1).strip()
            for c in COMMON_COUNTRIES:
                if c in candidate_country.lower():
                    return {
                        "field_type": "COUNTRY_OF_ORIGIN",
                        "raw_text": text,
                        "parsed_value": {
                            "country": c.title(),
                            "is_declared": True,
                        },
                        "confidence": round(token.get("confidence", 0.8), 3),
                        "source_token_indices": [idx],
                        "primary_bbox": token.get("normalized_bbox") or token.get("bbox"),
                    }

    # Case B: Multi-token anchored search
    for idx, token in enumerate(tokens):
        text = token.get("text", "")
        is_anchor = False
        if re.search(r'\b(country\s*of\s*origin|made\s*in|product\s*of)\b', text, re.IGNORECASE):
            is_anchor = True
        else:
            is_match, _, _ = fuzzy_match_any(text, ORIGIN_ANCHORS, threshold=0.82)
            if is_match:
                is_anchor = True

        if is_anchor:
            anchor_bbox = token.get("normalized_bbox") or token.get("bbox")
            for next_idx in range(len(tokens)):
                if next_idx == idx:
                    continue
                next_tok = tokens[next_idx]
                next_bbox = next_tok.get("normalized_bbox") or next_tok.get("bbox")

                if are_spatially_adjacent(anchor_bbox, next_bbox, max_horizontal_gap=0.25, max_vertical_gap=0.06):
                    n_text = next_tok.get("text", "").lower()
                    for c in COMMON_COUNTRIES:
                        if c in n_text:
                            used = [idx, next_idx]
                            raw_text = f"{text} {next_tok.get('text', '')}"
                            avg_conf = (token.get("confidence", 0.8) + next_tok.get("confidence", 0.8)) / 2.0
                            return {
                                "field_type": "COUNTRY_OF_ORIGIN",
                                "raw_text": raw_text,
                                "parsed_value": {
                                    "country": c.title(),
                                    "is_declared": True,
                                },
                                "confidence": round(avg_conf, 3),
                                "source_token_indices": used,
                                "primary_bbox": merge_bounding_boxes([tokens[i].get("normalized_bbox", []) for i in used]),
                            }

    return None
