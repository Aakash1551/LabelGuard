import os
import time
import logging
from dataclasses import dataclass
from typing import Tuple, Optional
import cv2
import numpy as np
from PIL import Image, ImageOps

logger = logging.getLogger("labelguard.cv_pipeline")


@dataclass
class PreprocessingResult:
    """Encapsulates the output and performance metrics of the CV pipeline."""
    original_path: str
    preprocessed_path: str
    original_width: int
    original_height: int
    processed_width: int
    processed_height: int
    estimated_skew_angle: float
    is_deskewed: bool
    processing_time_ms: float


class ImagePreprocessor:
    """
    Computer Vision Preprocessor for packaged commodity label images.
    Implements:
    - EXIF orientation normalization.
    - Dimension clamping (aspect-preserving downscaling to prevent memory exhaustion).
    - Bilateral edge-preserving denoising.
    - CLAHE (Contrast Limited Adaptive Histogram Equalization) in LAB space.
    - Text contour morphological analysis and deskewing.
    - High-frequency stroke unsharp masking.
    """

    def __init__(
        self,
        max_dimension: int = 2048,
        clahe_clip_limit: float = 2.0,
        clahe_grid_size: Tuple[int, int] = (8, 8),
        deskew_min_angle: float = 0.75,
        deskew_max_angle: float = 45.0,
    ):
        self.max_dimension = max_dimension
        self.clahe_clip_limit = clahe_clip_limit
        self.clahe_grid_size = clahe_grid_size
        self.deskew_min_angle = deskew_min_angle
        self.deskew_max_angle = deskew_max_angle

    def load_with_exif_correction(self, image_path: str) -> Tuple[np.ndarray, int, int]:
        """
        Loads an image file, corrects orientation using EXIF tags (handling smartphone rotations),
        and converts it into an OpenCV BGR numpy array.
        """
        with Image.open(image_path) as pil_img:
            # Correct orientation according to EXIF tag
            transposed_img = ImageOps.exif_transpose(pil_img)
            # Ensure RGB format
            if transposed_img.mode != "RGB":
                transposed_img = transposed_img.convert("RGB")
            
            orig_w, orig_h = transposed_img.size
            rgb_arr = np.array(transposed_img)
            # Convert RGB to OpenCV BGR
            bgr_img = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)
            return bgr_img, orig_w, orig_h

    def clamp_dimensions(self, img: np.ndarray) -> np.ndarray:
        """
        Downscales the image if either width or height exceeds max_dimension,
        strictly maintaining the original aspect ratio.
        """
        h, w = img.shape[:2]
        if max(h, w) <= self.max_dimension:
            return img

        scaling_factor = self.max_dimension / float(max(h, w))
        new_w = int(w * scaling_factor)
        new_h = int(h * scaling_factor)

        # INTER_AREA provides optimal moiré-free downsampling for text
        return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    def enhance_contrast_clahe(self, img: np.ndarray) -> np.ndarray:
        """
        Applies CLAHE on the Lightness (L) channel in LAB color space.
        Normalizes harsh shadows and foil/can reflections without distorting hue.
        """
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        clahe = cv2.createCLAHE(
            clipLimit=self.clahe_clip_limit,
            tileGridSize=self.clahe_grid_size
        )
        enhanced_l = clahe.apply(l_channel)

        merged_lab = cv2.merge((enhanced_l, a_channel, b_channel))
        return cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)

    def apply_bilateral_filter(self, img: np.ndarray) -> np.ndarray:
        """
        Applies edge-preserving bilateral filtering to suppress packaging textures
        (e.g., cardboard fibers, metallic sheen) while keeping font contours crisp.
        """
        return cv2.bilateralFilter(img, d=7, sigmaColor=50, sigmaSpace=50)

    def estimate_skew_angle(self, img: np.ndarray) -> float:
        """
        Estimates the dominant text line skew angle using morphological horizontal dilation
        and minimum area bounding boxes.
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Invert and threshold: text becomes white on black background
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 8
        )

        # Dilation with a horizontal rectangular kernel to merge characters into lines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3))
        dilated = cv2.dilate(thresh, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        angles = []

        h_img, w_img = img.shape[:2]
        min_contour_area = (w_img * h_img) * 0.0005  # Filter out tiny noise dots

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_contour_area:
                continue

            rect = cv2.minAreaRect(cnt)
            (w_box, h_box) = rect[1]

            # We are interested in horizontal text bars (aspect ratio > 1.5)
            if w_box == 0 or h_box == 0:
                continue
            
            aspect_ratio = max(w_box, h_box) / min(w_box, h_box)
            if aspect_ratio < 1.5:
                continue

            angle = rect[2]
            # OpenCV minAreaRect returns angles in [-90, 0] or [0, 90] depending on version
            if angle < -45.0:
                angle = -(90.0 + angle)
            elif angle > 45.0:
                angle = angle - 90.0

            if abs(angle) <= self.deskew_max_angle:
                angles.append(angle)

        if not angles:
            return 0.0

        median_angle = float(np.median(angles))
        if abs(median_angle) < self.deskew_min_angle:
            return 0.0

        return median_angle

    def deskew_image(self, img: np.ndarray, angle: float) -> np.ndarray:
        """
        Rotates image by the estimated skew angle around the image center,
        filling corners with a neutral white background.
        """
        if abs(angle) < self.deskew_min_angle or abs(angle) > self.deskew_max_angle:
            return img

        h, w = img.shape[:2]
        center = (w // 2, h // 2)
        rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
        
        # Warp affine with white padding to blend seamlessly with typical label backgrounds
        deskewed = cv2.warpAffine(
            img,
            rot_mat,
            (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255)
        )
        return deskewed

    def apply_unsharp_mask(self, img: np.ndarray) -> np.ndarray:
        """
        Sharpens high-frequency character strokes using unsharp masking.
        Formula: sharpened = original * 1.3 - blurred * 0.3
        """
        gaussian = cv2.GaussianBlur(img, (0, 0), sigmaX=2.0)
        sharpened = cv2.addWeighted(img, 1.3, gaussian, -0.3, 0)
        return sharpened

    def process(self, input_path: str, output_path: str) -> PreprocessingResult:
        """
        Executes the end-to-end computer vision preprocessing pipeline.
        Saves the normalized image to output_path and returns performance metrics.
        """
        start_time = time.perf_counter()

        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input image not found: {input_path}")

        # 1. EXIF orientation correction
        img, orig_w, orig_h = self.load_with_exif_correction(input_path)

        # 2. Aspect-preserving dimension clamping
        img = self.clamp_dimensions(img)

        # 3. Bilateral smoothing for noise reduction
        img = self.apply_bilateral_filter(img)

        # 4. Contrast Limited Adaptive Histogram Equalization (CLAHE)
        img = self.enhance_contrast_clahe(img)

        # 5. Skew estimation & Deskewing
        skew_angle = self.estimate_skew_angle(img)
        is_deskewed = False
        if abs(skew_angle) >= self.deskew_min_angle:
            img = self.deskew_image(img, skew_angle)
            is_deskewed = True

        # 6. Stroke sharpening
        img = self.apply_unsharp_mask(img)

        # 7. Persist preprocessed image (high-quality JPEG with quality 95)
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        cv2.imwrite(output_path, img, [cv2.IMWRITE_JPEG_QUALITY, 95])

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        final_h, final_w = img.shape[:2]

        return PreprocessingResult(
            original_path=input_path,
            preprocessed_path=output_path,
            original_width=orig_w,
            original_height=orig_h,
            processed_width=final_w,
            processed_height=final_h,
            estimated_skew_angle=skew_angle,
            is_deskewed=is_deskewed,
            processing_time_ms=round(elapsed_ms, 2)
        )
