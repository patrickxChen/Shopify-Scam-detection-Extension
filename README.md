# Guardify ![Image](https://i.imgur.com/pzQzyTL.png)





Guardify is a Chrome extension that helps identify potentially fake or low-quality Shopify product listings. It scans a product page for common risk signals (like thin descriptions, repetitive copy, low image count, or suspicious pricing) and summarizes the results in a simple popup for quick review.

## What this project includes

- A React-based popup UI
- A content script that reads product page signals
- Basic heuristics to score listing risk

## Status

This is an early prototype focused on building the scan flow and UI. The detection logic will evolve as more signals are added.

## ML training (Python)

This repo includes a simple training + scoring stub in [ml](ml).

1) Train a model

- Install Python deps from [ml/requirements.txt](ml/requirements.txt)
- Run: `python ml/train.py --data ml/data.csv --model ml/model.joblib`

2) Start the scoring API

- Run: `uvicorn ml.server:app --reload --port 8000`

The extension calls `http://localhost:8000/score` and falls back to heuristics if the server is offline.

## Image features (AI image signals)

Add a column named `image_urls` to your CSV (comma-separated URLs). Then run:

- `python ml/extract_image_features.py --input ml/data.csv --output ml/data_with_images.csv`

This will append:

- `image_count_from_urls`
- `image_avg_pixels`
- `image_low_res_count`
- `image_avg_sharpness`
- `image_aspect_ratio_std`

Use the new CSV for training.
## Addtional Notes

This was inpsired by UofTHacks 13's theme of "Identity". Nowadays, cultural clothing and other items used to express identity are at risk of being used as scams. Someone can easily AI generate a fake listing which negatively harms both the seller and the buyer. Guardify attempts to mitigate this impact.
