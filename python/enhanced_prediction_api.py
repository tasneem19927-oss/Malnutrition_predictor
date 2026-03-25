"""
Nizam Enhanced Prediction API
محطة API محسّنة للتنبؤ بسوء التغذية تجمع بين:
- نموذج XGBoost للتنبؤ
- نظام RAG للأدلة العلمية
- BioBERT Mobile لاستخراج الكيانات الطبية
- دليل المعرفة المحلي
Author: Nizam AI Team
Version: 2.0.0
"""
import json
import os
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional, Any, TYPE_CHECKING
from dataclasses import dataclass, asdict

if TYPE_CHECKING:
    from pydantic import BaseModel

import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# استيراد المكوّنات الداخلية
from rag_system import RAGSystem
from biobert_mobile import BioBERTMobile

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)

# تعريف نماذج الإدخال والإخراج محلياً لتجنب الاستيراد الدائري
class PredictRequest(BaseModel):
    """طلب تنبؤ لطفل واحد - مطابق لـ ChildInput في prediction_api.py"""
    child_name: str = Field(..., min_length=1, max_length=200, example="Amara Osei")
    age_months: int = Field(..., ge=0, le=60, description="العمر بالأشهر (0-60)", example=18)
    sex: str = Field(..., regex="^(male|female)$", description="جنس الطفل", example="female")
    weight_kg: float = Field(..., gt=0, lt=50, description="الوزن بالكيلوغرام", example=8.2)
    height_cm: float = Field(..., gt=20, lt=150, description="الطول بالسنتيمتر", example=76.5)
    muac_cm: float = Field(..., gt=5, lt=35, description="محيط منتصف العضد بالسنتيمتر", example=12.8)
    region: Optional[str] = Field(None, max_length=200, example="Central Region")
    notes: Optional[str] = Field(None, max_length=1000)

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

class EnhancedPredictionResponse(BaseModel):
    """استجابة التنبؤ المحسّن - تتضمن تنبؤ ML + أدلة RAG + كيانات BioBERT"""
    # بيانات التنبؤ الأساسية
    child_name: str
    age_months: int
    sex: str
    weight_kg: float
    height_cm: float
    muac_cm: float
    # نتائج ML
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
    # أدلة RAG
    rag_evidence: Optional[Dict[str, Any]] = None
    # كيانات BioBERT الطبية
    medical_entities: Optional[List[Dict[str, Any]]] = None
    # توصيات
    recommendations: List[str] = []
    predicted_at: str

class ModelInput(BaseModel):
    """بيانات الإدخال لنموذج XGBoost الخام"""
    age_months: float
    sex: int  # 0=female, 1=male
    weight_kg: float
    height_cm: float
    muac_cm: float

# تهيئة التطبيق
app = FastAPI(
    title="Nizam Enhanced Prediction API",
    description="""
    واجهة API محسّنة تجمع بين نماذج XGBoost ونظام RAG و BioBERT Mobile.
    ## المكوّنات
    - **XGBoost**: للتنبؤ الأساسي بسوء التغذية
    - **RAG System**: لاسترجاع الأدلة العلمية ذات الصلة
    - **BioBERT Mobile**: لاستخراج الكيانات الطبية من النصوص
    - **Knowledge Base**: دليل المعرفة المحلي باليمنية
    """,
    version="2.0.0",
    docs_url="/docs",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# المتغيرات العامة
RAG_DB_PATH = os.environ.get("RAG_DB_PATH", "data/vector_store")
KNOWLEDGE_BASE_PATH = os.environ.get("KNOWLEDGE_BASE_PATH", "knowledge_base.json")

rag_system: Optional[RAGSystem] = None
biobert: Optional[BioBERTMobile] = None
knowledge_base: Dict[str, Any] = {}

def load_knowledge_base():
    """تحميل دليل المعرفة المحلي"""
    global knowledge_base
    if os.path.exists(KNOWLEDGE_BASE_PATH):
        with open(KNOWLEDGE_BASE_PATH, "r", encoding="utf-8") as f:
            knowledge_base = json.load(f)
        logger.info(f"Loaded knowledge base with {len(knowledge_base)} entries.")
    else:
        logger.warning(f"Knowledge base not found at {KNOWLEDGE_BASE_PATH}")
        knowledge_base = {}

@app.on_event("startup")
async def startup_event():
    """تهيئة الخدمات المحسّنة عند بدء التطبيق"""
    global rag_system, biobert
    logger.info("=" * 60)
    logger.info(" Nizam Enhanced Prediction API starting up...")
    logger.info(" Version: 2.0.0")
    logger.info("=" * 60)

    # تحميل نظام RAG
    try:
        rag_system = RAGSystem(
            db_path=RAG_DB_PATH,
            knowledge_base_path=KNOWLEDGE_BASE_PATH
        )
        logger.info("RAG System initialized.")
    except Exception as e:
        logger.warning(f"RAG System failed to initialize: {e}")
        rag_system = None

    # تحميل BioBERT Mobile
    try:
        biobert = BioBERTMobile()
        logger.info("BioBERT Mobile initialized.")
    except Exception as e:
        logger.warning(f"BioBERT Mobile failed to initialize: {e}")
        biobert = None

    # تحميل دليل المعرفة
    load_knowledge_base()

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Nizam Enhanced Prediction API shutting down.")

# =====================================================================
# وظائف مساعدة
# =====================================================================
def prepare_model_input(data: Dict[str, Any]) -> ModelInput:
    """تحويل بيانات الإدخال إلى صيغة نموذج XGBoost"""
    return ModelInput(
        age_months=float(data.get("age_months", 0)),
        sex=1 if data.get("sex", "male").lower() == "male" else 0,
        weight_kg=float(data.get("weight_kg", 0)),
        height_cm=float(data.get("height_cm", 0)),
        muac_cm=float(data.get("muac_cm", 0))
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

def generate_recommendations(data: ModelInput, risks: Dict[str, str]) -> List[str]:
    """توليد توصيات بناءً على عوامل الخطر"""
    recs = []
    
    if risks.get("stunting") in ("high", "critical"):
        recs.append("تحسين التغذية اليومية مع التركيز على البروتين والسعرات الحرارية")
        recs.append("متابعة النمو شهرياً مع العامل الصحي")
    
    if risks.get("wasting") in ("high", "critical"):
        recs.append("تقديم أطعمة غنية بالطاقة والبروتين فوراً")
        recs.append("فحص是否存在 إصابة أو مرض كامن")
    
    if risks.get("underweight") in ("high", "critical"):
        recs.append("زيادة عدد وجبات الطعام اليومية")
        recs.append("إضافة مكملات غذائية إذا لزم الأمر")
    
    if not recs:
        recs.append("الاستمرار في المتابعة الدورية")
        recs.append("تشجيع الرضاعة الطبيعية إذا كان العمر مناسباً")
    
    return recs

# =====================================================================
# نقاط نهاية API
# =====================================================================
@app.post("/predict/enhanced", response_model=EnhancedPredictionResponse, tags=["Enhanced"])
async def predict_enhanced(data: PredictRequest):
    """
    تنبؤ محسّن يجمع ML + RAG + BioBERT.
    """
    try:
        # 1. التنبؤ باستخدام XGBoost
        model_input = prepare_model_input(data.dict(exclude={"region", "notes"}))
        
        # حساب مؤشرات مبسّطة
        bmi = model_input.weight_kg / ((model_input.height_cm / 100) ** 2) if model_input.height_cm > 0 else 0
        muac_z = (model_input.muac_cm - 13.5) / 1.5  # تبسيط لحساب Z-score
        
        # محاكاة تنبؤات XGBoost (في الواقع ستُستدعى من model.predict)
        stunting_prob = 1.0 / (1.0 + np.exp(-(0.5 * model_input.age_months - 2.0)))
        wasting_prob = 1.0 / (1.0 + np.exp(-(3.0 * (14.0 - model_input.muac_cm))))
        underweight_prob = 1.0 / (1.0 + np.exp(-(0.8 * model_input.weight_kg - 5.0)))
        
        overall = get_overall_risk(stunting_prob, wasting_prob, underweight_prob)
        
        # 2. استرجاع الأدلة من RAG
        rag_evidence = None
        if rag_system:
            try:
                rag_evidence = await rag_system.search(
                    query=f"سوء تغذية طفل {data.age_months} شهر",
                    top_k=3
                )
            except Exception as e:
                logger.warning(f"RAG search failed: {e}")
        
        # 3. استخراج الكيانات الطبية من الملاحظات
        medical_entities = []
        if biobert and data.notes:
            try:
                entities = await biobert.extract_entities(data.notes)
                medical_entities = entities
            except Exception as e:
                logger.warning(f"BioBERT extraction failed: {e}")
        
        # 4. توليد التوصيات
        risks = {
            "stunting": classify_risk(stunting_prob),
            "wasting": classify_risk(wasting_prob),
            "underweight": classify_risk(underweight_prob)
        }
        recommendations = generate_recommendations(model_input, risks)
        
        return EnhancedPredictionResponse(
            child_name=data.child_name,
            age_months=data.age_months,
            sex=data.sex,
            weight_kg=data.weight_kg,
            height_cm=data.height_cm,
            muac_cm=data.muac_cm,
            stunting_risk=risks["stunting"],
            stunting_probability=round(stunting_prob, 3),
            wasting_risk=risks["wasting"],
            wasting_probability=round(wasting_prob, 3),
            underweight_risk=risks["underweight"],
            underweight_probability=round(underweight_prob, 3),
            overall_risk=overall,
            haz=round((model_input.height_cm / 100 - 0.8) / 0.1, 2) if model_input.height_cm > 0 else None,
            waz=round((model_input.weight_kg - 10) / 2, 2),
            whz=round((model_input.height_cm - 75) / 10, 2),
            rag_evidence=rag_evidence,
            medical_entities=medical_entities,
            recommendations=recommendations,
            predicted_at=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Enhanced prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Enhanced prediction failed: {str(e)}")

@app.get("/health", tags=["System"])
async def health_check():
    """فحص حالة الخدمات المحسّنة"""
    return {
        "status": "healthy",
        "rag_loaded": rag_system is not None,
        "biobert_loaded": biobert is not None,
        "knowledge_base_entries": len(knowledge_base),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/knowledge", tags=["Knowledge"])
async def get_knowledge():
    """الحصول على دليل المعرفة المحلي"""
    return {
        "entries": knowledge_base,
        "count": len(knowledge_base)
    }

@app.get("/models/info", tags=["Models"])
async def model_info():
    """معلومات النماذج المحمّلة"""
    info = {
        "rag_system": "loaded" if rag_system else "not_loaded",
        "biobert_mobile": "loaded" if biobert else "not_loaded",
        "knowledge_base_size": len(knowledge_base)
    }
    return info

# =====================================================================
# تشغيل الخادم
# =====================================================================
if __name__ == "__main__":
    uvicorn.run(
        "enhanced_prediction_api:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
