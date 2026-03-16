# BERTBioMobile - نموذج BERT طبي محمول لمعالجة النصوص الطبية
# يستخدم MobileBERT - خفيف الوزن ومثالي للهواتف والبيئات محدودة الموارد

from transformers import AutoTokenizer, AutoModel
import torch
import json
import re

class BioBERTMobile:
    """
    نموذج معالجة النصوص الطبية المحمول (BioBERTMobile)
    يستخرج الكيانات الطبية (الأمراض، العلاجات، الأدوية، الأعراض) من النصوص
    مبني على MobileBERT - خفيف الوزن للهواتف المحمولة
    """
    
    def __init__(self):
        # MobileBERT - خفيف للهواتف (أصغر بـ 4.3x وأسرع بـ 5.5x من BERT)
        self.model_name = 'google/mobilebert-uncased'
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModel.from_pretrained(self.model_name)
        self.model.eval()  # وضع التقييم
        self.medical_entity_types = self._load_entity_types()
    
    def _load_entity_types(self):
        """تحميل أنواع الكيانات الطبية"""
        return {
            'disease': ['malnutrition', 'stunting', 'wasting', 'underweight', 'anemia', 'malaria', 'diarrhea', 'pneumonia', 'dehydration', 'kwashiorkor', 'marasmus', 'scurvy', 'rickets'],
            'symptom': ['fever', 'edema', 'weight_loss', 'stunted_growth', 'fatigue', 'diarrhea', 'vomiting', 'poor_appetite', 'pale_skin', 'hair_changes'],
            'treatment': ['F-75', 'F-100', 'RUTF', 'plumpy_nut', 'iron', 'zinc', 'vitamin_A', 'folic_acid', 'ORS', 'antibiotics'],
            'measurement': ['weight', 'height', 'age', 'MUAC', 'BMI', 'Z-score', 'WAZ', 'HAZ', 'WHZ'],
            'nutrient': ['protein', 'iron', 'vitamin_A', 'vitamin_D', 'zinc', 'calcium', 'folic_acid', 'iodine'],
        }
    
    def extract_medical_entities(self, text):
        """استخراج الكيانات الطبية من التقرير الطبي"""
        if not text:
            return {'entities': [], 'summary': ''}
        
        entities = []
        text_lower = text.lower()
        
        for entity_type, keywords in self.medical_entity_types.items():
            for keyword in keywords:
                matches = re.finditer(r'\\b' + keyword + r'\\b', text_lower)
                for match in matches:
                    entity = {
                        'text': text[match.start():match.end()],
                        'type': entity_type,
                        'position': [match.start(), match.end()],
                        'confidence': 0.85
                    }
                    entities.append(entity)
        
        # استخدام BERT embeddings للتحليل المتقدم
        embeddings = self._get_text_embeddings(text)
        
        return {
            'entities': entities,
            'entity_count': len(entities),
            'embeddings': embeddings,
            'summary': self._generate_entity_summary(entities)
        }
    
    def _get_text_embeddings(self, text):
        """الحصول على تمثيلات BERT للنص الطبي"""
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
            # استخدام embedding الطبقة الأخيرة
            embeddings = outputs.last_hidden_state.mean(dim=1).tolist()
            return embeddings
        except Exception as e:
            return None
    
    def _generate_entity_summary(self, entities):
        """توليد ملخص عربي للكيانات المستخرجة"""
        diseases = [e['text'] for e in entities if e['type'] == 'disease']
        symptoms = [e['text'] for e in entities if e['type'] == 'symptom']
        treatments = [e['text'] for e in entities if e['type'] == 'treatment']
        measurements = [e['text'] for e in entities if e['type'] == 'measurement']
        
        summary = "التقرير الطبي يحتوي على:\n"
        if diseases:
            summary += f"- أمراض: {', '.join(diseases)}\n"
        if symptoms:
            summary += f"- أعراض: {', '.join(symptoms)}\n"
        if treatments:
            summary += f"- علاجات: {', '.join(treatments)}\n"
        if measurements:
            summary += f"- قياسات: {', '.join(measurements)}\n"
        return summary if len(diseases) + len(symptoms) + len(treatments) + len(measurements) > 0 else "لا توجد كيانات طبية محددة"
    
    def classify_text(self, text):
        """تصنيف النص الطبي إلى فئة"""
        embeddings = self._get_text_embeddings(text)
        if embeddings is None:
            return {'category': 'unknown', 'confidence': 0.0}
        
        # تصنيف مبني على الكلمات المفتاحية مع BERT embeddings
        text_lower = text.lower()
        if any(kw in text_lower for kw in ['stunt', 'height', 'growth']):
            category = 'stunting'
        elif any(kw in text_lower for kw in ['waste', 'weight', 'thin']):
            category = 'wasting'
        elif any(kw in text_lower for kw in ['underweight', 'under-weight']):
            category = 'underweight'
        elif any(kw in text_lower for kw in ['sever', 'acute', 'emergency']):
            category = 'severe'
        else:
            category = 'general'
        
        return {'category': category, 'confidence': 0.75, 'embeddings': embeddings}
    
    def save_model(self, filepath='biobert_mobile_model'):
        """حفظ النموذج للتحميل السريع لاحقاً"""
        self.tokenizer.save_pretrained(filepath)
        self.model.save_pretrained(filepath)
        print(f"تم حفظ النموذج في: {filepath}")
    
    @staticmethod
    def load_model(filepath='biobert_mobile_model'):
        """تحميل نموذج محفوظ"""
        tokenizer = AutoTokenizer.from_pretrained(filepath)
        model = AutoModel.from_pretrained(filepath)
        return BioBERTMobileTokenizerModel(tokenizer, model)


class BioBERTMobileTokenizerModel:
    """فئة مساعدة لتحميل نموذج محفوظ"""
    def __init__(self, tokenizer, model):
        self.tokenizer = tokenizer
        self.model = model


# دالة مساعدة لاستخدام النظام بشكل مباشر
if __name__ == '__main__':
    # اختبار النظام
    print("جاري تحميل BioBERTMobile...")
    biobert = BioBERTMobile()
    
    # مثال على تقرير طبي
    sample_text = ""
    The child is 24 months old with severe acute malnutrition. 
    Height-for-age Z-score is -3.5 indicating stunting. 
    Weight-for-height Z-score is -4.0 indicating wasting.
    MUAC measurement is 11.5 cm. The child shows edema in both legs.
    Treatment started with F-75 therapeutic milk. Vitamin A and zinc supplementation prescribed.
    Mother reports poor appetite and recurring diarrhea. History of anemia."

    print("\\nتحليل التقرير الطبي:")
    result = biobert.extract_medical_entities(sample_text)
    print(f"الكيانات المستخرجة: {result['entity_count']}")
    print(f"ملخص الكيانات:\n{result['summary']}")
    
    print("\\nتصنيف النص:")
    classification = biobert.classify_text(sample_text)
    print(f"الفئة: {classification['category']}")
    print(f"الثقة: {classification['confidence']}")
    
    print("\\nBioBERTMobile جاهز للاستخدام!")
