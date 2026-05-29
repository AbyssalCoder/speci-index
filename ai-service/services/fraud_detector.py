"""
Fraud detection: AI-generated image detection, screenshot detection,
and suspicious pattern analysis.
"""

import io
import logging
from typing import Optional

import numpy as np
from PIL import Image, ImageStat

logger = logging.getLogger(__name__)

# Typical screenshot resolutions
SCREENSHOT_RESOLUTIONS = {
    (1920, 1080), (2560, 1440), (3840, 2160), (1366, 768),
    (1440, 900), (1536, 864), (2560, 1600), (1280, 720),
    (1080, 1920), (1440, 2560), (1080, 2400), (1080, 2340),
    (1125, 2436), (1170, 2532), (1284, 2778),
    (750, 1334), (828, 1792), (1242, 2688),
}


class FraudDetector:
    def __init__(self):
        self._ai_detector_loaded = False
        # In production, load a dedicated AI-generated image detector
        # e.g., a fine-tuned classifier or use heuristics
        logger.info("Fraud detector initialized (heuristic mode)")

    def check(self, image_bytes: bytes) -> dict:
        result = {
            "is_ai_generated": False,
            "is_screenshot": False,
            "fraud_score": 0.0,
            "flags": [],
        }

        try:
            image = Image.open(io.BytesIO(image_bytes))
        except Exception:
            result["fraud_score"] = 1.0
            result["flags"].append("invalid_image")
            return result

        fraud_score = 0.0

        # Screenshot detection
        if self._is_screenshot(image, image_bytes):
            result["is_screenshot"] = True
            result["flags"].append("screenshot_detected")
            fraud_score += 0.4

        # AI-generated heuristics
        ai_score = self._check_ai_generated(image)
        if ai_score > 0.6:
            result["is_ai_generated"] = True
            result["flags"].append("ai_generated_suspected")
        fraud_score += ai_score * 0.4

        # Check for editing artifacts
        edit_score = self._check_editing(image)
        fraud_score += edit_score * 0.2

        result["fraud_score"] = min(1.0, fraud_score)
        return result

    def _is_screenshot(self, image: Image.Image, image_bytes: bytes) -> bool:
        width, height = image.size

        # Check for exact screenshot resolutions
        if (width, height) in SCREENSHOT_RESOLUTIONS:
            return True

        # Check EXIF for screenshot indicators
        exif = image.getexif()
        if exif:
            # Software tag (271 = Make, 305 = Software)
            software = exif.get(305, "")
            if isinstance(software, str):
                screenshot_apps = ["snip", "screenshot", "screen capture",
                                   "lightshot", "greenshot", "sharex"]
                if any(app in software.lower() for app in screenshot_apps):
                    return True

        # Check for status bar patterns (very uniform top strip)
        if image.mode == "RGB":
            top_strip = np.array(image.crop((0, 0, width, min(40, height))))
            if top_strip.size > 0:
                std = np.std(top_strip, axis=(0, 1))
                if np.mean(std) < 5:  # Very uniform top bar
                    return True

        return False

    def _check_ai_generated(self, image: Image.Image) -> float:
        """
        Heuristic AI-generation detection.
        In production, use a dedicated model like:
        - DIRE (Diffusion Reconstruction Error)
        - CNNDetection
        - UniversalFakeDetect
        """
        if image.mode != "RGB":
            image = image.convert("RGB")

        img_array = np.array(image).astype(np.float64)
        score = 0.0

        # Check for unnaturally smooth gradients (common in AI images)
        # Compute local variance
        patches = []
        h, w = img_array.shape[:2]
        patch_size = 32
        for y in range(0, h - patch_size, patch_size):
            for x in range(0, w - patch_size, patch_size):
                patch = img_array[y:y+patch_size, x:x+patch_size]
                patches.append(np.var(patch))

        if patches:
            variance_of_variance = np.var(patches)
            mean_variance = np.mean(patches)

            # AI images often have unnaturally consistent texture
            if mean_variance > 0 and variance_of_variance / mean_variance < 0.5:
                score += 0.3

        # Check for frequency domain anomalies
        gray = np.mean(img_array, axis=2)
        fft = np.fft.fft2(gray)
        fft_shift = np.fft.fftshift(fft)
        magnitude = np.log1p(np.abs(fft_shift))

        # AI images often have distinctive frequency patterns
        center_h, center_w = magnitude.shape[0] // 2, magnitude.shape[1] // 2
        high_freq = magnitude[
            center_h - 10:center_h + 10,
            center_w - 10:center_w + 10
        ]
        if high_freq.size > 0:
            ratio = np.mean(high_freq) / (np.mean(magnitude) + 1e-10)
            if ratio > 3.0:  # Unusual concentration of energy
                score += 0.2

        # Check EXIF — real photos usually have camera metadata
        exif = image.getexif()
        if not exif or len(exif) < 3:
            score += 0.15  # No EXIF is suspicious but not conclusive

        return min(1.0, score)

    def _check_editing(self, image: Image.Image) -> float:
        """Check for signs of image manipulation."""
        score = 0.0

        exif = image.getexif()
        if exif:
            software = exif.get(305, "")
            if isinstance(software, str):
                editors = ["photoshop", "gimp", "lightroom", "snapseed",
                          "picsart", "canva", "pixlr"]
                if any(ed in software.lower() for ed in editors):
                    score += 0.5

        return min(1.0, score)
