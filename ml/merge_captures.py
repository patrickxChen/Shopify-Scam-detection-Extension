import argparse
import csv
from pathlib import Path


def normalize_text(value: str) -> str:
    if value is None:
        return ""
    text = str(value)
    text = text.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    text = text.replace("\u00a0", " ")
    text = " ".join(text.split())
    return text.strip()


def normalize_price(value: str) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    cleaned = text.replace("$", "").replace(",", "")
    try:
        return str(float(cleaned))
    except ValueError:
        return cleaned


def normalize_row(row: dict, fields: list[str]) -> dict:
    normalized = {}
    for field in fields:
        value = row.get(field, "")
        if field == "price":
            normalized[field] = normalize_price(value)
        else:
            normalized[field] = normalize_text(value)
    return normalized


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--capture", required=True, help="Path to capture CSV file")
    parser.add_argument("--dataset", default="ml/data.csv", help="Path to dataset CSV")
    args = parser.parse_args()

    capture_path = Path(args.capture)
    dataset_path = Path(args.dataset)

    if not capture_path.exists():
        raise SystemExit(f"Capture file not found: {capture_path}")
    if not dataset_path.exists():
        raise SystemExit(f"Dataset file not found: {dataset_path}")

    with dataset_path.open("r", newline="", encoding="utf-8") as handle:
        dataset_reader = csv.DictReader(handle)
        dataset_rows = list(dataset_reader)
        dataset_fields = dataset_reader.fieldnames or []

    with capture_path.open("r", newline="", encoding="utf-8") as handle:
        capture_reader = csv.DictReader(handle)
        capture_rows = list(capture_reader)
        capture_fields = capture_reader.fieldnames or []

    if not dataset_fields:
        raise SystemExit("Dataset header is missing")
    if not capture_fields:
        raise SystemExit("Capture header is missing")

    normalized_dataset = []
    existing_keys = set()
    for row in dataset_rows:
        cleaned = normalize_row(row, dataset_fields)
        key = (cleaned.get("url", ""), cleaned.get("title", ""))
        existing_keys.add(key)
        normalized_dataset.append(cleaned)

    appended = 0
    for row in capture_rows:
        cleaned = normalize_row(row, dataset_fields)
        key = (cleaned.get("url", ""), cleaned.get("title", ""))
        if key in existing_keys:
            continue

        normalized_dataset.append(cleaned)
        existing_keys.add(key)
        appended += 1

    with dataset_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=dataset_fields,
            quoting=csv.QUOTE_MINIMAL,
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(normalized_dataset)

    print(f"Appended {appended} row(s) to {dataset_path}")


if __name__ == "__main__":
    main()
