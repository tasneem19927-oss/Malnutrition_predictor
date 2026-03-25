"""
Nizam - Child Malnutrition Prediction System
Prediction REST API

A production-ready REST API using FastAPI that exposes Nizam's
XGBoost malnutrition prediction models over HTTP.

Endpoints:
    POST /predict          - Predict for a single child
    POST /predict/batch    - Predict for multiple children
    GET  /health           - Health check
    GET  /models/info      - Model information and metrics
    GET  /stats            - Prediction statistics

Usage:
    # Start server (development)
    uvicorn prediction_api:app --reload --port 8000

    # Start server (production)
    uvicorn prediction_api:app --host 0.0.0.0 --port 8000 --workers 4

    # With gunicorn
    gunicorn prediction_api:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

Author: Nizam AI Team
Version: 1.0.0
"""

import os
import sys
import time
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
import uvicorn

from xgboost_model import NizamPredictor, PredictionResult
from rag_system import NizamRAG
from biobert_mobile import BioBERTMobile
from enhanced_prediction_api import EnhancedPredictionAPI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("nizam.api")

# API Configuration
API_VERSION = "1.0.0"
MODEL_DIR = os.environ.get("NIZAM_MODEL_DIR", "models")
HOST = os.environ.get("NIZAM_HOST", "0.0.0.0")
PORT = int(os.environ.get("NIZAM_PORT", "8000"))

# Initialize FastAPI app
app = FastAPI(
    title="Nizam Child Malnutrition Prediction API",
    description="""
    Nizam is an AI-powered child malnutrition prediction system that uses
    XGBoost to predict stunting, wasting, and underweight in children aged 0-60 months.

    ## Features
    - **Stunting prediction** (chronic malnutrition: HAZ < -2 SD)
    - **Wasting prediction** (acute malnutrition: WHZ < -2 SD)
    - **Underweight prediction** (WAZ < -2 SD)
    - **Overall risk classification** (low, moderate, high, critical)
    - **Batch prediction** for multiple children
    - **WHO z-score estimation**
    """,
    version=API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
predictor: Optional[NizamPredictor] = None
prediction_count = 0
api_start_time = datetime.now()


# =====================================================================
# Pydantic Models (Request/Response schemas)
# =====================================================================

class ChildInput(BaseModel):
    """Input data for a single child prediction."""
    child_name: str = Field(..., min_length=1, max_length=200, example="Amara Osei")
    age_months: int = Field(..., ge=0, le=60, description="Age in months (0-60)", example=18)
    sex: str = Field(..., regex="^(male|female)$", description="Child's sex", example="female")
    weight_kg: float = Field(..., gt=0, lt=50, description="Weight in kilograms", example=8.2)
    height_cm: float = Field(..., gt=20, lt=150, description="Height in centimeters", example=76.5)
    muac_cm: float = Field(..., gt=5, lt=35, description="Mid-Upper Arm Circumference in cm", example=12.8)
    region: Optional[str] = Field(None, max_length=200, example="Central Region")
    notes: Optional[str] = Field(None, max_length=1000)

    @validator("sex")
    def lowercase_sex(cls, v):
        return v.lower()

    class Config:
        json_schema_extra = {
            "example": {
                "child_name": "Amara Osei",
                "age_months": 18,
                "sex": "female",
                "weight_kg": 8.2,
                "height_cm": 76.5,
                "muac_cm": 12.8,
                "region": "Central Region"
            }
        }


class BatchInput(BaseModel):
    """Input for batch prediction of multiple children."""
    children: List[ChildInput] = Field(..., min_items=1, max_items=500)


class PredictionResponse(BaseModel):
    """Response from a single prediction."""
    child_name: str
    age_months: int
    sex: str
    weight_kg: float
    height_cm: float
    muac_cm: float

    stunting_risk: str
    stunting_probability: float
    wasting_risk: str
    wasting_probability: float
    underweight_risk: str
    underweight_probability: float
    overall_risk: str

    haz: Optional[float] = None
    waz: Optional[float] = None
    whz: Optional[float] = None

    predicted_at: str

    class Config:
        json_schema_extra = {
            "example": {
                "child_name": "Amara Osei",
                "age_months": 18,
                "sex": "female",
                "weight_kg": 8.2,
                "height_cm": 76.5,
                "muac_cm": 12.8,
                "stunting_risk": "high",
                "stunting_probability": 0.72,
                "wasting_risk": "moderate",
                "wasting_probability": 0.38,
                "underweight_risk": "high",
                "underweight_probability": 0.65,
                "overall_risk": "high",
                "haz": -2.41,
                "waz": -1.87,
                "whz": -0.94,
                "predicted_at": "2025-01-01T12:00:00"
            }
        }


class BatchPredictionResponse(BaseModel):
    """Response from a batch prediction."""
    total: int
    predictions: List[PredictionResponse]
    summary: Dict[str, int]
    high_risk_children: List[str]
    processed_at: str


class HealthResponse(BaseModel):
    """API health check response."""
    status: str
    version: str
    models_loaded: bool
    uptime_seconds: float
    total_predictions: int
    timestamp: str


class ModelInfoResponse(BaseModel):
    """Model information and metrics."""
    version: str
    models: Dict[str, Any]
    features: List[str]


# =====================================================================
# Startup / Shutdown Events
# =====================================================================

@app.on_event("startup")
async def startup_event():
    """Load models on API startup."""
    global predictor, enhanced_api
    logger.info("=" * 60)
    logger.info("  Nizam Prediction API starting up...")
    logger.info(f"  Version: {API_VERSION}")
    logger.info(f"  Model directory: {MODEL_DIR}")
    logger.info("=" * 60)

    try:
        predictor = NizamPredictor(model_dir=MODEL_DIR)
        predictor.load_all()
                try:
            enhanced_api = EnhancedPredictionAPI()
            logger.info("Enhanced prediction services (RAG + BioBERT) loaded.")
        except Exception as e:
            logger.warning(f"Enhanced prediction services failed to load: {e}")

        logger.info("All models loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load models: {e}")
        logger.warning("API will start but predictions will fail until models are loaded.")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Nizam API shutting down.")


# =====================================================================
# Middleware - Request logging
# =====================================================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    logger.info(f"{request.method} {request.url.path} - {response.status_code} ({elapsed:.3f}s)")
    return response


# =====================================================================
# Helper Functions
# =====================================================================

def result_to_response(result: PredictionResult) -> PredictionResponse:
    return PredictionResponse(
        child_name=result.child_name,
        age_months=result.age_months,
        sex=result.sex,
        weight_kg=result.weight_kg,
        height_cm=result.height_cm,
        muac_cm=result.muac_cm,
        stunting_risk=result.stunting_risk,
        stunting_probability=result.stunting_probability,
        wasting_risk=result.wasting_risk,
        wasting_probability=result.wasting_probability,
        underweight_risk=result.underweight_risk,
        underweight_probability=result.underweight_probability,
        overall_risk=result.overall_risk,
        haz=result.haz,
        waz=result.waz,
        whz=result.whz,
        predicted_at=datetime.now().isoformat(),
    )


def get_predictor() -> NizamPredictor:
    if predictor is None or not predictor.models:
        raise HTTPException(
            status_code=503,
            detail="Models not loaded. Please ensure models are trained and available."
        )
    return predictor


# =====================================================================
# API Endpoints
# =====================================================================

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check API health and model status."""
    uptime = (datetime.now() - api_start_time).total_seconds()
    models_loaded = predictor is not None and bool(predictor.models)
    return HealthResponse(
        status="healthy" if models_loaded else "degraded",
        version=API_VERSION,
        models_loaded=models_loaded,
        uptime_seconds=round(uptime, 1),
        total_predictions=prediction_count,
        timestamp=datetime.now().isoformat(),
    )


@app.get("/models/info", response_model=ModelInfoResponse, tags=["Models"])
async def model_info():
    """Get information about loaded models and their performance metrics."""
    pred = get_predictor()
    models_info = {}
    for target, model in pred.models.items():
        info = {
            "target": target,
            "version": model.version,
            "feature_count": len(model.feature_columns),
        }
        if model.metrics:
            info["metrics"] = model.metrics.to_dict()
        models_info[target] = info

    return ModelInfoResponse(
        version=API_VERSION,
        models=models_info,
        features=pred.models["stunting"].feature_columns if "stunting" in pred.models else [],
    )


@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
async def predict_single(child: ChildInput):
    """
    Predict malnutrition risk for a single child.

    Returns risk classifications and probabilities for:
    - Stunting (chronic malnutrition)
    - Wasting (acute malnutrition)
    - Underweight
    - Overall risk level
    """
    global prediction_count
    pred = get_predictor()

    child_data = child.dict(exclude={"region", "notes"})

    try:
        result = pred.predict(child_data)
        prediction_count += 1
        return result_to_response(result)
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/predict/batch", response_model=BatchPredictionResponse, tags=["Prediction"])
async def predict_batch(batch: BatchInput):
    """
    Predict malnutrition risk for multiple children at once.

    Returns individual predictions plus a summary with:
    - Risk distribution counts
    - List of high-risk children needing urgent intervention
    """
    global prediction_count
    pred = get_predictor()

    responses = []
    risk_counts = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
    high_risk_children = []

    try:
        for child in batch.children:
            child_data = child.dict(exclude={"region", "notes"})
            result = pred.predict(child_data)
            response = result_to_response(result)
            responses.append(response)
            risk_counts[result.overall_risk] = risk_counts.get(result.overall_risk, 0) + 1
            if result.overall_risk in ("high", "critical"):
                high_risk_children.append(result.child_name)
            prediction_count += 1

        return BatchPredictionResponse(
            total=len(responses),
            predictions=responses,
            summary=risk_counts,
            high_risk_children=high_risk_children,
            processed_at=datetime.now().isoformat(),
        )
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")


@app.get("/stats", tags=["System"])
async def get_stats():
    """Get API usage statistics."""
    uptime = (datetime.now() - api_start_time).total_seconds()
    return {
        "total_predictions": prediction_count,
        "predictions_per_hour": round(prediction_count / (uptime / 3600), 1) if uptime > 0 else 0,
        "api_version": API_VERSION,
        "uptime_seconds": round(uptime, 1),
        "started_at": api_start_time.isoformat(),
    }


@app.get("/", tags=["System"]
         
    
async def root():
    """API root - returns basic information."""
    return {
        "name": "Nizam Child Malnutrition Prediction API",
        "version": API_VERSION,
        "description": "AI-powered malnutrition prediction for children aged 0-60 months",
        "endpoints": {
            "predict": "POST /predict",
            "batch_predict": "POST /predict/batch",
            "health": "GET /health",
            "models": "GET /models/info",
            "docs": "GET /docs",
        }
    }

@app.get("/predict/enhanced", tags=["Enhanced Prediction"])
async def predict_enhanced():
    """
    Enhanced prediction endpoint using RAG + BioBERT.
    Returns ML prediction + scientific evidence + medical entities.
    """
    global enhanced_api
    if enhanced_api is None:
        raise HTTPException(
            status_code=503,
            detail="Enhanced prediction services not loaded."
        )
    try:
        result = await enhanced_api.get_prediction_summary()
        return {
            "status": "success",
            "data": result,
            "components": ["ml_prediction", "rag_evidence", "medical_entities"]
        }
    except Exception as e:
        logger.error(f"Enhanced prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Enhanced prediction failed: {str(e)}")

enhanced_api: Optional[EnhancedPredictionAPI] = None

# =====================================================================
# Run server
# =====================================================================

if __name__ == "__main__":
    uvicorn.run(
        "prediction_api:app",
        host=HOST,
        port=PORT,
        reload=False,
        log_level="info",
    )
