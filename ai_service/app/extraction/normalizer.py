"""
Text Normalization & Spatial Bounding Box Utilities for Declaration Extraction.
"""

import re
import math
from difflib import SequenceMatcher
from typing import List, Tuple, Optional, Dict, Any


def clean_text(text: str) -> str:
    """Normalizes whitespace, casing, and common OCR artifacts."""
    if not text:
        return ""
    # Standardize spaces and remove non-printable characters
    cleaned = re.sub(r'[\r\n\t]+', ' ', text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def fuzzy_match(candidate: str, pattern: str, threshold: float = 0.80) -> Tuple[bool, float]:
    """
    Returns (True, ratio) if candidate is similar to pattern above threshold.
    Case-insensitive comparison.
    """
    c_clean = clean_text(candidate).lower()
    p_clean = pattern.lower()

    if p_clean in c_clean:
        return True, 1.0

    ratio = SequenceMatcher(None, c_clean, p_clean).ratio()
    return ratio >= threshold, ratio


def fuzzy_match_any(candidate: str, patterns: List[str], threshold: float = 0.80) -> Tuple[bool, str, float]:
    """Checks if candidate matches any pattern in patterns."""
    best_match = ""
    best_score = 0.0

    for pat in patterns:
        matched, score = fuzzy_match(candidate, pat, threshold)
        if matched and score > best_score:
            best_score = score
            best_match = pat

    if best_score >= threshold:
        return True, best_match, best_score
    return False, "", 0.0


def compute_bbox_center(bbox: List[List[float]]) -> Tuple[float, float]:
    """Computes (cx, cy) center of a 4-point polygon bbox [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]."""
    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def merge_bounding_boxes(bboxes: List[List[List[float]]]) -> List[List[float]]:
    """Merges multiple 4-point polygon bboxes into a single enclosing bounding polygon."""
    if not bboxes:
        return [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0], [0.0, 0.0]]

    all_xs = []
    all_ys = []
    for bbox in bboxes:
        for pt in bbox:
            all_xs.append(pt[0])
            all_ys.append(pt[1])

    min_x, max_x = min(all_xs), max(all_xs)
    min_y, max_y = min(all_ys), max(all_ys)

    return [
        [round(min_x, 4), round(min_y, 4)],
        [round(max_x, 4), round(min_y, 4)],
        [round(max_x, 4), round(max_y, 4)],
        [round(min_x, 4), round(max_y, 4)]
    ]


def are_spatially_adjacent(
    bbox1: List[List[float]],
    bbox2: List[List[float]],
    max_horizontal_gap: float = 0.15,
    max_vertical_gap: float = 0.08
) -> bool:
    """
    Checks if two normalized [0.0, 1.0] bounding boxes are adjacent either
    horizontally (same line) or vertically (stacked lines).
    """
    c1_x, c1_y = compute_bbox_center(bbox1)
    c2_x, c2_y = compute_bbox_center(bbox2)

    dx = abs(c1_x - c2_x)
    dy = abs(c1_y - c2_y)

    # Horizontally adjacent (roughly same Y, close X)
    if dy <= max_vertical_gap and dx <= max_horizontal_gap:
        return True

    # Vertically stacked (roughly same X, next line Y)
    if dx <= max_horizontal_gap and dy <= max_vertical_gap:
        return True

    return False
