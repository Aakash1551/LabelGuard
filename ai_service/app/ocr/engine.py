import logging
import os
from dataclasses import dataclass
from typing import List, Optional

import cv2
import numpy as np

logger = logging.getLogger("labelguard.ocr")

_ocr_instance = None


@dataclass
class OCRTokenData:
    text: str
    confidence: float
    polygon_bbox: List[List[float]]
    normalized_bbox: List[List[float]]
    line_index: int = 0


@dataclass
class OCRResult:
    tokens: List[OCRTokenData]
    image_width: int
    image_height: int
    total_tokens: int = 0
    avg_confidence: float = 0.0

    def __post_init__(self):
        self.total_tokens = len(self.tokens)
        if self.tokens:
            self.avg_confidence = round(
                sum(t.confidence for t in self.tokens) / len(self.tokens), 4
            )


def _get_ocr_instance():
    global _ocr_instance
    if _ocr_instance is None:
        from rapidocr_onnxruntime import RapidOCR
        logger.info("Initializing RapidOCR (PP-OCRv4 ONNX Runtime) engine...")
        _ocr_instance = RapidOCR()
        logger.info("RapidOCR engine initialized successfully.")
    return _ocr_instance


class OCREngine:
    def __init__(self, confidence_threshold: float = 0.25):
        self.confidence_threshold = confidence_threshold

    def extract_text(self, image_path: str) -> OCRResult:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found for OCR: {image_path}")

        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Failed to decode image at: {image_path}")

        img_height, img_width = img.shape[:2]

        try:
            ocr = _get_ocr_instance()
            results, _ = ocr(image_path)
        except Exception as e:
            logger.error(f"OCR inference failed on {image_path}: {e}", exc_info=True)
            return OCRResult(tokens=[], image_width=img_width, image_height=img_height)

        tokens: List[OCRTokenData] = []

        if not results:
            logger.info(f"No text detected by OCR in: {image_path}")
            return OCRResult(tokens=[], image_width=img_width, image_height=img_height)

        for item in results:
            if not item or len(item) < 3:
                continue

            polygon_points = item[0]
            text = str(item[1]).strip()
            try:
                confidence = float(item[2])
            except (ValueError, TypeError):
                confidence = 0.0

            if confidence < self.confidence_threshold or not text:
                continue

            polygon = [[float(pt[0]), float(pt[1])] for pt in polygon_points]

            normalized = [
                [
                    round(max(0.0, min(1.0, pt[0] / img_width)), 6),
                    round(max(0.0, min(1.0, pt[1] / img_height)), 6),
                ]
                for pt in polygon
            ]

            tokens.append(OCRTokenData(
                text=text,
                confidence=round(confidence, 4),
                polygon_bbox=polygon,
                normalized_bbox=normalized,
            ))

        tokens = self._assign_reading_order(tokens, img_height)

        return OCRResult(
            tokens=tokens,
            image_width=img_width,
            image_height=img_height,
        )

    def _assign_reading_order(
        self, tokens: List[OCRTokenData], img_height: int
    ) -> List[OCRTokenData]:
        if not tokens:
            return tokens

        def y_centroid(token: OCRTokenData) -> float:
            ys = [pt[1] for pt in token.polygon_bbox]
            return sum(ys) / len(ys)

        def x_left(token: OCRTokenData) -> float:
            return min(pt[0] for pt in token.polygon_bbox)

        tokens.sort(key=y_centroid)

        line_tolerance = max(8.0, img_height * 0.02)
        current_line = 0
        prev_y = y_centroid(tokens[0])
        tokens[0].line_index = current_line

        for i in range(1, len(tokens)):
            curr_y = y_centroid(tokens[i])
            if abs(curr_y - prev_y) > line_tolerance:
                current_line += 1
                prev_y = curr_y
            else:
                prev_y = (prev_y + curr_y) / 2
            tokens[i].line_index = current_line

        tokens.sort(key=lambda t: (t.line_index, x_left(t)))
        return tokens
