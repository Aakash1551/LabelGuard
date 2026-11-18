"""
Extractor for Net Quantity under PCR 2011 Rule 6(1)(c).
Mandatory statutory declaration in standard units of weight, measure, or number.
"""

import re
from typing import List, Dict, Any, Optional
from .normalizer import clean_text, fuzzy_match_any, merge_bounding_boxes, are_spatially_adjacent

QTY_ANCHORS = [
    "net qty", "net quantity", "net wt", "net weight", "net content",
    "net contents", "net volume", "net mass", "quantity", "weight"
]

# Standard SI units under Legal Metrology:
STANDARD_UNITS = {"g", "kg", "ml", "l", "m", "cm", "mm", "n", "u"}

# Common non-standard or misspelled units:
NON_STANDARD_UNIT_MAP = {
    "gms": "g",
    "gm": "g",
    "g.": "g",
    "kilo": "kg",
    "kilos": "kg",
    "kgs": "kg",
    "ltr": "l",
    "ltrs": "l",
    "litres": "l",
    "liters": "l",
    "nos": "N",
    "pcs": "U",
    "pieces": "U",
}

QTY_PATTERN = re.compile(
    r'(\d+(?:\.\d+)?)\s*(kg|g|gms?|ml|ltrs?|litres?|l|n|u|pcs|pieces|m|cm|mm)\b',
    re.IGNORECASE
)


def extract_net_quantity(tokens: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Extracts Net Quantity declaration and standardizes quantity and unit.
    """
    if not tokens:
        return None

    candidate_anchor_indices = []

    # 1. Search for Net Quantity Anchors or direct quantity tokens
    for idx, token in enumerate(tokens):
        text = token.get("text", "")
        if re.search(r'(net\s*(?:qty|quantity|wt|weight|content|vol(?:ume)?)|quantity)', text, re.IGNORECASE):
            candidate_anchor_indices.append(idx)
        else:
            is_match, _, _ = fuzzy_match_any(text, QTY_ANCHORS, threshold=0.80)
            if is_match:
                candidate_anchor_indices.append(idx)

    best_qty = None
    best_confidence = 0.0

    # Case A: Anchored search
    for anchor_idx in candidate_anchor_indices:
        anchor_token = tokens[anchor_idx]
        anchor_text = anchor_token.get("text", "")
        anchor_bbox = anchor_token.get("normalized_bbox") or anchor_token.get("bbox")
        used_indices = [anchor_idx]

        qty_val = None
        raw_unit = None

        # Check inside anchor text itself (e.g. "Net Qty: 500 g" or "NET WT 500g")
        match = QTY_PATTERN.search(anchor_text)
        if match:
            qty_val = float(match.group(1))
            raw_unit = match.group(2)
        else:
            # Check adjacent tokens horizontally or stacked vertically
            for next_idx in range(len(tokens)):
                if next_idx == anchor_idx:
                    continue
                next_tok = tokens[next_idx]
                next_bbox = next_tok.get("normalized_bbox") or next_tok.get("bbox")

                if are_spatially_adjacent(anchor_bbox, next_bbox, max_horizontal_gap=0.30, max_vertical_gap=0.08):
                    t_text = next_tok.get("text", "")
                    match = QTY_PATTERN.search(t_text)
                    if match:
                        qty_val = float(match.group(1))
                        raw_unit = match.group(2)
                        used_indices.append(next_idx)
                        break
                    # Sometimes quantity number and unit are in separate tokens (e.g. "500" then "g")
                    num_match = re.match(r'^(\d+(?:\.\d+)?)$', t_text.strip())
                    if num_match:
                        # Look for unit in next token
                        candidate_num = float(num_match.group(1))
                        for u_idx in range(len(tokens)):
                            if u_idx in [anchor_idx, next_idx]:
                                continue
                            u_tok = tokens[u_idx]
                            u_box = u_tok.get("normalized_bbox") or u_tok.get("bbox")
                            if are_spatially_adjacent(next_bbox, u_box, max_horizontal_gap=0.15, max_vertical_gap=0.05):
                                u_text = u_tok.get("text", "").strip()
                                if re.match(r'^(kg|g|gms?|ml|ltrs?|l|n|u|pcs|m|cm|mm)$', u_text, re.IGNORECASE):
                                    qty_val = candidate_num
                                    raw_unit = u_text
                                    used_indices.extend([next_idx, u_idx])
                                    break
                        if qty_val is not None:
                            break

        if qty_val is not None and raw_unit is not None:
            canonical_unit = raw_unit.lower()
            standard_unit = NON_STANDARD_UNIT_MAP.get(canonical_unit, canonical_unit)
            is_standard = canonical_unit in STANDARD_UNITS

            raw_text = " ".join([tokens[i].get("text", "") for i in sorted(used_indices)])
            avg_conf = sum([tokens[i].get("confidence", 0.8) for i in used_indices]) / len(used_indices)
            merged_bbox = merge_bounding_boxes([tokens[i].get("normalized_bbox", []) for i in used_indices])

            candidate = {
                "field_type": "NET_QUANTITY",
                "raw_text": raw_text,
                "parsed_value": {
                    "value": qty_val,
                    "unit": raw_unit,
                    "standard_unit": standard_unit,
                    "is_standard_unit": is_standard,
                },
                "confidence": round(avg_conf, 3),
                "source_token_indices": sorted(used_indices),
                "primary_bbox": merged_bbox,
            }

            if avg_conf > best_confidence:
                best_confidence = avg_conf
                best_qty = candidate

    # Case B: Unanchored fallback if anchor wasn't found but high-confidence quantity string exists
    if best_qty is None:
        for idx, token in enumerate(tokens):
            text = token.get("text", "")
            match = QTY_PATTERN.search(text)
            if match:
                qty_val = float(match.group(1))
                raw_unit = match.group(2)
                canonical_unit = raw_unit.lower()
                standard_unit = NON_STANDARD_UNIT_MAP.get(canonical_unit, canonical_unit)
                is_standard = canonical_unit in STANDARD_UNITS

                conf = token.get("confidence", 0.75)
                best_qty = {
                    "field_type": "NET_QUANTITY",
                    "raw_text": text,
                    "parsed_value": {
                        "value": qty_val,
                        "unit": raw_unit,
                        "standard_unit": standard_unit,
                        "is_standard_unit": is_standard,
                    },
                    "confidence": round(conf, 3),
                    "source_token_indices": [idx],
                    "primary_bbox": token.get("normalized_bbox") or token.get("bbox"),
                }
                break

    return best_qty
