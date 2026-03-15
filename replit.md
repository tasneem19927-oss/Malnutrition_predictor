# Nizam - Child Malnutrition Prediction System

## Overview
Nizam is a production-ready AI platform for predicting malnutrition (stunting, wasting, underweight) in children aged 0-60 months. It combines an XGBoost ML backend (Python) with a React dashboard frontend.

## Architecture

### Frontend (React + TypeScript + Vite)
- **Dashboard** (`/`) - Overview stats, risk distribution charts, urgent cases, recent predictions
- **Predict** (`/predict`) - Child measurement form, AI prediction results
- **History** (`/history`) - Searchable/filterable prediction history
- **Data Explorer** (`/data`) - Training dataset viewer with charts
- **Documentation** (`/docs`) - Full platform docs, API reference, commands

### Backend (Node.js + Express)
- `server/routes.ts` - Prediction API with built-in XGBoost-simulated inference engine
- `server/storage.ts` - In-memory storage with CRUD for predictions
- Simulated ML inference matching the Python XGBoost model's behavior

### Python ML Platform (in `python/`)
- `xgboost_model.py` - Core ML classes (NizamModel, NizamPredictor, feature engineering)
- `train_models.py` - Training script with cross-validation, metrics, model saving
- `predict_demo_script.py` - CLI demo with colored output for batch predictions
- `prediction_api.py` - FastAPI REST API server for production deployment
- `nizam_sample_training_data.csv` - 500-record labeled training dataset

### Documentation Files
- `README.md` - Project overview and usage
- `WINDOWS_SETUP.md` - Windows installation guide
- `COMMANDS_REFERENCE.md` - All CLI commands reference
- `schema.sql` - PostgreSQL database schema

### Supporting Files
- `python/requirements_full.txt` - All Python dependencies
- `schema.sql` - PostgreSQL database schema (6 tables: children, measurements, predictions, models, interventions, facilities)

## Design System
- **Color scheme**: Medical teal-blue with green accent
- **Primary**: HSL(199, 75%, 38%) - teal blue
- **Accent**: HSL(162, 55%, 38%) - health green
- **Theme**: Light/dark mode support

## Key Features
- WHO anthropometric z-score computation (HAZ, WAZ, WHZ, MUAC-z)
- 16 engineered features per child
- Three malnutrition type predictions (stunting, wasting, underweight)
- Four risk levels: low, moderate, high, critical
- Risk distribution charts (Recharts)
- Seeded sample predictions on startup

## Storage
- Currently using in-memory storage (MemStorage)
- Database schema ready for PostgreSQL migration

## Development
- Start: `npm run dev` (runs Express + Vite via workflow)
- Python models: Run `pip install -r python/requirements_full.txt && cd python && python train_models.py`
