"""
system Enhanced Prediction API
محطة API محسّنة للتنبؤ بسوء التغذية تجمع بين:
- نموذج XGBoost للتنبؤ
- نظام Clinical RAG للأدلة العلمية (WHO 2023/2024 + مراجعات حديثة)
Author: system AI Team
Version: 3.0.0
"""
import json
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from rag_system import ClinicalRAG   # النسخة الجديدة
# من المفترض أن لديك خدمة ML XGBoost موجودة؛ هنا نستخدم واجهة مبسطة
# يمكنك استبدال MLService بالتنفيذ الفعلي الموجود لديك.
# from ml_service import MLService


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)


# =========================
# نماذج الإدخال والإخراج
# =========================

class PredictRequest(BaseModel):
    """طلب تنبؤ لطفل واحد"""
    child_name: str = Field(..., min_length=1, max_length=200, example="Amara Osei")
    age_months: int = Field(..., ge=0, le=60, description="العمر بالأشهر (0-60)", example=18)
    sex: str = Field(..., regex="^(male|female)$", description="جنس الطفل", example="female")
    weight_kg: float = Field(..., gt=0, lt=50, description="الوزن بالكيلوغرام", example=8.2)
    height_cm: float = Field(..., gt=20, lt=150, description="الطول بالسنتيمتر", example=76.5)
    muac_cm: float = Field(..., gt=5, lt=35, description="محيط منتصف العضد بالسنتيمتر", example=12.8)
    region: Optional[str] = Field(None, max_length=200, example="Central Region")
    notes: Optional[str] = Field(None, max_length=1000)


class ClinicalRAGSummary(BaseModel):
    """ملخص RAG السريري المنظم"""
    priority_condition: Optional[str]
    summary: str
    rationale: str
    red_flags: List[str]
    suggested_action: str
    citations: List[str]
    evidence: List[Dict[str, Any]]
    generated_at: str


class EnhancedPredictionResponse(BaseModel):
    """
    استجابة التنبؤ المحسّن:
    - احتمالات XGBoost
    - ملخص سريري منظم من RAG
    - حزمة الأدلة المسترجعة
    - رسالة أمان واضحة
    """
    # بيانات الطفل
    child_name: str
    age_months: int
    sex: str
    weight_kg: float
    height_cm: float
    muac_cm: float

    # نتائج ML
    stunting_probability: float
    wasting_probability: float
    underweight_probability: float
    stunting_risk: str
    wasting_risk: str
    underweight_risk: str
    overall_risk: str

    # قيم مساعدة (اختيارية)
    haz: Optional[float] = None
    waz: Optional[float] = None
    whz: Optional[float] = None

    # ملخص RAG السريري
    clinical_rag_summary: ClinicalRAGSummary

    # حزمة الأدلة
    evidence_bundle: List[Dict[str, Any]]

    # رسالة أمان
    safety_notice: str

    # طابع زمني
    predicted_at: str


class ModelInput(BaseModel):
    """بيانات الإدخال الخام لنموذج XGBoost"""
    age_months: float
    sex: int  # 0=female, 1=male
    weight_kg: float
    height_cm: float
    muac_cm: float


# =========================
# تهيئة التطبيق
# =========================

app = FastAPI(
    title="system Enhanced Prediction API",
    description="""
واجهة API محسّنة تجمع بين:
- نموذج XGBoost للتنبؤ بسوء التغذية
- Clinical RAG مبني على WHO 2023/2024 والأدلة المحكمة ذات الصلة

هذا النظام يوفّر **دعم قرار** فقط، وليس بديلاً عن الحكم السريري.
""",
    version="3.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# مسارات الملفات
KNOWLEDGE_BASE_PATH = os.environ.get("KNOWLEDGE_BASE_PATH", "python/knowledge_base.json")

# خدمات عالمية
rag: Optional[ClinicalRAG] = None
# ml_service = MLService()  # فعّل هذا عندما تربط خدمة XGBoost الفعلية


# =========================
# دوال مساعدة
# =========================

def prepare_model_input(data: Dict[str, Any]) -> ModelInput:
    """تحويل بيانات الإدخال إلى صيغة نموذج XGBoost"""
    return ModelInput(
        age_months=float(data.get("age_months", 0)),
        sex=1 if data.get("sex", "male").lower() == "male" else 0,
        weight_kg=float(data.get("weight_kg", 0)),
        height_cm=float(data.get("height_cm", 0)),
        muac_cm=float(data.get("muac_cm", 0)),
    )


def classify_risk(probability: float) -> str:
    """تصنيف المخاطر بناءً على الاحتمالية"""
    if probability >= 0.75:
        return "critical"
    elif probability >= 0.5:
        return "high"
    elif probability >= 0.25:
        return "moderate"
    else:
        return "low"


def get_overall_risk(stunting: float, wasting: float, underweight: float) -> str:
    """تحديد مستوى المخاطر الإجمالي"""
    max_risk = max(stunting, wasting, underweight)
    return classify_risk(max_risk)


def simulate_xgboost_prediction(model_input: ModelInput) -> Dict[str, float]:
    """
    محاكاة لتنبؤ XGBoost (استبدليها بمناداة النموذج الفعلي في مشروعك).
    """
    stunting_prob = 1.0 / (1.0 + np.exp(-(0.5 * model_input.age_months - 2.0)))
    wasting_prob = 1.0 / (1.0 + np.exp(-(3.0 * (14.0 - model_input.muac_cm))))
    underweight_prob = 1.0 / (1.0 + np.exp(-(0.8 * model_input.weight_kg - 5.0)))

    return {
        "stunting_probability": float(stunting_prob),
        "wasting_probability": float(wasting_prob),
        "underweight_probability": float(underweight_prob),
    }


# =========================
# Startup / Shutdown
# =========================

@app.on_event("startup")
async def startup_event():
    global rag
    logger.info("=" * 60)
    logger.info(" system Enhanced Prediction API (RAG-integrated) starting up...")
    logger.info(" Version: 3.0.0")
    logger.info("=" * 60)

    try:
        rag = ClinicalRAG(kb_path=KNOWLEDGE_BASE_PATH)
        logger.info("ClinicalRAG initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize ClinicalRAG: {e}")
        rag = None


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("system Enhanced Prediction API shutting down.")


# =========================
# نقاط نهاية API
# =========================

@app.post("/predict/enhanced", response_model=EnhancedPredictionResponse, tags=["Enhanced"])
async def predict_enhanced(data: PredictRequest):
    """
    نقطة نهاية تجمع:
    - تنبؤ XGBoost لاحتمالات stunting/wasting/underweight
    - بناء Clinical Query من بيانات الطفل
    - استرجاع أدلة WHO 2023/2024 والمراجعات المحكمة عبر ClinicalRAG
    - توليد ملخص سريري منظم بدون خطة علاج حرّة
    """
    if rag is None:
        raise HTTPException(
            status_code=503,
            detail="ClinicalRAG not initialized; knowledge base unavailable.",
        )

    try:
        # 1) نموذج XGBoost ينتج الاحتمالات
        model_input = prepare_model_input(data.dict(exclude={"region", "notes"}))

        # TODO: استبدلي simulate_xgboost_prediction باستدعاء ml_service.predict(...)
        # prediction = ml_service.predict(model_input.dict())
        prediction = simulate_xgboost_prediction(model_input)

        stunting_prob = prediction["stunting_probability"]
        wasting_prob = prediction["wasting_probability"]
        underweight_prob = prediction["underweight_probability"]

        stunting_risk = classify_risk(stunting_prob)
        wasting_risk = classify_risk(wasting_prob)
        underweight_risk = classify_risk(underweight_prob)
        overall_risk = get_overall_risk(stunting_prob, wasting_prob, underweight_prob)

        priority_condition = max(
            ["stunting", "wasting", "underweight"],
            key=lambda k: prediction.get(f"{k}_probability", 0.0),
        )

        prediction_context = {
            "stunting_risk": stunting_prob,
            "wasting_risk": wasting_prob,
            "underweight_risk": underweight_prob,
            "priority_condition": priority_condition,
        }

        # 2) محرك سريري يبني Clinical Query
        child_dict = data.dict()
        clinical_query = rag.build_clinical_query(child_dict, prediction_context)

        # 3) RAG يسترجع مقاطع موثقة من WHO 2023/2024 + مراجعات
        filters = {
            "topic": [priority_condition, "feeding", "referral"],
            "population": ["under_5", "6_59_months"],
            "severity": ["any", "moderate", "high", "critical"],
        }
        retrieved = rag.retrieve(
            query=clinical_query,
            top_k=5,
            filters=filters,
            min_score=0.25,
        )

        # 4) المولد النصي ينتج فقط ملخص سريري منظم + rationale + red_flags + suggested_action + citations
        clinical_brief_dict = rag.generate_clinical_brief(child_dict, prediction_context, retrieved)
        clinical_brief = ClinicalRAGSummary(**clinical_brief_dict)

        # 5) evidence_bundle منفصل للواجهة أو السجلات
        evidence_bundle = clinical_brief_dict.get("evidence", [])

        # حساب مؤشرات مساعدة مبسطة (يمكنك استبدالها بقيم WHZ/WAZ/HFA الحقيقية)
        haz = round((model_input.height_cm / 100 - 0.8) / 0.1, 2) if model_input.height_cm > 0 else None
        waz = round((model_input.weight_kg - 10) / 2, 2)
        whz = round((model_input.height_cm - 75) / 10, 2)

        return EnhancedPredictionResponse(
            child_name=data.child_name,
            age_months=data.age_months,
            sex=data.sex,
            weight_kg=data.weight_kg,
            height_cm=data.height_cm,
            muac_cm=data.muac_cm,
            stunting_probability=round(stunting_prob, 3),
            wasting_probability=round(wasting_prob, 3),
            underweight_probability=round(underweight_prob, 3),
            stunting_risk=stunting_risk,
            wasting_risk=wasting_risk,
            underweight_risk=underweight_risk,
            overall_risk=overall_risk,
            haz=haz,
            waz=waz,
            whz=whz,
            clinical_rag_summary=clinical_brief,
            evidence_bundle=evidence_bundle,
            safety_notice=(
                "Decision-support only; not a substitute for clinical judgment. "
                "All actions must follow WHO 2023/2024 guideline on wasting and nutritional oedema "
                "and national malnutrition protocols."
            ),
            predicted_at=datetime.now().isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enhanced prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Enhanced prediction failed: {str(e)}")


@app.get("/health", tags=["System"])
async def health_check():
    """فحص حالة الخدمات المحسّنة"""
    return {
        "status": "healthy",
        "rag_loaded": rag is not None,
        "knowledge_base_path": KNOWLEDGE_BASE_PATH,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/models/info", tags=["Models"])
async def model_info():
    """معلومات النماذج المحمّلة"""
    return {
        "clinical_rag": "loaded" if rag is not None else "not_loaded",
        "model_version": "XGBoost + ClinicalRAG 3.0.0",
    }


if __name__ == "__main__":
    uvicorn.run(
        "enhanced_prediction_api:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )
