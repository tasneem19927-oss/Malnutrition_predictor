"""
system RAG System
استرجاع الأدلة العلمية والتوصيات الطبية للمساعدة في تشخيص سوء التغذية
يعمل Offline بدون إنترنت - مناسب للبيئات محدودة الموارد

Author: system AI Team
Version: 2.0.0
"""

import json
import os
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict

# SentenceTransformer - يدعم العربية والإنجليزية
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("system.rag")

# =============================================================================
# Data Models
# =============================================================================

@dataclass
class EvidenceItem:
    """عنصر دليل علمي مسترجع."""
    id: str
    title: str
    snippet: str
    source: str
    year: int
    country: str
    priority: str
    recommendations: List[str]
    score: float
    language: str

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class TreatmentGuideline:
    """إرشادات علاجية من WHO."""
    condition: str
    condition_ar: str
    who_protocol: str
    duration: str
    micronutrients: List[str]
    follow_up: str
    ref: str

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class RAGResponse:
    """استجابة نظام RAG الكاملة."""
    query: str
    evidence: List[EvidenceItem]
    treatment_plan: Optional[TreatmentGuideline]
    arabic_summary: str
    confidence: float

    def to_dict(self) -> Dict:
        return {
            "query": self.query,
            "evidence": [e.to_dict() for e in self.evidence],
            "treatment_plan": self.treatment_plan.to_dict() if self.treatment_plan else None,
            "arabic_summary": self.arabic_s

# =============================================================================
# system RAG System - Main Class
# =============================================================================

class systemRAG:
    """
    نظام استرجاع الأدلة العلمية (RAG) للتنبؤ بسوء التغذية.
    يستخدم SentenceTransformers متعدد اللغات + FAISS للبحث السريع.
    يعمل Offline بالكامل - لا يحتاج إنترنت.
    """

    # مسار قاعدة المعرفة - يُحدَّد عبر متغير البيئة
    KB_PATH = os.environ.get("system_KB_PATH", "python/knowledge_base.json")
    INDEX_PATH = os.environ.get("system_INDEX_PATH", "python/rag_faiss_index.index")

    def __init__(self, kb_path: str = None, index_path: str = None):
        self.kb_path = kb_path or self.KB_PATH
        self.index_path = index_path or self.INDEX_PATH

        logger.info("=" * 50)
        logger.info(" system RAG System initializing...")
        logger.info(f" Knowledge base: {self.kb_path}")
        logger.info(f" FAISS index: {self.index_path}")
        logger.info("=" * 50)

        # تحميل نموذج التضمين متعدد اللغات (يدعم العربية والإنجليزية)
        self.model = SentenceTransformer(
            'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
        )

        # تحميل قاعدة المعرفة
        self.knowledge_base: Dict = {}
        self.documents: List[str] = []
        self.embeddings: np.ndarray = None
        self.index: faiss.Index = None

        self._load_knowledge_base()
        self._build_or_load_index()
        logger.info("system RAG ready!")

    def _load_knowledge_base(self):
        """
        تحميل قاعدة المعرفة من ملف JSON.
        تحتوي على مراجع علمية + بروتوكولات علاجية WHO.
        """
        try:
            with open(self.kb_path, 'r', encoding='utf-8') as f:
                self.knowledge_base = json.load(f)

            # تجهيز النصوص للبحث
            self.documents = []
            refs = self.knowledge_base.get('scientific_references', [])
            for ref in refs:
                # دمج العنوان + المحتوى + التوصيات
                content_parts = [
                    ref.get('title', ''),
                    ref.get('content', ''),
                    ref.get('country', ''),
                    ref.get('priority', ''),
                    ' '.join(ref.get('recommendations', []))
                ]
                doc = ' '.join(p for p in content_parts if p)
                self.documents.append(doc)

            # إضافة بروتوكولات العلاج كوثائق منفصلة
            guidelines = self.knowledge_base.get('treatment_guidelines', [])
            for g in guidelines:
                doc = ' '.join([
                    g.get('condition_ar', ''),
                    g.get('who_protocol', ''),
                    g.get('duration', ''),
                    ' '.join(g.get('micronutrients', [])),
                    g.get('follow_up', '')
                ])
                self.documents.append(doc)

            logger.info(f"Loaded {len(self.documents)} documents from knowledge base.")

        except FileNotFoundError:
            logger.warning(f"Knowledge base not found at {self.kb_path}. Creating default.")
            self._create_default_knowledge_base()
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in knowledge base: {e}")
            self._create_default_knowledge_base()

    def _create_default_knowledge_base(self):
        """إنشاء قاعدة معرفة افتراضية في حالة عدم وجود الملف."""
        self.knowledge_base = {
            "scientific_references": [],
            "treatment_guidelines": []
        }
        self.documents = self._load_default_documents()
        # حفظ الملف
        os.makedirs(os.path.dirname(self.kb_path), exist_ok=True)
        with open(self.kb_path, 'w', encoding='utf-8') as f:
            json.dump(self.knowledge_base, f, ensure_ascii=False, indent=2)

    def _load_default_documents(self) -> List[str]:
        """تحميل وثائق افتراضية عن سوء التغذية."""
        return [
            # XGBoost studies - Ghana
            "XGBoost achieves 98.0% accuracy for predicting stunting in children under 5 in Ghana. Age, weight, height, sex, region, and ethnicity are key predictors. Anku et al., PLoS ONE 2024, DOI: 10.1371/JOURNAL.PONE.0296625. Treatment: iron supplementation, Vitamin A monthly, RUTF for 12 weeks.",
            # ML studies - Ethiopia
            "xgbTree algorithm shows superior prediction for childhood undernutrition in Ethiopia using EDHS 2016 data. Time to water source, anaemia history, child age >30 months, small birth size, and maternal underweight are important factors. Bitew et al., Public Health Nutrition 2022, DOI: 10.1017/S1368980021004262. Treatment: improve water access, food security, family planning.",
            # Spatio-temporal ML - Kenya
            "Spatio-temporal ML model forecasts acute malnutrition at sub-county level in Kenya using DHIS2 clinical data and satellite imagery. Gradient Boosting achieves AUC 0.86 at 6-month horizon. Tadesse et al., PLoS ONE 2025, DOI: 10.1371/JOURNAL.PONE.0322959. Treatment: clinical data monitoring, satellite data integration, district-level prediction.",
            # ML stunting prediction - Bangladesh
            "Machine learning models predict stunting with 88.3% accuracy in Bangladesh using DHS data. Maternal BMI, education, wealth index, and child age are significant predictors. Rahman et al., PLoS ONE 2021, DOI: 10.1371/JOURNAL.PONE.0253172. Treatment: maternal BMI monitoring, education programs, wealth index support.",
            # Yemen acute malnutrition - WFP/UNICEF/FAO
            "540,000 children in Yemen face acute malnutrition as of 2020. Highest rates since 2015. WHO reports 22% acute malnutrition. UNICEF reports 49% stunting rate among children under 5. Priority: CRITICAL. Immediate intervention required. WFP/UNICEF/FAO Joint Assessment 2020.",
            # WHO SAM protocol
            "WHO protocol for Severe Acute Malnutrition (SAM): F-75 therapeutic milk for stabilization phase (1-2 weeks), followed by F-100 or RUTF for catch-up growth. Micronutrient supplementation includes Vitamin A, zinc, iron, and folic acid. WHO Guidelines 2023. Follow-up: weekly.",
            # RUTF treatment
            "Ready-to-Use Therapeutic Food (RUTF) is WHO-recommended for community-based management of severe acute malnutrition. Standard course is 12 weeks. Success rates exceed 85% when combined with medical monitoring. UNICEF Guidelines 2024. Follow-up: monthly.",
            # Stunting definition and treatment
            "Stunting (Height-for-Age Z-score < -2 SD) indicates chronic malnutrition. Irreversible after age 2-3 years. Prevention through maternal nutrition, breastfeeding, and complementary feeding. Treatment: nutritional rehabilitation with energy-dense foods. WHO Child Growth Standards.",
            # Wasting definition and treatment
            "Wasting (Weight-for-Height Z-score < -2 SD) indicates acute malnutrition. Reversible with proper treatment. Therapeutic feeding with F-75/F-100 and outpatient management with RUTF. Target weight gain: >5g/kg/day. WHO Guidelines 2023. Follow-up: weekly.",
            # Underweight treatment
            "Underweight (Weight-for-Age Z-score < -2 SD) reflects both acute and chronic malnutrition. Treatment combines feeding programs, disease prevention, and growth monitoring. WHO Guidelines 2023. Follow-up: monthly.",
            # Iron supplementation
            "Iron supplementation recommended for children 6-59 months in malaria-endemic areas with iron deficiency anemia. Dose: 3mg/kg/day elemental iron for 3 months. Monitor for side effects. WHO Iron Guidelines 2022.",
            # Vitamin A supplementation
            "Vitamin A supplementation every 4-6 months reduces mortality by 12-24% in children 6-59 months in deficient populations. Dose: 100,000 IU (6-11 months), 200,000 IU (12-59 months). WHO Vitamin A Guidelines 2023.",
            # Exclusive breastfeeding
            "Exclusive breastfeeding for first 6 months followed by continued breastfeeding with appropriate complementary foods up to 2 years. Breastfeeding reduces malnutrition risk by 30%. WHO Breastfeeding Guidelines 2023.",
            # Complementary feeding
            "Complementary feeding should start at 6 months with energy-dense, micronutrient-rich foods. Continue breastfeeding. Feed 2-3 meals/day at 6-8 months, 3-4 meals/day at 9-23 months. WHO Feeding Guidelines 2023.",
            # Zinc and ORS for diarrhea
            "Zinc supplementation (20mg/day for 10-14 days) with ORS recommended for diarrhea management in children. Reduces duration and severity. Prevents malnutrition-worsening diarrhea. WHO Diarrhea Guidelines 2023.",
            # Growth monitoring
            "Regular growth monitoring using WHO growth charts essential for early malnutrition detection. Monthly measurements recommended for children under 2, quarterly for 2-5 years. WHO Growth Monitoring 2023.",
            # Multisectoral approach
            "Effective malnutrition reduction requires multisectoral approach: health, nutrition, WASH (water, sanitation, hygiene), agriculture, and social protection. Lancet Series 2021.",
            # BioBERT for medical NER
            "BioBERT pre-trained on biomedical corpora outperforms BERT on biomedical NER (0.62% F1 improvement), relation extraction (2.80% F1), and QA (12.24% MRR). Essential for medical text mining. Lee et al., Bioinformatics 2020, DOI: 10.1093/BIOINFORMATICS/BTZ682.",
            # MobileBERT for resource-limited
            "MobileBERT is a 4.3x smaller, 5.5x faster BERT model designed for mobile devices. Maintains 98.5% of BERT performance with efficient architecture. Ideal for offline medical applications in Yemen and similar resource-limited settings. Sun et al., arXiv 2020.",
            # MedRAG evidence-based medicine
            "Retrieval-Augmented Generation (RAG) combines information retrieval with language generation for evidence-based medical decision support. Improves accuracy by 15-20% over LLM-only approaches. MedRAG, Web Conference 2025."
        ]

    def _build_or_load_index(self):
        """
        بناء فهرس FAISS أو تحميله من القرص.
        FAISS IndexFlatL2 - سريع وخفيف للعمل على CPU.
        """
        if not self.documents:
            logger.warning("No documents to build index.")
            return

        # محاولة تحميل الفهرس المحفوظ
        if os.path.exists(self.index_path):
            try:
                self.index = faiss.read_index(self.index_path)
                logger.info(f"Loaded FAISS index from {self.index_path}")
                return
            except Exception as e:
                logger.warning(f"Failed to load index: {e}. Rebuilding...")

        # بناء الفهرس الجديد
        logger.info("Building FAISS index from scratch...")
        self.embeddings = self.model.encode(
            self.documents,
            convert_to_numpy=True,
            show_progress_bar=True
        )

        dimension = self.embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(self.embeddings.astype('float32'))

        # حفظ الفهرس
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        faiss.write_index(self.index, self.index_path)
        logger.info(f"FAISS index saved to {self.index_path}")

    def retrieve(
        self,
        query: str,
        top_k: int = 3,
        language: str = "ar",
        min_score: float = 0.5
    ) -> List[EvidenceItem]:
        """
        استرجاع الأدلة العلمية الأكثر صلة بالاستعلام.

        Args:
            query: نص البحث (بالعربية أو الإنجليزية)
            top_k: عدد النتائج المطلوبة (افتراضي: 3)
            language: اللغة المفضلة للنتائج ("ar" أو "en")
            min_score: الحد الأدنى من درجة التشابه (0-1)

        Returns:
            قائمة من EvidenceItem مع الأدلة المسترجعة
        """
        if self.index is None or not self.documents:
            return []

        # تحويل الاستعلام إلى embedding
        query_emb = self.model.encode(
            [query],
            convert_to_numpy=True
        ).astype('float32')

        # البحث في FAISS
        distances, indices = self.index.search(query_emb, top_k)

        results = []
        refs = self.knowledge_base.get('scientific_references', [])
        guidelines = self.knowledge_base.get('treatment_guidelines', [])
        total_docs = len(refs) + len(guidelines)

        for score, idx in zip(distances[0], indices[0]):
            if idx >= total_docs:
                continue

            # تحويل المسافة إلى درجة تشابه (كلما كانت أقل، كلما كان أفضل)
            similarity = 1.0 / (1.0 + score)
            if similarity < min_score:
                continue

            if idx < len(refs):
                ref = refs[idx]
                item = EvidenceItem(
                    id=ref.get('id', f'doc_{idx}'),
                    title=ref.get('title', ''),
                    snippet=ref.get('content', ''),
                    source=ref.get('journal', ref.get('source', 'Unknown')),
                    year=ref.get('year', 0),
                    country=ref.get('country', 'Unknown'),
                    priority=ref.get('priority', 'medium'),
                    recommendations=ref.get('recommendations', []),
                    score=float(similarity),
                    language=language
                )
            else:
                g_idx = idx - len(refs)
                g = guidelines[g_idx]
                item = EvidenceItem(
                    id=f'guideline_{g_idx}',
                    title=g.get('condition_ar', g.get('condition', '')),
                    snippet=g.get('who_protocol', ''),
                    source=g.get('ref', 'WHO Guidelines'),
                    year=2023,
                    country='Global',
                    priority='high',
                    recommendations=g.get('micronutrients', []),
                    score=float(similarity),
                    language=language
                )

            results.append(item)

        return resultsummary,

    def query(
        self,
        child_data: Dict,
        prediction_result: Any,
        clinical_notes: str = None,
        top_k: int = 3,
        language: str = "ar"
    ) -> RAGResponse:
        """
        الاستعلام الكامل: استرجاع الأدلة + خطة العلاج.

        Args:
            child_data: بيانات الطفل (age, sex, weight, height, muac, region)
            prediction_result: نتيجة التنبؤ من XGBoost
            clinical_notes: ملاحظات طبية نصية إضافية (اختياري)
            top_k: عدد الأدلة المسترجعة
            language: اللغة المفضلة

        Returns:
            RAGResponse مع الأدلة وخطة العلاج
        """
        # بناء الاستعلام من بيانات الطفل ونتيجة التنبؤ
        query = self._build_query(child_data, prediction_result, clinical_notes)

        # استرجاع الأدلة
        evidence = self.retrieve(query, top_k=top_k, language=language)

        # تحديد خطة العلاج بناءً على المخاطر
        treatment_plan = self._get_treatment_plan(prediction_result)

        # توليد ملخص عربي
        arabic_summary = self._generate_arabic_summary(
            child_data, prediction_result, evidence, treatment_plan
        )

        # حساب الثقة
        confidence = sum(e.score for e in evidence) / len(evidence) if evidence else 0.0

        return RAGResponse(
            query=query,
            evidence=evidence,
            treatment_plan=treatment_plan,
            arabic_summary=arabic_summary,
            confidence=confidence
        )

    def _build_query(
        self,
        child_data: Dict,
        prediction_result: Any,
        clinical_notes: str = None
    ) -> str:
        """
        بناء استعلام بحث ذكي من بيانات الطفل ونتيجة التنبؤ.
        يدعم العربية والإنجليزية.
        """
        age = child_data.get('age_months', 0)
        sex = child_data.get('sex', 'unknown')
        weight = child_data.get('weight_kg', 0)
        height = child_data.get('height_cm', 0)
        muac = child_data.get('muac_cm', 0)
        region = child_data.get('region', 'Unknown')

        # استخراج المخاطر من نتيجة التنبؤ
        stunting_risk = getattr(prediction_result, 'stunting_risk', 'unknown')
        wasting_risk = getattr(prediction_result, 'wasting_risk', 'unknown')
        underweight_risk = getattr(prediction_result, 'underweight_risk', 'unknown')
        overall_risk = getattr(prediction_result, 'overall_risk', 'unknown')

        # بناء الاستعلام بالعربية
        query_parts = [
            f"طفل {age} شهر، {sex}",
            f"وزن {weight} كغ، طول {height} سم، MUAC {muac} سم",
        ]

        # إضافة المخاطر
        if stunting_risk in ('high', 'critical'):
            query_parts.append("تقزم شديد")
        if wasting_risk in ('high', 'critical'):
            query_parts.append("هزال شديد")
        if underweight_risk in ('high', 'critical'):
            query_parts.append("نقص وزن")

        # إضافة المنطقة
        if region:
            query_parts.append(f"المنطقة: {region}")

        # إضافة الملاحظات السريرية
        if clinical_notes:
            query_parts.append(f"ملاحظات: {clinical_notes[:200]}")

        # إضافة كلمات مفتاحية للبحث بناءً على المخاطر
        if overall_risk in ('high', 'critical'):
            query_parts.extend([
                "سوء تغذية حاد",
                "علاج RUTF",
                "بروتوكول WHO",
                "فيتامين A",
                "زنك"
            ])
        elif overall_risk == 'moderate':
            query_parts.extend([
                "سوء تغذية متوسط",
                "تغذية تكميلية",
                "مراقبة النمو"
            ])
        else:
            query_parts.extend([
                "وقاية من سوء التغذية",
                "رضاعة طبيعية",
                "تغذية صحية"
            ])

        query = ". ".join(query_parts) + "."

        # إضافة نسخة إنجليزية لتحسين البحث
        query_en = f"Child {age} months, {sex}, weight {weight} kg, height {height} cm. "
        query_en += f"Risk: stunting={stunting_risk}, wasting={wasting_risk}, underweight={underweight_risk}. "
        query_en += f"Region: {region}. Malnutrition treatment WHO protocol."

        # دمج الاستعلامين (يعملون بشكل أفضل مع النموذج متعدد اللغات)
        return query + " | " + query_en

    def _get_treatment_plan(self, prediction_result: Any) -> Optional[TreatmentGuideline]:
        """
        تحديد خطة العلاج المناسبة بناءً على نتيجة التنبؤ.
        """
        stunting_risk = getattr(prediction_result, 'stunting_risk', 'low')
        wasting_risk = getattr(prediction_result, 'wasting_risk', 'low')
        underweight_risk = getattr(prediction_result, 'underweight_risk', 'low')
        overall_risk = getattr(prediction_result, 'overall_risk', 'low')

        guidelines = self.knowledge_base.get('treatment_guidelines', [])

        # تحديد الحالة الأكثر خطورة
        if overall_risk == 'critical':
            # البحث عن دليل مناسب
            for g in guidelines:
                if g.get('condition') == 'severe_wasting':
                    return TreatmentGuideline(
                        condition='severe_wasting',
                        condition_ar='الهزال الشديد (سوء تغذية حاد حرج)',
                        who_protocol=g.get('who_protocol', 'تحويل فوري إلى مركز علاج'),
                        duration=g.get('duration', '8-12 أسبوع'),
                        micronutrients=g.get('micronutrients', ['فيتامين A', 'الحديد', 'الزنك']),
                        follow_up='أسبوعي',
                        ref=g.get('ref', 'WHO Guidelines 2023')
                    )

        if stunting_risk in ('high', 'critical'):
            for g in guidelines:
                if g.get('condition') == 'severe_stunting':
                    return TreatmentGuideline(
                        condition='severe_stunting',
                        condition_ar='التقزم الشديد',
                        who_protocol=g.get('who_protocol', 'F-75 ثم F-100/RUTF'),
                        duration=g.get('duration', '12 أسبوع'),
                        micronutrients=g.get('micronutrients', ['فيتامين A', 'الحديد', 'الزنك', 'حمض الفوليك']),
                        follow_up='أسبوعي',
                        ref=g.get('ref', 'WHO Guidelines 2023')
                    )

        if wasting_risk in ('high', 'critical'):
            for g in guidelines:
                if g.get('condition') == 'severe_wasting':
                    return TreatmentGuideline(
                        condition='severe_wasting',
                        condition_ar='الهزال الشديد',
                        who_protocol=g.get('who_protocol', 'F-75 للاستقرار ثم RUTF'),
                        duration=g.get('duration', '8-12 أسبوع'),
                        micronutrients=g.get('micronutrients', ['فيتامين A', 'الحديد', 'الزنك']),
                        follow_up='أسبوعي',
                        ref=g.get('ref', 'WHO Guidelines 2023')
                    )

        if underweight_risk in ('high', 'critical'):
            for g in guidelines:
                if g.get('condition') == 'underweight':
                    return TreatmentGuideline(
                        condition='underweight',
                        condition_ar='نقص الوزن',
                        who_protocol=g.get('who_protocol', 'برامج التغذية + مراقبة النمو'),
                        duration=g.get('duration', '12-24 أسبوع'),
                        micronutrients=g.get('micronutrients', ['فيتامين A', 'الحديد']),
                        follow_up='شهري',
                        ref=g.get('ref', 'WHO Guidelines 2023')
                    )

        if overall_risk == 'moderate':
            for g in guidelines:
                if g.get('condition') == 'moderate':
                    return TreatmentGuideline(
                        condition='moderate',
                        condition_ar='سوء تغذية متوسط',
                        who_protocol=g.get('who_protocol', 'RUTF للمرضى الخارجيين'),
                        duration=g.get('duration', '8-12 أسبوع'),
                        micronutrients=g.get('micronutrients', ['فيتامين A', 'الزنك']),
                        follow_up='شهري',
                        ref=g.get('ref', 'UNICEF Guidelines 2024')
                    )

        return None

    def _generate_arabic_summary(
        self,
        child_data: Dict,
        prediction_result: Any,
        evidence: List[EvidenceItem],
        treatment_plan: Optional[TreatmentGuideline]
    ) -> str:
        """
        توليد ملخص عربي للتقرير.
        """
        overall_risk = getattr(prediction_result, 'overall_risk', 'unknown')

        # خريطة المخاطر بالعربية
        risk_map = {
            'low': 'منخفض',
            'moderate': 'متوسط',
            'high': 'مرتفع',
            'critical': 'حرج'
        }

        summary_lines = [
            "=== تقرير الذكاء الاصطناعي الطبي ===",
            "",
            f"حالة الطفل: الخطر الإجمالي - {risk_map.get(overall_risk, overall_risk).upper()}",
            ""
        ]

        # إضافة المراجع العلمية
        if evidence:
            summary_lines.append("الأدلة العلمية المستند إليها:")
            for i, ev in enumerate(evidence[:3], 1):
                summary_lines.append(f"  {i}. {ev.title} - {ev.source} ({ev.year})")

        # إضافة خطة العلاج
        if treatment_plan:
            summary_lines.append("")
            summary_lines.append(f"خطة العلاج الموصى بها: {treatment_plan.condition_ar}")
            summary_lines.append(f"  البروتوكول: {treatment_plan.who_protocol}")
            summary_lines.append(f"  المدة: {treatment_plan.duration}")
            summary_lines.append(f"  المكملات: {', '.join(treatment_plan.micronutrients)}")
            summary_lines.append(f"  المتابعة: {treatment_plan.follow_up}")

        summary_lines.append("")
        summary_lines.append("=== تنويه: هذا التقرير لأغراض مساعدة القرار ===")
        summary_lines.append("يجب دائمًا استشارة طبيب متخصص للتشخيص والعلاج ===")

        return "\n".join(summary_lines)

    def get_statistics(self) -> Dict:
        """
        إرجاع إحصائيات نظام RAG.
        """
        refs = self.knowledge_base.get('scientific_references', [])
        guidelines = self.knowledge_base.get('treatment_guidelines', [])

        return {
            "total_references": len(refs),
            "total_guidelines": len(guidelines),
            "total_documents": len(self.documents),
            "index_loaded": self.index is not None,
            "model": "paraphrase-multilingual-MiniLM-L12-v2",
            "languages_supported": ["ar", "en"]
        }


# =============================================================================
# Standalone execution for testing
# =============================================================================

if __name__ == "__main__":
    print("Testing system RAG System...")
    print("=" * 50)

    # اختبار النظام
    rag = systemRAG()

    # بيانات اختبار
    test_child = {
        'age_months': 18,
        'sex': 'female',
        'weight_kg': 7.2,
        'height_cm': 75.0,
        'muac_cm': 11.5,
        'region': 'عدن'
    }

    class MockPrediction:
        stunting_risk = 'high'
        wasting_risk = 'critical'
        underweight_risk = 'high'
        overall_risk = 'critical'

    test_result = MockPrediction()

    # تنفيذ الاستعلام
    response = rag.query(test_child, test_result, clinical_notes="الطفل يعاني من إسهال متكرر وفقر دم", top_k=3)

    print(f"\nالاستعلام: {response.query[:100]}...")
    print(f"\nعدد الأدلة المسترجعة: {len(response.evidence)}")
    print(f"الثقة: {response.confidence:.2%}")
    print("\n" + response.arabic_summary)

    print("\n" + "=" * 50)
    print("system RAG System test completed successfully!")
            "confidence": self.confidence
        }
