"""
Extractor for Date of Manufacture / Packing / Import under PCR 2011 Rule 6(1)(d).
Mandatory statutory declaration: Month and Year of manufacture or packing.
"""

import re
from typing import List, Dict, Any, Optional
from .normalizer import clean_text, fuzzy_match_any, merge_bounding_boxes, are_spatially_adjacent

DATE_ANCHORS = [
    "mfg date", "mfd date", "date of mfg", "mfd on", "mfg on",
    "pkd date", "packed date", "date of packing", "pkd on", "packed on",
    "best before", "use by", "expiry date", "exp date", "exp."
]

MONTH_NAMES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12
}

# Matches DD/MM/YYYY, MM/YYYY, DD/MM/YY, MM/YY, or DD-MM-YYYY
NUMERIC_DATE_REGEX = re.compile(
    r'(?:(\d{1,2})[/\.-])?(\d{1,2})[/\.-](\d{2,4})\b'
)

# Matches "JAN 2024", "APR-24", "OCTOBER 2023"
TEXT_DATE_REGEX = re.compile(
    r'\b(?:(\d{1,2})[/\.\-\s]+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[/\.\-\s]+(\d{2,4})\b',
    re.IGNORECASE
)


def parse_date_components(date_str: str) -> Optional[Dict[str, Any]]:
    """Attempts to parse day, month, year from a date string."""
    # Try text month regex first
    m_text = TEXT_DATE_REGEX.search(date_str)
    if m_text:
        day = int(m_text.group(1)) if m_text.group(1) else None
        month_str = m_text.group(2).lower()
        month = MONTH_NAMES.get(month_str, None)
        year_val = int(m_text.group(3))
        year = year_val if year_val > 100 else (2000 + year_val)
        return {
            "day": day,
            "month": month,
            "year": year,
            "formatted": f"{month:02d}/{year}" if month else f"{year}"
        }

    # Try numeric regex
    m_num = NUMERIC_DATE_REGEX.search(date_str)
    if m_num:
        p1 = int(m_num.group(1)) if m_num.group(1) else None
        p2 = int(m_num.group(2))
        p3 = int(m_num.group(3))
        year = p3 if p3 > 100 else (2000 + p3)

        if p1 is not None:
            # DD/MM/YYYY
            day, month = p1, p2
        else:
            # MM/YYYY
            day, month = None, p2

        # Validate month
        if 1 <= month <= 12:
            return {
                "day": day,
                "month": month,
                "year": year,
                "formatted": f"{month:02d}/{year}"
            }

    return None


def extract_dates(tokens: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extracts date declarations (Mfg Date, Packing Date, Expiry/Best Before).
    Returns a list of extracted date declarations.
    """
    if not tokens:
        return []

    results = []
    seen_raw = set()

    for idx, token in enumerate(tokens):
        text = token.get("text", "")
        token_bbox = token.get("normalized_bbox") or token.get("bbox")

        # Determine date classification
        date_type = "MFG_DATE"
        if re.search(r'\b(best\s*before|use\s*by|exp(?:iry)?)\b', text, re.IGNORECASE):
            date_type = "EXPIRY_DATE"
        elif re.search(r'\b(pkd|packed|packing)\b', text, re.IGNORECASE):
            date_type = "PACKED_DATE"

        parsed = parse_date_components(text)
        used_indices = [idx]

        if not parsed:
            # Check adjacent tokens if anchor keyword found
            if any(k in text.lower() for k in ["mfg", "mfd", "pkd", "packed", "best before", "use by", "date"]):
                for next_idx in range(len(tokens)):
                    if next_idx == idx:
                        continue
                    next_tok = tokens[next_idx]
                    next_bbox = next_tok.get("normalized_bbox") or next_tok.get("bbox")
                    if are_spatially_adjacent(token_bbox, next_bbox, max_horizontal_gap=0.30, max_vertical_gap=0.08):
                        parsed = parse_date_components(next_tok.get("text", ""))
                        if parsed:
                            used_indices.append(next_idx)
                            break

        if parsed:
            raw_text = " ".join([tokens[i].get("text", "") for i in sorted(used_indices)])
            if raw_text not in seen_raw:
                seen_raw.add(raw_text)
                avg_conf = sum([tokens[i].get("confidence", 0.8) for i in used_indices]) / len(used_indices)
                results.append({
                    "field_type": date_type,
                    "raw_text": raw_text,
                    "parsed_value": {
                        "date_type": date_type,
                        "day": parsed["day"],
                        "month": parsed["month"],
                        "year": parsed["year"],
                        "formatted": parsed["formatted"],
                    },
                    "confidence": round(avg_conf, 3),
                    "source_token_indices": sorted(used_indices),
                    "primary_bbox": merge_bounding_boxes([tokens[i].get("normalized_bbox", []) for i in used_indices]),
                })

    return results
