from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageOps

# Max long-side before down-scaling.
MAX_DIMENSION = 2048

# Apply CLAHE (adaptive contrast) when the average luma (0-255) is below this.
DARK_MEAN_THRESHOLD = 60

# Laplacian-variance threshold: below = blurry; apply unsharp mask.
BLUR_THRESHOLD = 100.0
UNSHARP_AMOUNT = 1.0

CLAHE_CLIP_LIMIT = 2.0
CLAHE_TILE_GRID_SIZE = (8, 8)

# Hough rotation correction guards (only fire on confident, small tilts).
HOUGH_MIN_LINES = 30
HOUGH_MAX_CORRECTION_DEG = 15.0
HOUGH_MIN_CORRECTION_DEG = 0.5


def _pil_to_cv(pil_image: Image.Image) -> np.ndarray:
    rgb = pil_image.convert("RGB")
    return cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)


def _apply_clahe(bgr: np.ndarray) -> np.ndarray:
    """Adaptive histogram equalization on the L channel of LAB — brightens
    dark regions without blowing out the highlights."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP_LIMIT, tileGridSize=CLAHE_TILE_GRID_SIZE)
    return cv2.cvtColor(cv2.merge([clahe.apply(l), a, b]), cv2.COLOR_LAB2BGR)


def _laplacian_variance(bgr: np.ndarray) -> float:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _unsharp_mask(bgr: np.ndarray, amount: float = UNSHARP_AMOUNT) -> np.ndarray:
    blurred = cv2.GaussianBlur(bgr, (0, 0), sigmaX=2)
    return cv2.addWeighted(bgr, 1.0 + amount, blurred, -amount, 0)


def _hough_dominant_angle(bgr: np.ndarray) -> float | None:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    short_side = min(bgr.shape[:2])
    min_line_length = max(short_side // 4, 50)
    vote_threshold = max(short_side // 5, 80)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=vote_threshold,
        minLineLength=min_line_length,
        maxLineGap=10,
    )
    if lines is None or len(lines) < HOUGH_MIN_LINES:
        return None

    angles: list[float] = []
    for x1, y1, x2, y2 in lines[:, 0]:
        deg = float(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
        if deg > 45:
            deg -= 90
        elif deg < -45:
            deg += 90
        angles.append(deg)

    median = float(np.median(angles))
    if abs(median) < HOUGH_MIN_CORRECTION_DEG or abs(median) > HOUGH_MAX_CORRECTION_DEG:
        return None
    return median


def _rotate_by_degrees(bgr: np.ndarray, angle: float) -> np.ndarray:
    h, w = bgr.shape[:2]
    matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(
        bgr, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )


def preprocess_image(
    image_path: str | Path,
    *,
    enable_hough_rotation: bool = False,
) -> dict[str, Any]:
    """Layer 1 preprocessing.

    Returns both paths so the orchestrator can route APIs correctly:
      - original_path  : the input file as-is (used by GPT-4o and Web
        Detection — reverse image search and LLM reasoning are hurt by
        contrast/sharpen modifications)
      - processed_path : the EXIF-oriented, resized, CLAHE+unsharp version
        (used by OCR, Landmark, Label, Object, Logo — they benefit from
        clearer edges and balanced exposure)

    If no preprocessing step changed anything, processed_path == original_path
    (the input file). The dict also includes diagnostic metrics
    (mean_brightness, blur_score) for downstream debugging / evaluation.
    """
    path = Path(image_path).resolve()
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {path}")

    original_path = str(path)
    applied: list[str] = []

    # ---- Step 1+2: PIL — orientation + resize -------------------------
    with Image.open(path) as source:
        # Read Orientation EXIF tag directly to avoid PIL version quirks
        # where exif_transpose returns a copy even with no rotation.
        exif = source.getexif()
        orientation = exif.get(0x0112)  # 0x0112 == Orientation
        if orientation and orientation != 1:
            oriented = ImageOps.exif_transpose(source)
            applied.append(f"exif_orientation:{orientation}")
        else:
            oriented = source
        original_size = oriented.size

        if max(oriented.size) > MAX_DIMENSION:
            oriented = oriented.copy()
            oriented.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
            applied.append("resize")

        bgr = _pil_to_cv(oriented)

    # ---- Step 3: brightness + CLAHE -----------------------------------
    mean_brightness = float(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).mean())
    if mean_brightness < DARK_MEAN_THRESHOLD:
        bgr = _apply_clahe(bgr)
        applied.append("clahe")

    # ---- Step 4: blur detection + unsharp -----------------------------
    blur_score = _laplacian_variance(bgr)
    if blur_score < BLUR_THRESHOLD:
        bgr = _unsharp_mask(bgr)
        applied.append("unsharp_mask")

    # ---- Step 5: optional Hough rotation ------------------------------
    if enable_hough_rotation and not any(s.startswith("exif_orientation") for s in applied):
        angle = _hough_dominant_angle(bgr)
        if angle is not None:
            bgr = _rotate_by_degrees(bgr, -angle)
            applied.append(f"hough_rotation:{angle:+.2f}")

    processed_size = (int(bgr.shape[1]), int(bgr.shape[0]))

    # Nothing applied — original IS the processed version.
    if not applied:
        return {
            "original_path": original_path,
            "processed_path": original_path,
            "applied": [],
            "original_size": original_size,
            "processed_size": original_size,
            "mean_brightness": round(mean_brightness, 2),
            "blur_score": round(blur_score, 2),
        }

    # ---- Step 6: write processed image to a temp file -----------------
    suffix = path.suffix.lower() if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        ok = cv2.imwrite(tmp.name, bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
        if not ok:
            raise RuntimeError(f"Failed to write processed image to {tmp.name}")
        processed_path = tmp.name

    return {
        "original_path": original_path,
        "processed_path": processed_path,
        "applied": applied,
        "original_size": original_size,
        "processed_size": processed_size,
        "mean_brightness": round(mean_brightness, 2),
        "blur_score": round(blur_score, 2),
    }
