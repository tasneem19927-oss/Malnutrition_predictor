from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uvicorn
import logging
import os

# Import real XGBoost predictor
try:
    from xgboost_model import systemPredictor, classify_risk
    MODEL_DIR = os.environ.get("MODEL_DIR", "models")
    predictor = systemPredictor(model_dir=MODEL_DIR)
    MODELS_LOADED = predictor.models_loaded
except Exception as e:
    logging.warning(f"Could not load XGBoost models: {e}. Falling back to heuristic mode.")
    predictor = None
    MODELS_LOADED = False

app = FastAPI(
    title="Child Malnutrition Prediction API",
    version="2.0.0",
    description="AI-powered malnutrition prediction for children aged 0-60 months"
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_VERSION = "2.0.0"
prediction_count = 0
api_start_time = datetime.now()


class PredictionInput(BaseModel):
    child_id: Optional[str] = None
    age_months: float
    sex: str
    weight_kg: float
    height_cm: float
    muac_cm: Optional[float] = None
    haz: Optional[float] = None
    whz: Optional[float] = None
    waz: Optional[float] = None


class BatchPredictionInput(BaseModel):
    children: List[PredictionInput]


def to_percentage(prob: float) -> float:
    return round(float(prob) * 100, 2)


def classify_severity_from_zscore(z_score: Optional[float], condition: str) -> Optional[str]:
    if z_score is None:
        return None
    if z_score >= -2:
        return "Normal"
    elif -3 <= z_score < -2:
        return "Moderate"
    else:
        if condition == "wasting":
            return "Acute"
        return "Severe"


def heuristic_prediction(data: PredictionInput) -> Dict[str, float]:
    """Fallback heuristic when XGBoost models are not loaded."""
    stunting_prob = 0.15
    wasting_prob = 0.10
    underweight_prob = 0.12

    if data.haz is not None:
        if data.haz < -3:
            stunting_prob = 0.85
        elif data.haz < -2:
            stunting_prob = 0.60
        else:
            stunting_prob = 0.10

    if data.whz is not None:
        if data.whz < -3:
            wasting_prob = 0.90
        elif data.whz < -2:
            wasting_prob = 0.65
        else:
            wasting_prob = 0.08

    if data.waz is not None:
        if data.waz < -3:
            underweight_prob = 0.88
        elif data.waz < -2:
            underweight_prob = 0.58
        else:
            underweight_prob = 0.09

    if data.muac_cm is not None and data.muac_cm < 11.5:
        wasting_prob = max(wasting_prob, 0.95)

    return {"stunting": stunting_prob, "wasting": wasting_prob, "underweight": underweight_prob}


def run_prediction(data: PredictionInput) -> Dict[str, float]:
    """Use real XGBoost model if loaded, otherwise fallback to heuristic."""
    if predictor is not None and MODELS_LOADED:
        try:
            import pandas as pd
            row = {
                "age_months": data.age_months,
                "sex": data.sex,
                "weight_kg": data.weight_kg,
                "height_cm": data.height_cm,
                "muac_cm": data.muac_cm if data.muac_cm is not None else 14.0,
                "haz": data.haz,
                "waz": data.waz,
                "whz": data.whz,
            }
            df = pd.DataFrame([row])
            result = predictor.predict(df)
            return {
                "stunting": result["stunting"]["probability"],
                "wasting": result["wasting"]["probability"],
                "underweight": result["underweight"]["probability"],
            }
        except Exception as e:
            logger.warning(f"XGBoost prediction failed: {e}. Using heuristic fallback.")
    return heuristic_prediction(data)


def build_condition_result(prob: float, z_score: Optional[float], condition: str) -> Dict[str, Any]:
    severity = classify_severity_from_zscore(z_score, condition)
    if severity is None:
        if prob < 0.25:
            severity = "Normal"
        elif prob < 0.50:
            severity = "Moderate"
        else:
            severity = "Acute" if condition == "wasting" else "Severe"
    return {
        "probability": to_percentage(prob),
        "severity": severity,
        "risk_level": classify_risk(prob) if MODELS_LOADED else None,
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "name": "Child Malnutrition Prediction API",
        "version": API_VERSION,
        "models_loaded": MODELS_LOADED,
        "description": "AI-powered malnutrition prediction for children aged 0-60 months",
        "endpoints": {
            "predict": "POST /predict",
            "batch_predict": "POST /predict/batch",
            "health": "GET /health",
            "stats": "GET /stats",
        },
    }


@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "version": API_VERSION,
        "models_loaded": MODELS_LOADED,
        "started_at": api_start_time.isoformat(),
    }


@app.get("/stats", tags=["System"])
async def get_stats():
    uptime = (datetime.now() - api_start_time).total_seconds()
    return {
        "total_predictions": prediction_count,
        "predictions_per_hour": round(prediction_count / (uptime / 3600), 1) if uptime > 0 else 0,
        "api_version": API_VERSION,
        "models_loaded": MODELS_LOADED,
        "uptime_seconds": round(uptime, 1),
        "started_at": api_start_time.isoformat(),
    }


@app.post("/predict", tags=["Prediction"])
async def predict(data: PredictionInput):
    global prediction_count
    try:
        model_outputs = run_prediction(data)
        response = {
            "child_id": data.child_id,
            "predictions": {
                "stunting": build_condition_result(model_outputs["stunting"], data.haz, "stunting"),
                "wasting": build_condition_result(model_outputs["wasting"], data.whz, "wasting"),
                "underweight": build_condition_result(model_outputs["underweight"], data.waz, "underweight"),
            },
            "model_used": "xgboost" if MODELS_LOADED else "heuristic",
            "processed_at": datetime.now().isoformat(),
        }
        prediction_count += 1
        return response
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/predict/batch", tags=["Prediction"])
async def batch_predict(batch: BatchPredictionInput):
    global prediction_count
    try:
        responses = []
        for child in batch.children:
            model_outputs = run_prediction(child)
            result = {
                "child_id": child.child_id,
                "predictions": {
                    "stunting": build_condition_result(model_outputs["stunting"], child.haz, "stunting"),
                    "wasting": build_condition_result(model_outputs["wasting"], child.whz, "wasting"),
                    "underweight": build_condition_result(model_outputs["underweight"], child.waz, "underweight"),
                },
                "model_used": "xgboost" if MODELS_LOADED else "heuristic",
                "processed_at": datetime.now().isoformat(),
            }
            responses.append(result)
        prediction_count += len(batch.children)
        return {
            "total": len(responses),
            "predictions": responses,
            "processed_at": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("prediction_api:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
