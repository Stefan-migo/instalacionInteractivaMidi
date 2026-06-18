#!/usr/bin/env python3
"""
remove-bg.py — Background removal for QuitarFondo/
============================================
Takes images from images/raw/QuitarFondo/ and removes backgrounds
using rembg (u2net). Saves as PNG with transparency.

If the same file exists in curation/02-resized/ (already enhanced),
uses that as input for better results. Otherwise falls back to original.

Usage:
  python3 scripts/remove-bg.py
"""

import os
import sys
import json
from pathlib import Path

from rembg import remove as remove_bg
from PIL import Image

# ── Config ──────────────────────────────────────────────────────────
QUITAR_FONDO_DIR = Path("images/raw/QuitarFondo")
ENHANCED_DIR = Path("curation/02-resized")
OUTPUT_DIR = Path("curation/03-nobg")
MAX_WIDTH = 1600
SKIP_EXTENSIONS = {".mp4", ".avi", ".mov", ".webm", ".mkv"}
# ────────────────────────────────────────────────────────────────────


def find_enhanced(stem: str) -> Path | None:
    """Look for the stem in curation/02-resized/."""
    for ext in [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"]:
        candidate = ENHANCED_DIR / f"{stem}{ext}"
        if candidate.exists():
            return candidate
    return None


def resize_keeping_aspect(pil_img: Image.Image) -> Image.Image:
    """Resize to max MAX_WIDTH while keeping aspect ratio."""
    w, h = pil_img.size
    if w <= MAX_WIDTH:
        return pil_img
    ratio = MAX_WIDTH / w
    new_w = MAX_WIDTH
    new_h = int(round(h * ratio))
    return pil_img.resize((new_w, new_h), Image.LANCZOS)


def process_file(src_path: Path, out_dir: Path) -> dict:
    """Remove background from a single image. Returns manifest entry."""
    stem = src_path.stem
    out_name = f"{stem}.png"
    out_path = out_dir / out_name

    if out_path.exists():
        size_kb = os.path.getsize(out_path) // 1024
        w, h = Image.open(out_path).size
        return {
            "file": out_name,
            "status": "skipped (already exists)",
            "w": w, "h": h, "size_kb": size_kb,
        }

    # Prefer enhanced version if available
    enhanced = find_enhanced(stem)
    input_path = enhanced if enhanced else src_path
    source_label = "enhanced" if enhanced else "original"

    try:
        pil_img = Image.open(input_path).convert("RGB")
    except Exception as e:
        return {
            "file": src_path.name,
            "status": f"error: failed to open — {e}",
            "w": 0, "h": 0, "size_kb": 0,
        }

    # Resize before bg removal (faster on smaller images)
    pil_img = resize_keeping_aspect(pil_img)

    # Remove background
    try:
        # rembg returns RGBA
        result = remove_bg(pil_img)
    except Exception as e:
        return {
            "file": src_path.name,
            "status": f"error: rembg failed — {e}",
            "w": 0, "h": 0, "size_kb": 0,
        }

    # Save as PNG with transparency
    result.save(str(out_path), "PNG", optimize=True)
    w, h = result.size
    size_kb = os.path.getsize(out_path) // 1024

    return {
        "file": out_name,
        "source": src_path.name,
        "input": str(input_path.name),
        "input_source": source_label,
        "status": "ok",
        "w": w, "h": h, "size_kb": size_kb,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(
        [f for f in QUITAR_FONDO_DIR.iterdir() if f.is_file() and f.suffix.lower() not in SKIP_EXTENSIONS],
        key=lambda p: p.name.lower(),
    )

    print(f"🎨 Found {len(files)} files in {QUITAR_FONDO_DIR}")
    print(f"➡️  Output: {OUTPUT_DIR}/")
    print(f"   Max width: {MAX_WIDTH}px, Engine: rembg (u2net)")
    print()

    manifest = {}
    ok = skip = err = 0

    for i, src in enumerate(files, 1):
        print(f"  [{i:02d}/{len(files)}] {src.name} ... ", end="", flush=True)
        entry = process_file(src, OUTPUT_DIR)
        manifest[src.stem] = entry

        if entry["status"] == "ok":
            src_label = f"(from {entry['input_source']})"
            print(f"✅ {entry['w']}×{entry['h']}  ~{entry['size_kb']}KB  {src_label}")
            ok += 1
        elif entry["status"].startswith("skipped"):
            print(f"⏭️  {entry['w']}×{entry['h']}  ~{entry['size_kb']}KB")
            skip += 1
        else:
            print(f"❌ {entry['status']}")
            err += 1

    # Save manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\n📄 Manifest saved: {manifest_path}")

    print(f"\n{'='*50}")
    print(f"  Done: {ok} processed, {skip} skipped, {err} errors")
    print(f"  Output: {OUTPUT_DIR}/")
    print(f"{'='*50}")

    return 1 if err > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
