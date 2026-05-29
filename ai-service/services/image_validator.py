"""
Image quality validation: blur detection, darkness, cropping,
format validation, and perceptual hashing.
"""

import io
import logging
from typing import Optional

import numpy as np
from PIL import Image, ImageStat, ImageFilter
import imagehash

logger = logging.getLogger(__name__)

MIN_DIMENSION = 200
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
MIN_QUALITY_SCORE = 0.4
BLUR_THRESHOLD = 80.0
DARK_THRESHOLD = 40.0
BRIGHT_THRESHOLD = 245.0
MIN_OBJECT_COVERAGE = 0.05  # At least 5% of image should have the subject


class ImageValidator:
    def validate(self, image_bytes: bytes) -> dict:
        result = {
            "is_valid": True,
            "score": 1.0,
            "reason": None,
            "is_blurry": False,
            "is_dark": False,
            "is_cropped": False,
        }

        # File size check
        if len(image_bytes) > MAX_FILE_SIZE:
            result["is_valid"] = False
            result["reason"] = "Image too large (max 20MB)"
            result["score"] = 0.0
            return result

        if len(image_bytes) < 1000:
            result["is_valid"] = False
            result["reason"] = "Image too small or corrupt"
            result["score"] = 0.0
            return result

        try:
            image = Image.open(io.BytesIO(image_bytes))
        except Exception:
            result["is_valid"] = False
            result["reason"] = "Invalid image format"
            result["score"] = 0.0
            return result

        width, height = image.size
        score = 1.0

        # Resolution check
        if width < MIN_DIMENSION or height < MIN_DIMENSION:
            result["is_valid"] = False
            result["reason"] = f"Image too small ({width}x{height}). Minimum {MIN_DIMENSION}px."
            result["score"] = 0.1
            return result

        # Convert to RGB for analysis
        if image.mode != "RGB":
            image = image.convert("RGB")

        img_array = np.array(image)

        # Blur detection using Laplacian variance
        gray = np.mean(img_array, axis=2)
        laplacian = np.array([
            [0, 1, 0],
            [1, -4, 1],
            [0, 1, 0],
        ], dtype=np.float64)

        from scipy.signal import convolve2d
        lap = convolve2d(gray, laplacian, mode='valid')
        blur_score = lap.var()

        if blur_score < BLUR_THRESHOLD:
            result["is_blurry"] = True
            score -= 0.3
            if blur_score < BLUR_THRESHOLD / 3:
                result["is_valid"] = False
                result["reason"] = "Image is too blurry"
                result["score"] = 0.2
                return result

        # Darkness / brightness check
        stats = ImageStat.Stat(image)
        mean_brightness = sum(stats.mean[:3]) / 3

        if mean_brightness < DARK_THRESHOLD:
            result["is_dark"] = True
            score -= 0.3
            if mean_brightness < DARK_THRESHOLD / 2:
                result["is_valid"] = False
                result["reason"] = "Image is too dark"
                result["score"] = 0.2
                return result

        if mean_brightness > BRIGHT_THRESHOLD:
            score -= 0.2

        # Check for very uniform images (solid colors / screenshots)
        std_dev = np.mean([s for s in stats.stddev[:3]])
        if std_dev < 10:
            result["is_valid"] = False
            result["reason"] = "Image appears to be a solid color or screenshot"
            result["score"] = 0.1
            return result

        # Aspect ratio check (extreme crops)
        aspect = max(width, height) / min(width, height)
        if aspect > 5:
            result["is_cropped"] = True
            score -= 0.2

        result["score"] = max(0.0, min(1.0, score))
        if result["score"] < MIN_QUALITY_SCORE:
            result["is_valid"] = False
            result["reason"] = "Image quality too low"

        return result

    def compute_perceptual_hash(self, image_bytes: bytes) -> str:
        """Compute perceptual hash for duplicate detection."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            phash = imagehash.phash(image, hash_size=16)
            return str(phash)
        except Exception:
            return ""

    def are_duplicates(self, hash1: str, hash2: str, threshold: int = 10) -> bool:
        """Check if two perceptual hashes are similar enough to be duplicates."""
        if not hash1 or not hash2:
            return False
        try:
            h1 = imagehash.hex_to_hash(hash1)
            h2 = imagehash.hex_to_hash(hash2)
            return (h1 - h2) < threshold
        except Exception:
            return False
