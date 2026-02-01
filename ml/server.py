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
    desc_length = len(req.description or "")
    rep = repetition_score(req.description or "")

    features = {
        "title": req.title or "",
        "description": req.description or "",
        "price": price,
        "image_count": req.imageCount,
        "review_count": req.reviewCount,
        "desc_length": desc_length,
        "repetition_score": rep,
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
