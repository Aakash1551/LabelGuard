"""
Extractor for Maximum Retail Price (MRP) under PCR 2011 Rule 6(1)(e).
Mandatory statutory declaration: 'Maximum or Max. Retail Price Rs. / ₹ ... inclusive of all taxes'.
"""

import re
from typing import List, Dict, Any, Optional
from .normalizer import clean_text, fuzzy_match_any, merge_bounding_boxes, are_spatially_adjacent

MRP_ANCHORS = [
    "mrp", "m.r.p", "m.r.p.", "max retail price", "maximum retail price",
    "retail price", "max. price"
]

TAX_REGEX = re.compile(r'incl(?:usive)?\.?\s*(?:of)?\s*(?:all)?\s*tax(?:es)?', re.IGNORECASE)

# Regex to match currency and amounts: e.g. Rs. 150.00, Rs 99, ₹250, 45.00
MRP_VALUE_PATTERN = re.compile(
    r'(?:(?:RS|RE|INR|[₹\u20B9])\.?\s*)?(\d{1,6}(?:\.\d{1,2})?)',
    re.IGNORECASE
)


def extract_mrp(tokens: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Scans OCR tokens for Maximum Retail Price (MRP).
    Looks for anchor tokens, extracts amount and currency,
    and checks for 'inclusive of all taxes' declaration nearby.
    """
    if not tokens:
        return None

    candidate_anchor_indices = []

    # 1. Locate tokens matching MRP anchors
    for idx, token in enumerate(tokens):
        text = token.get("text", "")
        # Direct regex check for single-line "MRP Rs 150" or "MRP: 150.00"
        if re.search(r'\b(mrp|m\.r\.p|max(?:imum)?\s+retail\s+price)\b', text, re.IGNORECASE):
            candidate_anchor_indices.append(idx)
        else:
            is_match, _, _ = fuzzy_match_any(text, MRP_ANCHORS, threshold=0.82)
            if is_match:
                candidate_anchor_indices.append(idx)

    best_mrp = None
    best_confidence = 0.0

    for anchor_idx in candidate_anchor_indices:
        anchor_token = tokens[anchor_idx]
        anchor_text = anchor_token.get("text", "")
        anchor_bbox = anchor_token.get("normalized_bbox") or anchor_token.get("bbox")
        used_indices = [anchor_idx]

        amount = None
        currency = "INR" if any(c in anchor_text for c in ["₹", "INR", "Rs", "rs"]) else None

        # Check if amount is embedded in the anchor token itself (e.g. "MRP: Rs. 150.00")
        match = re.search(r'(?:(?:RS|RE|INR|[₹\u20B9])\.?\s*)?(\d{1,6}(?:\.\d{1,2})?)', anchor_text[3:] if len(anchor_text) > 3 else "", re.IGNORECASE)
        if match and match.group(1) and float(match.group(1)) > 0:
            try:
                val = float(match.group(1))
                if 0.5 <= val <= 1000000:
                    amount = val
            except ValueError:
                pass

        # If not embedded, search adjacent tokens (same line or immediately below)
        if amount is None:
            for next_idx in range(len(tokens)):
                if next_idx == anchor_idx:
                    continue
                next_token = tokens[next_idx]
                next_bbox = next_token.get("normalized_bbox") or next_token.get("bbox")

                if are_spatially_adjacent(anchor_bbox, next_bbox, max_horizontal_gap=0.30, max_vertical_gap=0.08):
                    t_text = next_token.get("text", "")
                    val_match = re.search(r'(?:(?:RS|RE|INR|[₹\u20B9])\.?\s*)?(\d{1,6}(?:\.\d{1,2})?)', t_text, re.IGNORECASE)
                    if val_match and val_match.group(1):
                        try:
                            val = float(val_match.group(1))
                            if 0.5 <= val <= 1000000:
                                amount = val
                                used_indices.append(next_idx)
                                if any(c in t_text for c in ["₹", "INR", "Rs", "rs"]):
                                    currency = "INR"
                                break
                        except ValueError:
                            continue

        if amount is not None:
            # Check for "inclusive of all taxes" declaration in nearby tokens or anchor
            combined_context = " ".join([tokens[i].get("text", "") for i in used_indices])
            inclusive_taxes = bool(TAX_REGEX.search(combined_context))

            if not inclusive_taxes:
                # Search up to 3 tokens away vertically for tax disclaimer
                for tax_idx in range(len(tokens)):
                    if tax_idx in used_indices:
                        continue
                    t_tok = tokens[tax_idx]
                    t_box = t_tok.get("normalized_bbox") or t_tok.get("bbox")
                    if are_spatially_adjacent(anchor_bbox, t_box, max_horizontal_gap=0.35, max_vertical_gap=0.10):
                        if TAX_REGEX.search(t_tok.get("text", "")):
                            inclusive_taxes = True
                            used_indices.append(tax_idx)
                            break

            raw_text = " ".join([tokens[i].get("text", "") for i in sorted(used_indices)])
            avg_conf = sum([tokens[i].get("confidence", 0.8) for i in used_indices]) / len(used_indices)
            merged_bbox = merge_bounding_boxes([tokens[i].get("normalized_bbox", []) for i in used_indices])

            candidate_result = {
                "field_type": "MRP",
                "raw_text": raw_text,
                "parsed_value": {
                    "amount": round(amount, 2),
                    "currency": currency or "INR",
                    "inclusive_of_taxes": inclusive_taxes,
                },
                "confidence": round(avg_conf, 3),
                "source_token_indices": sorted(used_indices),
                "primary_bbox": merged_bbox,
            }

            if avg_conf > best_confidence:
                best_confidence = avg_conf
                best_mrp = candidate_result

    return best_mrp
