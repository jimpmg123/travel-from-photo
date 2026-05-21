from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageOps

# Max dimension before down-scaling. Bigger images cost more on Vision/GPT
# and rarely add accuracy past ~2K.
MAX_DIMENSION = 2048

# Apply CLAHE (adaptive contrast) if mean luminance (0-255) is below this.
DARK_MEAN_THRESHOLD = 60

# Laplacian-variance threshold below which the image is treated as blurry.
# Empirical: ~100 is a common cutoff for "noticeably soft".
BLUR_THRESHOLD = 100.0
UNSHARP_AMOUNT = 1.0

CLAHE_CLIP_LIMIT = 2.0
CLAHE_TILE_GRID_SIZE = (8, 8)

# Hough rotation correction: needs enough confident lines to trust the angle,
# and we don't rotate more than this many degrees (anything bigger is likely
# intentional framing, not a tilt to fix).
HOUGH_MIN_LINES = 30
HOUGH_MAX_CORRECTION_DEG = 15.0
HOUGH_MIN_CORRECTION_DEG = 0.5


def _pil_to_cv(pil_image: Image.Image) -> np.ndarray:
    """PIL RGB image -> OpenCV BGR numpy array."""
    rgb = pil_image.convert("RGB")
    return cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)


def _apply_clahe(bgr: np.ndarray) -> np.ndarray:
    """Adaptive histogram equalization on the L channel of LAB. Brightens
    dark regions without blowing out bright ones — much better than a global
    autocontrast on night / interior / backlit photos."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP_LIMIT, tileGridSize=CLAHE_TILE_GRID_SIZE)
    l_clahe = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l_clahe, a, b]), cv2.COLOR_LAB2BGR)


def _laplacian_variance(bgr: np.ndarray) -> float:
    """High variance = sharp edges; low variance = blurry."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _unsharp_mask(bgr: np.ndarray, amount: float = UNSHARP_AMOUNT) -> np.ndarray:
    """Sharpen by subtracting a blurred copy from the original."""
    blurred = cv2.GaussianBlur(bgr, (0, 0), sigmaX=2)
    return cv2.addWeighted(bgr, 1.0 + amount, blurred, -amount, 0)


def _hough_dominant_angle(bgr: np.ndarray) -> float | None:
    """Estimate skew angle (degrees) from dominant Hough line segments.
    Returns the angle that the image is tilted by (positive = clockwise),
    or None if not enough confident lines were found.

    Conservative on purpose: only fires when many strong line segments
    agree, and only within ±HOUGH_MAX_CORRECTION_DEG."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    # Threshold (minimum collinear votes) scales with the shorter side so
    # smoke-test-size images don't fail to find lines while large photos
    # still need solid lines, not noise.
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
        # Fold lines into the "near-horizontal" bucket so vertical lines
        # also contribute their tilt as a small offset from 0.
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
    """Rotate around the image center; replicate border so we don't get
    black wedges at the corners."""
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

    Steps (in order; each only runs if needed):
    1. EXIF Orientation rotation (PIL)
    2. Resize to MAX_DIMENSION on the long side (PIL)
    3. CLAHE contrast if the image is dark on average (OpenCV)
    4. Unsharp mask if Laplacian-variance says it's blurry (OpenCV)
    5. (optional) Hough-based small-tilt correction, only when EXIF
       orientation was not applied (OpenCV). Off by default — turn on
       per-call when you actually want it.

    Returns a dict consumed by search_service (stored on analysis.preprocessing).
    """
    path = Path(image_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {path}")

    applied: list[str] = []

    # ---- Step 1+2: PIL — orientation + resize -------------------------
    with Image.open(path) as source:
        # Check the Orientation EXIF tag directly. Values 2..8 mean the image
        # is stored rotated/mirrored relative to how it should be displayed.
        # 1 (or absent) means "no fix needed". Using `is not` on the
        # exif_transpose return value is unreliable across PIL versions.
        exif = source.getexif()
        orientation = exif.get(0x0112)  # 0x0112 = Orientation
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
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    mean_brightness = float(gray.mean())
    if mean_brightness < DARK_MEAN_THRESHOLD:
        bgr = _apply_clahe(bgr)
        applied.append("clahe")

    # ---- Step 4: blur detection + unsharp -----------------------------
    blur_score = _laplacian_variance(bgr)
    if blur_score < BLUR_THRESHOLD:
        bgr = _unsharp_mask(bgr)
        applied.append("unsharp_mask")

    # ---- Step 5: optional Hough rotation ------------------------------
    if enable_hough_rotation and "exif_orientation" not in applied:
        angle = _hough_dominant_angle(bgr)
        if angle is not None:
            bgr = _rotate_by_degrees(bgr, -angle)
            applied.append(f"hough_rotation:{angle:+.2f}")

    processed_size = (int(bgr.shape[1]), int(bgr.shape[0]))  # (width, height)

    # Nothing applied — keep original file to avoid an unnecessary re-encode.
    if not applied:
        return {
            "processed_path": str(path),
            "applied": [],
            "original_size": original_size,
            "processed_size": original_size,
            "mean_brightness": round(mean_brightness, 2),
            "blur_score": round(blur_score, 2),
        }

    # ---- Step 6: save processed image to temp -------------------------
    suffix = path.suffix.lower() if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        ok = cv2.imwrite(tmp.name, bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
        if not ok:
            raise RuntimeError(f"Failed to write processed image to {tmp.name}")
        processed_path = tmp.name

    return {
        "processed_path": processed_path,
        "applied": applied,
        "original_size": original_size,
        "processed_size": processed_size,
        "mean_brightness": round(mean_brightness, 2),
        "blur_score": round(blur_score, 2),
    }
