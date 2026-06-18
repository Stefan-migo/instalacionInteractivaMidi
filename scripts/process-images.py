#!/usr/bin/env python3
"""
process-images.py — Enhance + Resize all images from MejorarFotos/
============================================================
Pipeline:
  1. Open file (handles .jpg, .png, .tif)
  2. Convert to RGB
  3. Enhance: CLAHE contrast + mild unsharp mask
  4. Resize: max width 1600px, maintain aspect ratio
  5. Save as JPEG Q85 → curation/02-resized/
  6. Build manifest.json

Usage:
  python3 scripts/process-images.py
"""

import os
import sys
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

# ── Config ──────────────────────────────────────────────────────────
SOURCE_DIR = Path("images/raw/MejorarFotos")
OUTPUT_DIR = Path("curation/02-resized")
SKIP_EXTENSIONS = {".mp4", ".avi", ".mov", ".webm", ".mkv"}
MAX_WIDTH = 1600
JPEG_QUALITY = 85

ENHANCE_CLAHE_CLIP = 2.5        # Contrast limit for CLAHE (higher = more)
ENHANCE_SHARP_AMOUNT = 0.3      # Unsharp mask strength
ENHANCE_SHARP_RADIUS = 3        # Unsharp mask radius (odd number)
# ────────────────────────────────────────────────────────────────────


def enhance_image(cv_img: np.ndarray) -> np.ndarray:
    """Apply contrast enhancement + mild sharpening to a BGR image."""
    # ── 1. CLAHE on L channel (Lab color space) ──
    lab = cv2.cvtColor(cv_img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(
        clipLimit=ENHANCE_CLAHE_CLIP,
        tileGridSize=(8, 8)
    )
    l_enh = clahe.apply(l)
    lab_enh = cv2.merge([l_enh, a, b])
    cv_img = cv2.cvtColor(lab_enh, cv2.COLOR_LAB2BGR)

    # ── 2. Unsharp mask (mild sharpening) ──
    blurred = cv2.GaussianBlur(cv_img, (0, 0), ENHANCE_SHARP_RADIUS)
    cv_img = cv2.addWeighted(
        cv_img, 1.0 + ENHANCE_SHARP_AMOUNT,
        blurred, -ENHANCE_SHARP_AMOUNT,
        0
    )
    # Clip to valid range after sharpening
    cv_img = np.clip(cv_img, 0, 255).astype(np.uint8)

    return cv_img


def resize_image(cv_img: np.ndarray) -> np.ndarray:
    """Resize keeping aspect ratio, max width 1600px."""
    h, w = cv_img.shape[:2]
    if w <= MAX_WIDTH:
        return cv_img
    ratio = MAX_WIDTH / w
    new_w = MAX_WIDTH
    new_h = int(round(h * ratio))
    return cv2.resize(cv_img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def process_file(src_path: Path, out_dir: Path) -> dict:
    """Process a single image file. Returns manifest entry."""
    stem = src_path.stem
    ext = src_path.suffix.lower()

    # Map to output filename (always .jpg, clean name)
    out_name = f"{stem}.jpg"
    out_path = out_dir / out_name

    # Skip if it already exists (resume-safe)
    if out_path.exists():
        existing = cv2.imread(str(out_path))
        if existing is not None:
            h, w = existing.shape[:2]
            size_kb = os.path.getsize(out_path) // 1024
            return {
                "file": out_name,
                "status": "skipped (already exists)",
                "w": w,
                "h": h,
                "size_kb": size_kb,
            }

    try:
        # Open with PIL (handles TIF, PNG, JPG natively)
        pil_img = Image.open(src_path).convert("RGB")
        # Convert PIL → OpenCV BGR
        cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        return {
            "file": src_path.name,
            "status": f"error: failed to open — {e}",
            "w": 0, "h": 0, "size_kb": 0,
        }

    # Enhance
    cv_img = enhance_image(cv_img)

    # Resize
    cv_img = resize_image(cv_img)

    # Save as JPEG
    h, w = cv_img.shape[:2]
    rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
    pil_out = Image.fromarray(rgb)
    pil_out.save(str(out_path), "JPEG", quality=JPEG_QUALITY, optimize=True)

    size_kb = os.path.getsize(out_path) // 1024
    return {
        "file": out_name,
        "source": src_path.name,
        "status": "ok",
        "w": w,
        "h": h,
        "size_kb": size_kb,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Gather all image files, sorted
    files = sorted(
        [f for f in SOURCE_DIR.iterdir() if f.is_file() and f.suffix.lower() not in SKIP_EXTENSIONS],
        key=lambda p: p.name.lower(),
    )

    print(f"📷 Found {len(files)} files in {SOURCE_DIR}")
    print(f"➡️  Output: {OUTPUT_DIR}/")
    print(f"   Max width: {MAX_WIDTH}px, Enhance: CLAHE {ENHANCE_CLAHE_CLIP} + sharpen {ENHANCE_SHARP_AMOUNT}")
    print()

    manifest = {}
    ok = skip = err = 0

    for i, src in enumerate(files, 1):
        print(f"  [{i:02d}/{len(files)}] {src.name} ... ", end="", flush=True)
        entry = process_file(src, OUTPUT_DIR)
        manifest[src.stem] = entry

        if entry["status"] == "ok":
            print(f"✅ {entry['w']}×{entry['h']}  ~{entry['size_kb']}KB")
            ok += 1
        elif entry["status"].startswith("skipped"):
            print(f"⏭️  {entry['w']}×{entry['h']}  ~{entry['size_kb']}KB (already processed)")
            skip += 1
        else:
            print(f"❌ {entry['status']}")
            err += 1

    # Save manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\n📄 Manifest saved: {manifest_path}")

    # Summary
    print(f"\n{'='*50}")
    print(f"  Done: {ok} processed, {skip} skipped, {err} errors")
    print(f"  Output: {OUTPUT_DIR}/")
    print(f"{'='*50}")

    return 1 if err > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
