"""
Extractor for Name & Address of Manufacturer / Packer under PCR 2011 Rule 6(1)(a).
Mandatory statutory declaration: Complete name and address of manufacturer or packer.
"""

import re
from typing import List, Dict, Any, Optional
from .normalizer import clean_text, fuzzy_match_any, merge_bounding_boxes, are_spatially_adjacent

MFG_ANCHORS = [
    "manufactured by", "mfg. by", "mfg by", "manufactured and packed by",
    "packed by", "pkd. by", "pkd by", "marketed by", "mkt. by", "imported by"
]

PINCODE_REGEX = re.compile(r'\b[1-9]\d{5}\b')


def extract_manufacturer(tokens: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Extracts Manufacturer / Packer name and address details.
    """
    if not tokens:
        return None

    anchor_idx = None
    role_type = "MANUFACTURER"

    # Locate manufacturer anchor
    for idx, token in enumerate(tokens):
        text = token.get("text", "")
        if re.search(r'\b(mfg\.?\s*by|manufactured\s*by)\b', text, re.IGNORECASE):
            anchor_idx = idx
            role_type = "MANUFACTURER"
            break
        elif re.search(r'\b(pkd\.?\s*by|packed\s*by)\b', text, re.IGNORECASE):
            anchor_idx = idx
            role_type = "PACKER"
            break
        elif re.search(r'\b(imported\s*by)\b', text, re.IGNORECASE):
            anchor_idx = idx
            role_type = "IMPORTER"
            break
        elif re.search(r'\b(marketed\s*by|mkt\.?\s*by)\b', text, re.IGNORECASE):
            anchor_idx = idx
            role_type = "MARKETER"
            break

    if anchor_idx is None:
        # Fuzzy match
        for idx, token in enumerate(tokens):
            is_match, matched_pat, _ = fuzzy_match_any(token.get("text", ""), MFG_ANCHORS, threshold=0.82)
            if is_match:
                anchor_idx = idx
                if "pack" in matched_pat:
                    role_type = "PACKER"
                elif "import" in matched_pat:
                    role_type = "IMPORTER"
                else:
                    role_type = "MANUFACTURER"
                break

    if anchor_idx is None:
        return None

    # Collect tokens belonging to the name & address block
    used_indices = [anchor_idx]
    current_box = tokens[anchor_idx].get("normalized_bbox") or tokens[anchor_idx].get("bbox")
    pincode_found = None

    # Look for following tokens vertically below or horizontally aligned
    for next_idx in range(len(tokens)):
        if next_idx == anchor_idx:
            continue
        next_tok = tokens[next_idx]
        t_text = next_tok.get("text", "")
        next_bbox = next_tok.get("normalized_bbox") or next_tok.get("bbox")

        # Stop if we hit another major anchor (e.g. MRP, Net Qty, Best Before)
        if re.search(r'\b(mrp|net\s*wt|net\s*qty|best\s*before|exp(?:iry)?|batch)\b', t_text, re.IGNORECASE):
            continue

        if are_spatially_adjacent(current_box, next_bbox, max_horizontal_gap=0.35, max_vertical_gap=0.07):
            used_indices.append(next_idx)
            current_box = next_bbox

            # Check for PIN code
            m_pin = PINCODE_REGEX.search(t_text)
            if m_pin and not pincode_found:
                pincode_found = m_pin.group(0)

            # Limit address block to 6 lines to prevent runaway aggregation
            if len(used_indices) >= 6:
                break

    address_tokens = [tokens[i] for i in sorted(used_indices)]
    raw_text = " ".join([t.get("text", "") for t in address_tokens])
    avg_conf = sum([t.get("confidence", 0.8) for t in address_tokens]) / len(address_tokens)

    return {
        "field_type": "MANUFACTURER_ADDRESS",
        "raw_text": raw_text,
        "parsed_value": {
            "role": role_type,
            "address_text": raw_text,
            "pincode": pincode_found,
            "has_pincode": bool(pincode_found),
        },
        "confidence": round(avg_conf, 3),
        "source_token_indices": sorted(used_indices),
        "primary_bbox": merge_bounding_boxes([t.get("normalized_bbox", []) for t in address_tokens]),
    }
