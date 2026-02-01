import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def build_pipeline(numeric_features):
    text_features = ["title", "description"]

    text_transformer = TfidfVectorizer(
        max_features=5000,
        ngram_range=(1, 2),
        stop_words="english",
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("title", text_transformer, "title"),
            ("description", text_transformer, "description"),
            ("numeric", StandardScaler(), numeric_features),
        ],
        remainder="drop",
    )

    clf = LogisticRegression(max_iter=300)
    return Pipeline(steps=[("preprocessor", preprocessor), ("clf", clf)])


def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["desc_length"] = df["description"].fillna("").str.len()
    df["repetition_score"] = df["description"].fillna("").apply(repetition_score)
    return df


def repetition_score(text: str) -> float:
    if not text:
        return 0.0
    tokens = [t for t in "".join([c.lower() if c.isalnum() else " " for c in text]).split() if t]
    if not tokens:
        return 0.0
    unique = len(set(tokens))
    return 1.0 - (unique / len(tokens))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data.csv")
    parser.add_argument("--model", default="model.joblib")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        raise SystemExit(f"Missing data file: {data_path}")

    df = pd.read_csv(data_path)
    required = {"title", "description", "price", "image_count", "review_count", "label"}
    if not required.issubset(df.columns):
        missing = required - set(df.columns)
        raise SystemExit(f"Missing columns: {missing}")

    df = add_derived_features(df)

    base_numeric = ["price", "image_count", "review_count", "desc_length", "repetition_score"]
    optional_numeric = [
        "image_avg_pixels",
        "image_low_res_count",
        "image_avg_sharpness",
        "image_aspect_ratio_std",
        "image_count_from_urls",
    ]
    numeric_features = base_numeric + [col for col in optional_numeric if col in df.columns]

    X = df[["title", "description", *numeric_features]]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = build_pipeline(numeric_features)
    pipeline.fit(X_train, y_train)

    preds = pipeline.predict(X_test)
    report = classification_report(y_test, preds, output_dict=True)

    model_path = Path(args.model)
    joblib.dump({"model": pipeline, "report": report}, model_path)

    print(json.dumps({"model": str(model_path), "report": report}, indent=2))


if __name__ == "__main__":
    main()
