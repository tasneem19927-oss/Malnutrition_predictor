# system - Child Malnutrition Prediction System

**system** is an AI-powered, offline-first platform for predicting malnutrition (stunting, wasting, and underweight) in children aged 0–60 months using XGBoost machine learning models.

---

## Overview

Child malnutrition remains a critical global health challenge. system provides frontline health workers with a fast, accurate, and offline-capable tool to assess malnutrition risk and prioritize interventions.

### What system Predicts

| Type | Clinical Definition | Primary Indicator |
|------|--------------------|--------------------|
| **Stunting** | Chronic malnutrition (HAZ < −2 SD) | Height-for-Age Z-score |
| **Wasting** | Acute malnutrition (WHZ < −2 SD) | Weight-for-Height Z-score |
| **Underweight** | Combined malnutrition (WAZ < −2 SD) | Weight-for-Age Z-score |

### Risk Levels

| Level | Probability | Action |
|-------|-------------|--------|
| **Low** | < 20% | Routine monitoring |
| **Moderate** | 20–45% | Enhanced monitoring, nutrition counseling |
| **High** | 45–70% | Immediate intervention, therapeutic feeding |
| **Critical** | > 70% | Emergency referral, inpatient care |

---

## Project Structure

```
system/
├── python/
│   ├── train_models.py              # XGBoost model training script
│   ├── predict_demo_script.py       # Batch prediction demo
│   ├── prediction_api.py            # FastAPI REST API server
│   ├── xgboost_model.py             # ML utilities and model classes
│   ├── system_sample_training_data.csv  # 500 sample child records
│   └── requirements_full.txt        # Python dependencies
├── schema.sql                       # PostgreSQL database schema
├── README.md                        # This file
├── WINDOWS_SETUP.md                 # Windows setup guide
└── COMMANDS_REFERENCE.md            # Quick commands reference
```

---

## Quick Start

### 1. Install Python Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate       # Linux/macOS
venv\Scripts\activate.bat      # Windows

# Install dependencies
pip install -r python/requirements_full.txt
```

### 2. Train the Models

```bash
cd python
python train_models.py --data system_sample_training_data.csv --output models/
```

Expected output:
```
Training stunting model... AUC-ROC: 0.89 | F1: 0.82
Training wasting model...  AUC-ROC: 0.91 | F1: 0.85
Training underweight model... AUC-ROC: 0.88 | F1: 0.80
Models saved to: models/
```

### 3. Run Demo Predictions

```bash
python predict_demo_script.py
```

### 4. Start the Prediction API

```bash
uvicorn prediction_api:app --reload --port 8000
```

API documentation available at: `http://localhost:8000/docs`

---

## Model Features

The XGBoost models use 16 engineered features:

| Feature | Description |
|---------|-------------|
| `age_months` | Child's age in months |
| `sex_encoded` | Sex (0=female, 1=male) |
| `weight_kg` | Weight in kilograms |
| `height_cm` | Height in centimeters |
| `muac_cm` | Mid-Upper Arm Circumference |
| `bmi` | Body Mass Index |
| `weight_height_ratio` | Weight-to-height ratio |
| `muac_height_ratio` | MUAC-to-height ratio |
| `age_years` | Age in years (continuous) |
| `age_group` | Age group category (0–4) |
| `haz` | Height-for-Age Z-score |
| `waz` | Weight-for-Age Z-score |
| `whz` | Weight-for-Height Z-score |
| `muacz` | MUAC-for-Age Z-score |
| `age_weight_interaction` | Age × weight interaction |
| `age_height_interaction` | Age × height interaction |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/models/info` | Model versions and metrics |
| `POST` | `/predict` | Single child prediction |
| `POST` | `/predict/batch` | Batch prediction (up to 500) |
| `GET` | `/stats` | Usage statistics |
| `GET` | `/docs` | Interactive API documentation |

### Example API Call

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "child_name": "Amara Osei",
    "age_months": 18,
    "sex": "female",
    "weight_kg": 8.2,
    "height_cm": 76.5,
    "muac_cm": 12.8,
    "region": "Central"
  }'
```

---

## Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE system;"

# Run schema
psql -U postgres -d system -f schema.sql
```

---

## Training Data Format

The CSV file must contain:

| Column | Type | Range | Description |
|--------|------|-------|-------------|
| `child_id` | int | 1+ | Unique identifier |
| `child_name` | str | — | Child's name |
| `age_months` | int | 0–60 | Age in months |
| `sex` | str | male/female | Child's sex |
| `weight_kg` | float | 0.5–30 | Weight (kg) |
| `height_cm` | float | 30–130 | Height (cm) |
| `muac_cm` | float | 6–25 | MUAC (cm) |
| `region` | str | — | Geographic region |
| `is_stunted` | int | 0/1 | Stunting label |
| `is_wasted` | int | 0/1 | Wasting label |
| `is_underweight` | int | 0/1 | Underweight label |

---

## Model Performance (on sample data)

| Model | Accuracy | AUC-ROC | F1 | Recall |
|-------|----------|---------|-----|--------|
| Stunting | ~87% | ~0.89 | ~0.82 | ~0.85 |
| Wasting | ~89% | ~0.91 | ~0.85 | ~0.88 |
| Underweight | ~86% | ~0.88 | ~0.80 | ~0.83 |

*Performance varies depending on training data quality and size.*

---

## Clinical Disclaimer

system is a decision-support tool intended to assist health workers — not replace clinical judgment. All predictions should be validated by qualified health professionals before clinical decisions are made.

---

## License

MIT License — See LICENSE file for details.

## Contact

For support and contributions, please open an issue on the project repository.

---

## Advanced AI Features (v2.0)

system now includes advanced AI technologies for intelligent decision support:

### RAG (Retrieval-Augmented Generation)
- **Purpose**: Provides scientific evidence and treatment recommendations for each prediction.
- **Technology**: `sentence-transformers` with `FAISS` index for fast retrieval.
- **Knowledge Base**: Over 100 peer-reviewed research papers on child malnutrition (2020-2026).
- **Supported Languages**: Arabic and English (multilingual embeddings).
- **Output**: Relevant scientific papers, WHO treatment protocols, and evidence-based recommendations.

### BioBERTMobile
- **Purpose**: Analyzes medical text (clinical notes, patient reports) to extract medical entities.
- **Technology**: `MobileBERT` from Google - optimized for mobile/edge deployment.
- **Capabilities**:
  - Named Entity Recognition (diseases, symptoms, treatments)
  - Medical text classification
  - Lightweight inference for low-resource devices
- **Integration**: Works alongside ML models for holistic child health assessment.

### Enhancedsystem Pipeline
- **Integration**: Combines XGBoost ML predictions + RAG evidence + BioBERT medical analysis.
- **API Endpoint**: `GET /predict/enhanced`
- **Output**: Comprehensive report with ML prediction, scientific evidence, and medical entities.

### New Files
| File | Description |
|------|-------------|
| `rag_system.py` | RAG system for medical knowledge retrieval |
| `biobert_mobile.py` | MobileBERT for medical text analysis |
| `knowledge_base.json` | Scientific papers and treatment guidelines |
| `enhanced_prediction_api.py` | Enhanced prediction API with RAG + BioBERT |

### Updated Requirements
Add these packages: `sentence-transformers`, `faiss-cpu`, `transformers`, `torch`

> **Research Foundation**: Built on peer-reviewed studies including XGBoost achieving 98% accuracy for malnutrition prediction (Anku et al., PLoS ONE, 2024).
