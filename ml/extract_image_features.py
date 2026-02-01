import argparse
import csv
from io import BytesIO
from pathlib import Path
from typing import List

import numpy as np
import requests
from PIL import Image


def parse_urls(raw: str) -> List[str]:
    if not raw:
        return []
    return [u.strip() for u in raw.split(",") if u.strip()]


def fetch_image(url: str, timeout: int) -> Image.Image:
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return Image.open(BytesIO(resp.content)).convert("RGB")


def laplacian_variance(image: Image.Image) -> float:
    gray = np.array(image.convert("L"), dtype=np.float32)
    kernel = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32)
    padded = np.pad(gray, 1, mode="edge")
    out = np.zeros_like(gray)
    for i in range(gray.shape[0]):
        for j in range(gray.shape[1]):
            window = padded[i : i + 3, j : j + 3]
            out[i, j] = np.sum(window * kernel)
    return float(np.var(out))


def compute_features(urls: List[str], max_images: int, timeout: int):
    widths = []
    heights = []
    pixels = []
    sharpness = []
    low_res_count = 0

    for url in urls[:max_images]:
        try:
            img = fetch_image(url, timeout)
        except Exception:
            continue

        w, h = img.size
        widths.append(w)
        heights.append(h)
        pixels.append(w * h)
        sharpness.append(laplacian_variance(img))
        if w < 400 or h < 400 or (w * h) < 200000:
            low_res_count += 1

    if not pixels:
        return {
            "image_count_from_urls": 0,
            "image_avg_pixels": 0,
            "image_low_res_count": 0,
            "image_avg_sharpness": 0,
            "image_aspect_ratio_std": 0,
        }

    aspect_ratios = [w / h for w, h in zip(widths, heights) if h > 0]
    return {
        "image_count_from_urls": len(pixels),
        "image_avg_pixels": int(np.mean(pixels)),
        "image_low_res_count": int(low_res_count),
        "image_avg_sharpness": float(np.mean(sharpness)),
        "image_aspect_ratio_std": float(np.std(aspect_ratios)) if aspect_ratios else 0,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data.csv")
    parser.add_argument("--output", default="data_with_images.csv")
    parser.add_argument("--max-images", type=int, default=5)
    parser.add_argument("--timeout", type=int, default=10)
    parser.add_argument("--url-column", default="image_urls")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Missing data file: {input_path}")

    with input_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        fieldnames = reader.fieldnames or []

    if args.url_column not in fieldnames:
        raise SystemExit(f"Missing column: {args.url_column}")

    extra_fields = [
        "image_count_from_urls",
        "image_avg_pixels",
        "image_low_res_count",
        "image_avg_sharpness",
        "image_aspect_ratio_std",
    ]

    output_fields = fieldnames + [f for f in extra_fields if f not in fieldnames]

    for row in rows:
        urls = parse_urls(row.get(args.url_column, ""))
        features = compute_features(urls, args.max_images, args.timeout)
        row.update({k: features[k] for k in extra_fields})

    output_path = Path(args.output)
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=output_fields)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
