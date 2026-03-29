"""
system BioBERT Mobile
نموذج BERT طبي محمول لمعالجة النصوص الطبية واستخراج الكيانات
يدعم العربية والإنجليزية - مبني على MobileBERT للبيئات محدودة الموارد

Author: system AI Team
Version: 2.0.0
"""

import re
import json
import logging
from typing import Dict, List, Optional, Any, Tuple

# MobileBERT - نموذج خفيف الوزن من جوجل (اصغر 4.3x واسرع 5.5x من BERT)
from transformers import AutoTokenizer, AutoModel
import torch

# SentenceTransformer للتضمين الدلالي
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")
logger = logging.getLogger(__name__)


class BioBERTMobile:
    """
    نموذج معالجة النصوص الطبية المحمول (BioBERTMobile)
    - يستخرج الكيانات الطبية (أمراض، أعراض، علاجات، قياسات)
    - يدعم العربية والإنجليزية
    - مبني على MobileBERT للبيئات محدودة الموارد
    - يتضمن تضمين دلالي للربط مع نظام RAG
    """

    def __init__(self, model_name: str = 'google/mobilebert-uncased',
                 embedding_model: str = 'paraphrase-multilingual-mpnet-base-v2'):
        """
        تهيئة النموذج
        Args:
            model_name: اسم نموذج MobileBERT
            embedding_model: نموذج التضمين الدلالي متعدد اللغات
        """
        logger.info("جاري تحميل BioBERTMobile...")

        self.model_name = model_name
        self.embedding_model_name = embedding_model

        # تحميل MobileBERT
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModel.from_pretrained(self.model_name)
            self.model.eval()
            logger.info("MobileBERT loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load MobileBERT: {e}")
            raise

        # تحميل نموذج التضمين الدلالي
        try:
            self.sentence_encoder = SentenceTransformer(self.embedding_model_name)
            logger.info("SentenceTransformer loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load SentenceTransformer: {e}")
            self.sentence_encoder = None

        # 

    def _load_entity_types(self) -> Dict[str, List[str]]:
        """تحميل أنواع الكيانات الطبية (الإنجليزية)"""
        return {
            'disease': [
                'malnutrition', 'stunting', 'wasting', 'underweight',
                'anemia', 'malaria', 'diarrhea', 'pneumonia', 'dehydration',
                'kwashiorkor', 'marasmus', 'scurvy', 'rickets', 'measles',
                'sepsis', 'acute malnutrition', 'severe malnutrition',
                'protein-energy malnutrition', 'micronutrient deficiency'
            ],
            'symptom': [
                'fever', 'edema', 'weight_loss', 'stunted_growth',
                'fatigue', 'diarrhea', 'vomiting', 'poor_appetite',
                'pale_skin', 'hair_changes', 'irritability', 'lethargy',
                'loss of appetite', 'muscle wasting', 'sunken eyes',
                'skin lesions', 'cracked lips', 'angular stomatitis'
            ],
            'treatment': [
                'F-75', 'F-100', 'RUTF', 'plumpy_nut', 'iron', 'zinc',
                'vitamin_A', 'folic_acid', 'ORS', 'antibiotics',
                'deworming', 'supplementary feeding', 'therapeutic food',
                'ready-to-use therapeutic food', 'nutritional rehabilitation',
                'breastfeeding support', 'growth monitoring'
            ],
            'measurement': [
                'weight', 'height', 'age', 'MUAC', 'BMI', 'Z-score',
                'WAZ', 'HAZ', 'WHZ', 'weight_for_age', 'height_for_age',
                'weight_for_height', 'mid_upper_arm_circumference'
            ],
            'nutrient': [
                'protein', 'iron', 'vitamin_A', 'vitamin_D', 'zinc',
                'calcium', 'folic_acid', 'iodine', 'vitamin_C',
                'vitamin_B12', 'magnesium', 'phosphorus', 'thiamine',
                'riboflavin', 'niacin'
            ],
            'demographic': [
                'male', 'female', 'boy', 'girl', 'child', 'infant',
                'toddler', 'months', 'years', 'urban', 'rural'
            ]
        }

    def _load_arabic_entity_types(self) -> Dict[str, List[str]]:
        """تحميل أنواع الكيانات الطبية (العربية)"""
        return {
            'disease': [
                'سوء تغذية', 'تقزم', 'هزال', 'نحافة', 'فقر دم', 'ملاريا',
                'إسهال', 'التهاب رئوي', 'جفاف', 'كواشيوركور', 'ماراسموس',
                'إسقربوط', 'كساح', 'حصبة', 'تعفن الدم', 'سوء تغذية حاد',
                'سوء تغذية شديد', 'نقص البروتين والطاقة', 'نقص المغذيات الدقيقة'
            ],
            'symptom': [
                'حمى', 'وذمة', 'فقدان وزن', 'تأخر نمو', 'إرهاق', 'إسهال',
                'تقيؤ', 'ضعف شهية', 'شحوب', 'تغيرات شعر', 'تهيج', 'خمول',
                'فقدان شهية', 'هزال عضلي', 'عيون غائرة', 'آفات جلدية',
                'تشقق شفاه', 'التهاب زوايا الفم'
            ],
            'treatment': [
                'الغذاء العلاجي', 'ف-75', 'ف-100', 'راتف', 'بلمبي نات',
                'حديد', 'زنك', 'فيتامين أ', 'حمض فوليك', 'محلول معالجة الجفاف',
                'مضادات حيوية', 'إزالة الديدان', 'تغذية تكميلية',
                'غذاء علاجي جاهز', 'إعادة تأهيل غذائي', 'دعم الرضاعة',
                'متابعة النمو'
            ],
            'measurement': [
                'وزن', 'طول', 'عمر', 'محيط العضد', 'مؤشر كتلة الجسم',
                'نقاط زد', 'الوزن بالنسبة للعمر', 'الطول بالنسبة للعمر',
                'الوزن بالنسبة للطول', 'محيط منتصف العضد'
            ],
            'nutrient': [
                'بروتين', 'حديد', 'فيتامين أ', 'فيتامين د', 'زنك',
                'كالسيوم', 'حمض فوليك', 'يود', 'فيتامين ج',
                'فيتامين ب12', 'مغنيسيوم', 'فسفور', 'ثيامين',
                'ريبوفلافين', 'نياسين'
            ],
            'demographic': [
                'ذكر', 'أنثى', 'ولد', 'بنت', 'طفل', 'رضيع', 'صغير',
                'أشهر', 'سنوات', 'حضري', 'ريفي'
            ]
        }

    def extract_medical_entities(self, text: str, language: str = 'auto') -> Dict[str, Any]:
        """
        استخراج الكيانات الطبية من التقرير الطبي
        Args:
            text: النص الطبي
            language: 'ar', 'en', or 'auto'
        Returns:
            dict: الكيانات المستخرجة مع التضمين الدلالي
        """
        if not text:
            return {'entities': [], 'entity_count': 0, 'embeddings': None,
                    'summary': '', 'categories': {}, 'language': 'unknown'}

        # تحديد اللغة تلقائياً إذا لم تحدد
        if language == 'auto':
            language = self._detect_language(text)

        entities = []
        text_lower = text.lower()

        # اختيار القاموس بناءً على اللغة
        entity_dict = self.arabic_entity_types if language == 'ar' else self.medical_entity_types

        # استخراج الكيانات عبر التطابق
        for entity_type, keywords in entity_dict.items():
            for keyword in keywords:
                # استخدام regex لمطابقة الكلمة بكاملها
                pattern = r'\b' + re.escape(keyword) + r'\b' if len(keyword) > 3 else keyword
                matches = re.finditer(pattern, text_lower)
                for match in matches:
                    entity = {
                        'text': text[match.start():match.end()],
                        'type': entity_type,
                        'position': [match.start(), match.end()],
                        'confidence': self._calculate_confidence(keyword, entity_type),
                        'language': language
                    }
                    entities.append(entity)

        # إزالة التكرارات
        entities = self._remove_duplicate_entities(entities)

        # التضمين الدلالي
        embeddings = self._get_text_embeddings(text) if self.sentence_encoder else None

        # توليد الفئات
        categories = self._categorize_entities(entities)

        return {
            'entities': entities,
            'entity_count': len(entities),
            'embeddings': embeddings,
            'summary': self._generate_entity_summary(entities, language),
            'categories': categories,
            'language': language
        }

    def _detect_language(self, text: str) -> str:
        """تحديد لغة النص"""
        arabic_chars = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
        total_chars = len(text.replace(' ', ''))
        if total_chars == 0:
            return 'en'
        arabic_ratio = arabic_chars / total_chars
        return 'ar' if arabic_ratio > 0.3 else 'en'

    def _calculate_confidence(self, keyword: str, entity_type: str) -> float:
        """حساب مستوى الثقة للاستخراج"""
        base_confidence = 0.75
        # زيادة الثقة للكيانات المحددة
        if entity_type in ['disease', 'measurement']:
            base_confidence += 0.1
        if len(keyword) > 5:
            base_confidence += 0.05
        return min(base_confidence, 0.95)

    def _remove_duplicate_entities(self, entities: List[Dict]) -> List[Dict]:
        """إزالة الكيانات المكررة"""
        seen = set()
        unique = []
        for e in entities:
            key = (e['text'], e['type'])
            if key not in seen:
                seen.add(key)
                unique.append(e)
        return unique

    def _categorize_entities(self, entities: List[Dict]) -> Dict[str, List[str]]:
        """تجميع الكيانات حسب الفئات"""
        categories = {}
        for e in entities:
            etype = e['type']
            if etype not in categories:
                categories[etype] = []
            if e['text'] not in categories[etype]:
                categories[etype].append(e['text'])
        return categories

    def _generate_entity_summary(self, entities: List[Dict], language: str) -> str:
        """توليد ملخص للكيانات المستخرجة"""
        cats = self._categorize_entities(entities)

        labels = {
            'disease': {'ar': 'أمراض', 'en': 'Diseases'},
            'symptom': {'ar': 'أعراض', 'en': 'Symptoms'},
            'treatment': {'ar': 'علاجات', 'en': 'Treatments'},
            'measurement': {'ar': 'قياسات', 'en': 'Measurements'},
            'nutrient': {'ar': 'مغذيات', 'en': 'Nutrients'},
            'demographic': {'ar': 'بيانات ديموغرافية', 'en': 'Demographics'}
        }

        prefix = {'ar': 'التقرير الطبي يحتوي على:\n', 'en': 'Medical report contains:\n'}
        summary = prefix.get(language, prefix['en'])

        for etype, items in cats.items():
            if items:
                label = labels.get(etype, {'ar': etype, 'en': etype}).get(language, etype)
                items_str = ', '.join(items)
                if language == 'ar':
                    summary += f"- {label}: {items_str}\n"
                else:
                    summary += f"- {label}: {items_str}\n"

        if len(cats) == 0:
            summary = {'ar': 'لا توجد كيانات طبية محددة',
                      'en': 'No medical entities identified'}.get(language, 'No entities')
        return summary.strip()

    def _get_text_embeddings(self, text: str) -> Optional[List[float]]:
        """الحصول على التضمين الدلالي للنص"""
        if self.sentence_encoder is None:
            return None
        try:
            embeddings = self.sentence_encoder.encode(text, convert_to_numpy=True)
            return embeddings.tolist()
        except Exception as e:
            logger.warning(f"Failed to generate embeddings: {e}")
            return None

    def get_semantic_similarity(self, text1: str, text2: str) -> Optional[float]:
        """حساب التشابه الدلالي بين نصين"""
        if self.sentence_encoder is None:
            return None
        try:
            from sklearn.metrics.pairwise import cosine_similarity
            emb1 = self.sentence_encoder.encode([text1], convert_to_numpy=True)
            emb2 = self.sentence_encoder.encode([text2], convert_to_numpy=True)
            return float(cosine_similarity(emb1, emb2)[0][0])
        except Exception as e:
            logger.warning(f"Failed to calculate similarity: {e}")
            return None

    def classify_text(self, text: str, language: str = 'auto') -> Dict[str, Any]:
        """تصنيف النص الطبي إلى فئة (تقزم/هزال/نحافة/شديد)"""
        if not text:
            return {'category': 'unknown', 'confidence': 0.0, 'language': 'unknown'}

        if language == 'auto':
            language = self._detect_language(text)

        text_lower = text.lower()

        # كلمات مفتاحية حسب الفئات
        keywords = {
            'stunting': {
                'ar': ['تقزم', 'طول', 'نمو', 'معدّل الطول', 'haz', 'هاز'],
                'en': ['stunt', 'height', 'growth', 'height-for-age', 'haz']
            },
            'wasting': {
                'ar': ['هزال', 'نحافة', 'فقدان وزن', 'معدّل الوزن', 'whz', 'واز'],
                'en': ['waste', 'weight', 'thin', 'weight-for-height', 'whz']
            },
            'underweight': {
                'ar': ['نحافة', 'وزن', 'مؤشر كتلة', 'بمي', 'waz', 'وازد'],
                'en': ['underweight', 'under-weight', 'weight-for-age', 'waz']
            },
            'severe': {
                'ar': ['شديد', 'حاد', 'طوارئ', 'خطير', 'محيط العضد', 'muac'],
                'en': ['sever', 'acute', 'emergency', 'critical', 'muac']
            },
            'micronutrient': {
                'ar': ['نقص', 'فيتامين', 'حديد', 'زنك', 'يود'],
                'en': ['deficiency', 'vitamin', 'iron', 'zinc', 'micronutrient']
            }
        }

        scores = {cat: 0 for cat in keywords}
        lang_keys = {'ar': language == 'ar', 'en': language == 'en'}

        for category, kw_set in keywords.items():
            for kw in kw_set.get(language, []):
                if kw in text_lower:
                    scores[category] += 1

        # تحديد الفئة الأعلى
        best_category = max(scores, key=scores.get) if scores else 'general'
        total_matches = sum(scores.values())
        confidence = min(scores[best_category] / max(total_matches, 1), 1.0) if total_matches > 0 else 0.3

        return {
            'category': best_category,
            'confidence': confidence,
            'scores': scores,
            'language': language
        }

    def extract_measurements(self, text: str) -> Dict[str, Optional[float]]:
        """استخراج القياسات الرقمية من النص (وزن، طول، محيط العضد، عمر)"""
        measurements = {
            'weight_kg': None,
            'height_cm': None,
            'muac_cm': None,
            'age_months': None
        }

        # أنماط لاستخراج القياسات
        patterns = [
            # الوزن: وزن 12.5 كغ or weight 12.5 kg
            (r'(?:وزن|weight)[:\s]*(\d+(?:\.\d+)?)\s*(?:كغ|kg)', 'weight_kg'),
            # الطول: طول 75 سم or height 75 cm
            (r'(?:طول|height)[:\s]*(\d+(?:\.\d+)?)\s*(?:سم|cm)', 'height_cm'),
            # محيط العضد: محيط العضد 11.5 سم or MUAC 11.5 cm
            (r'(?:محيط(?:\s+)?(?:العضد)?|MUAC|mid[- ]?upper[- ]?arm)[:\s]*(\d+(?:\.\d+)?)\s*(?:سم|cm)', 'muac_cm'),
            # العمر: عمر 24 شهر or age 24 months
            (r'(?:عمر|age)[:\s]*(\d+(?:\.\d+)?)\s*(?:شهر|month)', 'age_months'),
            # العمر: عمر 2 سنة or age 2 years
            (r'(?:عمر|age)[:\s]*(\d+(?:\.\d+)?)\s*(?:سنة|year)', 'age_months')
        ]

        text_lower = text.lower()
        for pattern, field in patterns:
            match = re.search(pattern, text_lower)
            if match:
                value = float(match.group(1))
                if field == 'age_months' and 'سنة' in text_lower or 'year' in text_lower:
                    value *= 12  # تحويل سنوات إلى أشهر
                measurements[field] = value

        return measurementsتحميل أنواع الكيانات الطبية
        self.medical_entity_types = self._load

    def get_bert_embeddings(self, text: str) -> Optional[List[List[float]]]:
        """الحصول على تمثيلات BERT للطبقة الأخيرة"""
        try:
            inputs = self.tokenizer(
                text,
                return_tensors='pt',
                padding=True,
                truncation=True,
                max_length=512
            )
            with torch.no_grad():
                outputs = self.model(**inputs)
            embeddings = outputs.last_hidden_state.tolist()
            return embeddings
        except Exception as e:
            logger.warning(f"Failed to get BERT embeddings: {e}")
            return None

    def save_model(self, filepath: str = 'biobert_mobile_model'):
        """حفظ النموذج للتحميل السريع لاحقاً"""
        self.tokenizer.save_pretrained(filepath)
        self.model.save_pretrained(filepath)
        logger.info(f"Model saved to: {filepath}")

    @staticmethod
    def load_model(filepath: str = 'biobert_mobile_model'):
        """تحميل نموذج محفوظ"""
        tokenizer = AutoTokenizer.from_pretrained(filepath)
        model = AutoModel.from_pretrained(filepath)
        return BioBERTMobileWithPreloaded(tokenizer, model)


class BioBERTMobileWithPreloaded:
    """فئة مساعدة لتحميل نموذج محفوظ مسبقاً"""
    def __init__(self, tokenizer, model):
        self.tokenizer = tokenizer
        self.model = model
        self.model.eval()


# دالة مساعدة لاستخدام النظام بشكل مباشر
if __name__ == '__main__':
    print("=" * 50)
    print("system BioBERT Mobile - اختبار النظام")
    print("=" * 50)

    biobert = BioBERTMobile()

    # مثال 1: تقرير طبي إنجليزي
    sample_text_en = """
    The child is 24 months old with severe acute malnutrition.
    Height-for-age Z-score is -3.5 indicating stunting.
    Weight-for-height Z-score is -4.0 indicating wasting.
    MUAC measurement is 11.5 cm. The child shows edema in both legs.
    Treatment started with F-75 therapeutic milk.
    Vitamin A and zinc supplementation prescribed.
    Mother reports poor appetite and recurring diarrhea.
    History of anemia.
    """

    print("\n" + "=" * 50)
    print("نموذج 1: تقرير طبي (إنجليزي)")
    print("=" * 50)
    result = biobert.extract_medical_entities(sample_text_en, language='en')
    print(f"الكيانات المستخرجة: {result['entity_count']}")
    print(f"اللغة: {result['language']}")
    print(f"ملخص الكيانات:\n{result['summary']}")

    print("\n" + "-" * 50)
    print("تصنيف النص:")
    classification = biobert.classify_text(sample_text_en, language='en')
    print(f"الفئة: {classification['category']} (الثقة: {classification['confidence']:.2f})")

    print("\n" + "-" * 50)
    print("القياسات المستخرجة:")
    measurements = biobert.extract_measurements(sample_text_en)
    print(measurements)

    # مثال 2: تقرير طبي عربي
    sample_text_ar = """
    الطفل يبلغ من العمر 24 شهر ويعاني من سوء تغذية حاد شديد.
    معدل الطول بالنسبة للعمر -3.5 مما يدل على التقزم.
    معدل الوزن بالنسبة للطول -4.0 مما يدل على الهزال.
    محيط العضد 11.5 سم. الطفل يعاني من وذمة في الساقين.
    بدأ العلاج بالغذاء العلاجي ف-75.
    تم وصف فيتامين أ ومكملات الزنك.
    الأم تشكو من ضعف الشهية والإسهال المتكرر.
    تاريخ من فقر الدم.
    """

    print("\n" + "=" * 50)
    print("نموذج 2: تقرير طبي (عربي)")
    print("=" * 50)
    result_ar = biobert.extract_medical_entities(sample_text_ar, language='ar')
    print(f"الكيانات المستخرجة: {result_ar['entity_count']}")
    print(f"اللغة: {result_ar['language']}")
    print(f"ملخص الكيانات:\n{result_ar['summary']}")

    print("\n" + "-" * 50)
    print("تصنيف النص:")
    classification_ar = biobert.classify_text(sample_text_ar, language='ar')
    print(f"الفئة: {classification_ar['category']} (الثقة: {classification_ar['confidence']:.2f})")

    print("\n" + "-" * 50)
    print("القياسات المستخرجة:")
    measurements_ar = biobert.extract_measurements(sample_text_ar)
    print(measurements_ar)

    # مثال 3: الكشف التلقائي للغة
    print("\n" + "=" * 50)
    print("نموذج 3: كشف اللغة التلقائي")
    print("=" * 50)
    lang_detected = biobert._detect_language(sample_text_ar)
    print(f"اللغة المكتشفة: {lang_detected}")

    lang_detected_en = biobert._detect_language(sample_text_en)
    print(f"اللغة المكتشفة: {lang_detected_en}")

    print("\n" + "=" * 50)
    print("BioBERTMobile جاهز للاستخدام!")
    print("=" * 50)_entity_types()
        self.arabic_entity_types = self._load_arabic_entity_types()
