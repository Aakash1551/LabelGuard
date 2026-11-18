"""
Extractor for Consumer Care Details under PCR 2011 Rule 6(1)(n).
Mandatory statutory declaration: Name, address, telephone number, and e-mail
of the contact person for consumer complaints.
"""

import re
from typing import List, Dict, Any, Optional
from .normalizer import clean_text, fuzzy_match_any, merge_bounding_boxes, are_spatially_adjacent

CARE_ANCHORS = [
    "consumer care", "customer care", "helpline", "toll free",
    "complaints", "feedback", "queries", "reach us", "contact us", "write to"
]

EMAIL_REGEX = re.compile(
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'
)

# Matches 1800 toll-free, standard 10-digit mobile, or STD landlines
PHONE_REGEX = re.compile(
    r'\b(?:1800\s*\d{3}\s*\d{3,4}|[6-9]\d{9}|0\d{2,4}[-\s]?\d{6,8})\b'
)


def extract_consumer_care(tokens: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Extracts Consumer Care contact details: Phone, Email, and physical contact information.
    """
    if not tokens:
        return None

    used_indices = []
    found_email = None
    found_phone = None

    # Step 1: Scan for email and phone patterns across all tokens
    for idx, token in enumerate(tokens):
        text = token.get("text", "")
        # Email check
        m_email = EMAIL_REGEX.search(text)
        if m_email and not found_email:
            found_email = m_email.group(0)
            used_indices.append(idx)

        # Phone check
        m_phone = PHONE_REGEX.search(text)
        if m_phone and not found_phone:
            found_phone = m_phone.group(0)
            used_indices.append(idx)

    # Step 2: Check for Consumer Care anchor tokens
    care_anchor_indices = []
    for idx, token in enumerate(tokens):
        text = token.get("text", "")
        if re.search(r'\b(consumer\s*care|customer\s*care|helpline|toll\s*free)\b', text, re.IGNORECASE):
            care_anchor_indices.append(idx)
        else:
            is_match, _, _ = fuzzy_match_any(text, CARE_ANCHORS, threshold=0.82)
            if is_match:
                care_anchor_indices.append(idx)

    used_indices.extend(care_anchor_indices)
    used_indices = list(set(used_indices))

    if not (found_email or found_phone or care_anchor_indices):
        return None

    raw_text = " ".join([tokens[i].get("text", "") for i in sorted(used_indices)])
    avg_conf = sum([tokens[i].get("confidence", 0.8) for i in used_indices]) / len(used_indices)

    return {
        "field_type": "CONSUMER_CARE",
        "raw_text": raw_text,
        "parsed_value": {
            "email": found_email,
            "phone": found_phone,
            "has_email": bool(found_email),
            "has_phone": bool(found_phone),
        },
        "confidence": round(avg_conf, 3),
        "source_token_indices": sorted(used_indices),
        "primary_bbox": merge_bounding_boxes([tokens[i].get("normalized_bbox", []) for i in used_indices]),
    }
