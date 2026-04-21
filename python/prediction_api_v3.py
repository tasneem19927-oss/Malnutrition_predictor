"""
Nizam - Production-Ready Malnutrition Prediction API
Version: 3.0.0 - Uses real XGBoost models + RAG retrieval
Author: Enhanced by ML Expert
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List
import logging
import os
from functools import lru_cache
import numpy as np
from datetime import datetime

# استيراد النموذج الحقيقي
from xgboost_model import NizamModel, engineer_features, classify_risk, FEATURE_COLUMNS, compute_anthropometric_indices, classify_severity
try:
    from rag_system import ClinicalRAG
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    logging.warning("RAG system not available")

# ========================
# Logging Setup
# ========================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("nizam.api")

app = FastAPI(
    title="Child Malnutrition Prediction API",
    version="3.0.0",
    description="Production-ready API for malnutrition prediction using XGBoost + RAG"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # في الإنتاج: قصّر على domains محددة
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================
# Model Registry (Singleton)
# ========================
class ModelRegistry:
    """
    تحميل النماذج مرة واحدة عند بدء التطبيق.
    CRITICAL: لا تحمّل النماذج في كل request — يستهلك ذاكرة ويبطئ النظام.
    """
    _instance = None
    _models: Dict[str, NizamModel] = {}
    _rag: Optional[any] = None
    _initialized: bool = False

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        if not cls._instance._initialized:
            cls._instance._load_all()
            cls._instance._initialized = True
        return cls._instance

    def _load_all(self):
        model_dir = os.environ.get("MODEL_DIR", "models")
        
        # تحميل نماذج XGBoost
        missing_models = []
        for target in ["stunting", "wasting", "underweight"]:
            model_path = os.path.join(model_dir, f"nizam_{target}_model.joblib")
            if not os.path.exists(model_path):
                missing_models.append(model_path)
                continue
            
            try:
                self._models[target] = NizamModel.load(target, model_dir)
                logger.info(f"✅ Loaded {target} model from {model_path}")
            except Exception as e:
                logger.error(f"❌ Failed to load {target} model: {e}")
                missing_models.append(model_path)

        if missing_models:
            error_msg = (
                f"Missing model files: {missing_models}\n"
                f"Run: python train_models.py --data nizam_sample_training_data.csv --output models"
            )
            raise RuntimeError(error_msg)

        # تحميل RAG (اختياري)
        if RAG_AVAILABLE:
            try:
                self._rag = ClinicalRAG()
                logger.info("✅ ClinicalRAG loaded")
            except Exception as e:
                logger.warning(f"⚠️ RAG not available: {e}")
                self._rag = None
        
        logger.info(f"🚀 Model Registry initialized with {len(self._models)} models")

    def predict(self, target: str, child_data: dict) -> tuple:
        """Returns (risk_label, probability)"""
        model = self._models.get(target)
        if model is None:
            raise ValueError(f"Model for '{target}' not loaded")
        return model.predict(child_data)

    @property
    def rag(self):
        return self._rag

    @property
    def is_ready(self) -> bool:
        return len(self._models) == 3

# ========================
# Startup Event
# ========================
@app.on_event("startup")
async def startup_event():
    try:
        ModelRegistry.get_instance()
        logger.info("✅ All models loaded successfully")
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise

# ========================
# Input/Output Schemas
# ========================
class ChildInput(BaseModel):
    """Input schema with comprehensive validation"""
    age_months: float = Field(..., ge=0, le=60, description="عمر الطفل بالأشهر (0-60)")
    sex: str = Field(..., pattern="^(male|female|ذكر|أنثى)$", description="جنس الطفل")
    weight_kg: float = Field(..., ge=0.5, le=30, description="وزن الطفل بالكيلوغرام")
    height_cm: float = Field(..., ge=30, le=130, description="طول/ارتفاع الطفل بالسنتيمتر")
    muac_cm: Optional[float] = Field(14.0, ge=6, le=25, description="محيط منتصف الذراع (MUAC)")
    region: Optional[str] = Field(None, description="المنطقة الجغرافية")
    clinical_notes: Optional[str] = Field(None, max_length=2000, description="ملاحظات سريرية")
    child_name: Optional[str] = Field("Unknown", description="اسم الطفل (اختياري)")

    @validator("sex")
    def normalize_sex(cls, v):
        sex_map = {"ذكر": "male", "أنثى": "female"}
        return sex_map.get(v, v.lower())

    class Config:
        schema_extra = {
            "example": {
                "age_months": 18,
                "sex": "female",
                "weight_kg": 7.2,
                "height_cm": 75.0,
                "muac_cm": 11.5,
                "region": "تعز",
                "clinical_notes": "الطفل يعاني من إسهال متكرر",
                "child_name": "فاطمة"
            }
        }

class PredictionOutput(BaseModel):
    # Prediction results
    stunting_prob: float = Field(..., description="احتمال التقزم (0-1)")
    wasting_prob: float = Field(..., description="احتمال الهزال (0-1)")
    underweight_prob: float = Field(..., description="احتمال نقص الوزن (0-1)")
    
    stunting_risk: str = Field(..., description="مستوى خطر التقزم (low/moderate/high/critical)")
    wasting_risk: str = Field(..., description="مستوى خطر الهزال")
    underweight_risk: str = Field(..., description="مستوى خطر نقص الوزن")
    
    overall_risk: str = Field(..., description="التقييم الإجمالي")
    priority_condition: str = Field(..., description="الحالة ذات الأولوية")
    
    # WHO Z-scores and severity
    z_scores: Dict[str, float] = Field(..., description="Z-scores (HAZ, WAZ, WHZ)")
    severity_classification: Dict[str, str] = Field(..., description="تصنيف الشدة حسب WHO")
    
    # RAG evidence (optional)
    rag_summary: Optional[Dict] = Field(None, description="ملخص الأدلة العلمية من RAG")
    
    # Metadata
    model_version: str = "3.0.0"
    prediction_timestamp: str
    disclaimer: str = "هذا النظام أداة مساعدة للقرار الطبي فقط، وليس بديلاً عن التشخيص الطبي المتخصص"

# ========================
# Health Check Endpoint
# ========================
@app.get("/health")
async def health_check():
    registry = ModelRegistry.get_instance()
    return {
        "status": "healthy" if registry.is_ready else "degraded",
        "models_loaded": len(registry._models),
        "rag_available": RAG_AVAILABLE and registry.rag is not None,
        "version": "3.0.0"
    }

# ========================
# Main Prediction Endpoint
# ========================
@app.post("/predict", response_model=PredictionOutput, status_code=status.HTTP_200_OK)
async def predict(child: ChildInput):
    """
    التنبؤ بسوء التغذية باستخدام نماذج XGBoost المدربة + RAG.
    """
    registry = ModelRegistry.get_instance()
    child_dict = child.dict()

    # -- Step 1: Model Predictions --
    try:
        results = {}
        for target in ["stunting", "wasting", "underweight"]:
            risk_label, probability = registry.predict(target, child_dict)
            results[f"{target}_prob"] = round(float(probability), 4)
            results[f"{target}_risk"] = risk_label

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Model prediction failed: {str(e)}"
        )

    # -- Step 2: Overall Risk Aggregation --
    risk_order = {"low": 0, "moderate": 1, "high": 2, "critical": 3}
    max_risk = max(
        results["stunting_risk"],
        results["wasting_risk"],
        results["underweight_risk"],
        key=lambda r: risk_order.get(r, 0)
    )
    
    # Priority = الأعلى احتمالاً
    probs = {
        "stunting": results["stunting_prob"],
        "wasting": results["wasting_prob"],
        "underweight": results["underweight_prob"]
    }
    priority = max(probs, key=probs.get)

    # -- Step 3: Compute Z-Scores and WHO Severity --
    z_scores = compute_anthropometric_indices(
        child.age_months, child.sex, 
        child.weight_kg, child.height_cm, child.muac_cm
    )
    
    severity_classification = {
        "stunting": classify_severity(z_scores["haz"], "stunting"),
        "wasting": classify_severity(z_scores["whz"], "wasting", child.muac_cm),
        "underweight": classify_severity(z_scores["waz"], "underweight")
    }

    # -- Step 4: RAG Retrieval (Optional) --
    rag_output = None
    if registry.rag:
        class _PredAdapter:  # Adapter لتنسيق البيانات
            stunting_risk = results["stunting_risk"]
            wasting_risk = results["wasting_risk"]
            underweight_risk = results["underweight_risk"]
            overall_risk = max_risk

        try:
            rag_resp = registry.rag.query(
                child_dict, _PredAdapter(), 
                clinical_notes=child.clinical_notes
            )
            rag_output = rag_resp.to_dict()
        except Exception as e:
            logger.warning(f"RAG query failed: {e}")
            rag_output = {"error": str(e)}

    # -- Step 5: Build Response --
    return PredictionOutput(
        **results,
        overall_risk=max_risk,
        priority_condition=priority,
        z_scores=z_scores,
        severity_classification=severity_classification,
        rag_summary=rag_output,
        prediction_timestamp=datetime.utcnow().isoformat()
    )

# ========================
# Batch Prediction Endpoint
# ========================
@app.post("/predict/batch")
async def predict_batch(children: List[ChildInput]):
    """
    التنبؤ لعدة أطفال دفعة واحدة (مفيد للدراسات الميدانية)
