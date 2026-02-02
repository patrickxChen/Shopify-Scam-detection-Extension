from pathlib import Path
from typing import Optional

import joblib
from fastapi import FastAPI
from pydantic import BaseModel

MODEL_PATH = Path(__file__).parent / "model.joblib"

app = FastAPI(title="Guardify Scoring API")


class ScoreRequest(BaseModel):
    url: Optional[str] = None
    title: str
    description: str
    priceText: Optional[str] = None
    imageCount: int
    reviewCount: int
    imageAveragePixels: Optional[int] = None
    imageLowResCount: Optional[int] = None


def parse_price(price_text: Optional[str]) -> float:
    if not price_text:
        return 0.0
    filtered = "".join([c for c in price_text if c.isdigit() or c == "."])
    try:
        return float(filtered)
    except ValueError:
        return 0.0


def repetition_score(text: str) -> float:
    if not text:
        return 0.0
    tokens = [t for t in "".join([c.lower() if c.isalnum() else " " for c in text]).split() if t]
    if not tokens:
        return 0.0
    unique = len(set(tokens))
    return 1.0 - (unique / len(tokens))


def uppercase_ratio(text: str) -> float:
    if not text:
        return 0.0
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    upper = sum(1 for c in letters if c.isupper())
    return upper / len(letters)


SCAM_KEYWORDS = [
    "limited stock",
    "best offer",
    "free trial",
    "exclusive",
    "guaranteed",
    "order now",
    "act now",
    "no other product",
    "100%",
]


def scam_keyword_count(text: str) -> int:
    if not text:
        return 0
    lower = text.lower()
    return sum(1 for kw in SCAM_KEYWORDS if kw in lower)


@app.on_event("startup")
async def load_model():
    if not MODEL_PATH.exists():
        app.state.model = None
        return
    payload = joblib.load(MODEL_PATH)
    app.state.model = payload["model"]


@app.post("/score")
def score(req: ScoreRequest):
    if not app.state.model:
        return {"score": 0, "risk": "Low", "flags": ["Model not loaded"]}

    price = parse_price(req.priceText)
    description = req.description or ""
    title = req.title or ""
    desc_length = len(description)
    rep = repetition_score(description)
    title_length = len(title)
    exclamation_count = description.count("!")
    upper_ratio = uppercase_ratio(description)
    keyword_count = scam_keyword_count(description)

    features = {
        "title": title,
        "description": description,
        "price": price,
        "image_count": req.imageCount,
        "review_count": req.reviewCount,
        "desc_length": desc_length,
        "title_length": title_length,
        "repetition_score": rep,
        "exclamation_count": exclamation_count,
        "upper_ratio": upper_ratio,
        "scam_keyword_count": keyword_count,
    }

    if req.imageAveragePixels is not None:
        features["image_avg_pixels"] = req.imageAveragePixels
    if req.imageLowResCount is not None:
        features["image_low_res_count"] = req.imageLowResCount

    proba = app.state.model.predict_proba([features])[0][1]
    score_value = int(round(proba * 100))

    if score_value >= 65:
        risk = "High"
    elif score_value >= 35:
        risk = "Medium"
    else:
        risk = "Low"

    return {"score": score_value, "risk": risk, "flags": []}
