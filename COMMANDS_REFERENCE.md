# system Commands Reference

Quick reference for all system CLI commands and API calls.

---

## Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate

# Activate (Windows CMD)
venv\Scripts\activate.bat

# Activate (Windows PowerShell)
venv\Scripts\Activate.ps1

# Install dependencies
pip install -r python/requirements_full.txt

# Deactivate
deactivate
```

---

## Model Training (`train_models.py`)

### Basic Training
```bash
python train_models.py --data system_sample_training_data.csv
```

### Full Options
```bash
python train_models.py \
  --data system_sample_training_data.csv \
  --output models/ \
  --target all \
  --n-estimators 300 \
  --max-depth 5 \
  --learning-rate 0.05 \
  --cv-folds 5 \
  --test-size 0.2 \
  --random-state 42 \
  --save-report
```

### Train Specific Target
```bash
python train_models.py --target stunting
python train_models.py --target wasting
python train_models.py --target underweight
```

### Fast Training (fewer estimators)
```bash
python train_models.py --n-estimators 100 --max-depth 3
```

---

## Demo Predictions (`predict_demo_script.py`)

### Run Batch Demo (7 sample children)
```bash
python predict_demo_script.py
```

### Single Child Prediction
```bash
python predict_demo_script.py \
  --child-name "Amara Osei" \
  --age 18 \
  --sex female \
  --weight 8.2 \
  --height 76.5 \
  --muac 12.8
```

### Save Results to JSON
```bash
python predict_demo_script.py --output-json results.json
```

### Custom Model Directory
```bash
python predict_demo_script.py --model-dir /path/to/models
```

---

## API Server (`prediction_api.py`)

### Development Server
```bash
uvicorn prediction_api:app --reload --port 8000
```

### Production Server
```bash
uvicorn prediction_api:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --log-level info
```

### With Gunicorn (Linux/macOS)
```bash
gunicorn prediction_api:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  -b 0.0.0.0:8000 \
  --timeout 60
```

### Environment Variables
```bash
export system_MODEL_DIR=models
export system_HOST=0.0.0.0
export system_PORT=8000
uvicorn prediction_api:app
```

---

## API Calls (curl)

### Health Check
```bash
curl http://localhost:8000/health
```

### Model Information
```bash
curl http://localhost:8000/models/info
```

### Single Child Prediction
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

### Batch Prediction
```bash
curl -X POST http://localhost:8000/predict/batch \
  -H "Content-Type: application/json" \
  -d '{
    "children": [
      {
        "child_name": "Child 1",
        "age_months": 18,
        "sex": "female",
        "weight_kg": 8.2,
        "height_cm": 76.5,
        "muac_cm": 12.8
      },
      {
        "child_name": "Child 2",
        "age_months": 24,
        "sex": "male",
        "weight_kg": 11.5,
        "height_cm": 86.0,
        "muac_cm": 14.5
      }
    ]
  }'
```

### API Statistics
```bash
curl http://localhost:8000/stats
```

---

## Database Commands

### Setup PostgreSQL Database
```bash
# Create database
psql -U postgres -c "CREATE DATABASE system;"

# Run schema
psql -U postgres -d system -f schema.sql

# Connect to database
psql -U postgres -d system
```

### Common SQL Queries
```sql
-- Count predictions by risk level
SELECT overall_risk, COUNT(*) FROM predictions GROUP BY overall_risk;

-- Find critical cases
SELECT child_name, age_months, stunting_risk, wasting_risk
FROM predictions WHERE overall_risk = 'critical';

-- Recent predictions
SELECT * FROM predictions ORDER BY created_at DESC LIMIT 10;

-- Regional statistics
SELECT region, COUNT(*), AVG(stunting_probability)
FROM predictions
GROUP BY region
ORDER BY AVG(stunting_probability) DESC;
```

---

## Python API (Direct Usage)

```python
from xgboost_model import systemPredictor

# Load models
predictor = systemPredictor(model_dir="models")
predictor.load_all()

# Single prediction
result = predictor.predict({
    "child_name": "Amara Osei",
    "age_months": 18,
    "sex": "female",
    "weight_kg": 8.2,
    "height_cm": 76.5,
    "muac_cm": 12.8,
})

print(result.overall_risk)        # "high"
print(result.stunting_probability) # 0.72
result.print_summary()            # Formatted output

# Batch prediction
children = [
    {"child_name": "Child 1", "age_months": 18, "sex": "female",
     "weight_kg": 8.2, "height_cm": 76.5, "muac_cm": 12.8},
    {"child_name": "Child 2", "age_months": 24, "sex": "male",
     "weight_kg": 11.5, "height_cm": 86.0, "muac_cm": 14.5},
]
results = predictor.batch_predict(children)
```

---

## Z-Score Calculation

```python
from xgboost_model import compute_anthropometric_indices

z_scores = compute_anthropometric_indices(
    age_months=18,
    sex="female",
    weight_kg=8.2,
    height_cm=76.5,
    muac_cm=12.8,
)
print(z_scores)
# {'haz': -2.41, 'waz': -1.87, 'whz': -0.94, 'muacz': -1.15}
```

---

## Risk Classification Reference

```python
from xgboost_model import classify_risk, get_overall_risk

risk = classify_risk(0.75)  # "critical"
risk = classify_risk(0.30)  # "moderate"
risk = classify_risk(0.10)  # "low"

overall = get_overall_risk("high", "moderate", "low")  # "high"
```

---

## File Locations

| File | Description |
|------|-------------|
| `python/models/system_stunting_model.joblib` | Trained stunting model |
| `python/models/system_wasting_model.joblib` | Trained wasting model |
| `python/models/system_underweight_model.joblib` | Trained underweight model |
| `python/models/training_report.json` | Training metrics report |
| `python/system_sample_training_data.csv` | 500-record training dataset |
| `schema.sql` | Database schema |

---

## Useful Shortcuts

```bash
# Quick full pipeline
cd python && \
python train_models.py --data system_sample_training_data.csv && \
python predict_demo_script.py && \
uvicorn prediction_api:app --port 8000

# Check model files
ls -lh models/

# View training report
cat models/training_report.json | python -m json.tool

# Test API health (requires server running)
curl -s http://localhost:8000/health | python -m json.tool
```
