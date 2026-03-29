# system Windows Setup Guide

This guide walks you through setting up system on Windows (10/11).

---

## Prerequisites

### 1. Install Python

Download Python 3.10+ from: https://www.python.org/downloads/

**Important:** During installation, check **"Add Python to PATH"**

Verify installation:
```cmd
python --version
pip --version
```

### 2. Install Git (optional but recommended)

Download from: https://git-scm.com/download/win

---

## Setup Steps

### Step 1: Open Command Prompt or PowerShell

Press `Win + R`, type `cmd`, press Enter.

Or search for "PowerShell" in Start Menu.

### Step 2: Navigate to Project Folder

```cmd
cd C:\path\to\system\python
```

### Step 3: Create a Virtual Environment

```cmd
python -m venv venv
```

### Step 4: Activate Virtual Environment

**Command Prompt:**
```cmd
venv\Scripts\activate.bat
```

**PowerShell:**
```powershell
venv\Scripts\Activate.ps1
```

If you get a PowerShell execution policy error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

You should see `(venv)` at the start of your prompt when activated.

### Step 5: Install Dependencies

```cmd
pip install -r requirements_full.txt
```

This will take 3–5 minutes on first install.

**If you encounter errors with `xgboost`:**
```cmd
pip install xgboost --no-cache-dir
```

**If you encounter errors with `psycopg2`:**
```cmd
pip install psycopg2-binary
```

### Step 6: Train the Models

```cmd
python train_models.py --data system_sample_training_data.csv --output models\
```

Expected output:
```
Training stunting model... Done
Training wasting model...  Done
Training underweight model... Done
Models saved to: models\
```

### Step 7: Run Demo Predictions

```cmd
python predict_demo_script.py
```

### Step 8: Start the API Server

```cmd
uvicorn prediction_api:app --reload --port 8000
```

Open your browser: http://localhost:8000/docs

---

## PostgreSQL Setup on Windows

### Install PostgreSQL

1. Download from: https://www.postgresql.org/download/windows/
2. Run the installer
3. Remember your password for the `postgres` user
4. Default port: 5432

### Create system Database

Open **pgAdmin 4** (installed with PostgreSQL) or use SQL Shell (psql):

```sql
CREATE DATABASE system;
\c system
```

Then run the schema:
```cmd
psql -U postgres -d system -f ..\schema.sql
```

### Environment Variables

Create a `.env` file in the `python/` folder:

```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/system
system_MODEL_DIR=models
system_HOST=127.0.0.1
system_PORT=8000
```

---

## Troubleshooting

### Python not found
- Make sure Python is added to PATH
- Restart Command Prompt after installation
- Try `python3` instead of `python`

### `pip install` fails with SSL error
```cmd
pip install --trusted-host pypi.python.org --trusted-host files.pythonhosted.org --trusted-host pypi.org -r requirements_full.txt
```

### XGBoost installation fails on Windows
Try installing Microsoft C++ Build Tools:
- Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- Select "Desktop development with C++" workload

### Port 8000 already in use
```cmd
# Use a different port
uvicorn prediction_api:app --port 8001
```

### Model file not found
Make sure you've run training first:
```cmd
python train_models.py --data system_sample_training_data.csv
```

---

## Quick Test

After setup, test everything works:

```cmd
# Test model training
python train_models.py --data system_sample_training_data.csv --n-estimators 50

# Test prediction
python predict_demo_script.py

# Test single prediction
python predict_demo_script.py --child-name "Test Child" --age 24 --sex female --weight 10.5 --height 84.0 --muac 14.0

# Test API
uvicorn prediction_api:app --port 8000
# Then open: http://localhost:8000/health
```

---

## Performance Tips for Windows

- **Use SSD** for model storage if available
- **Increase virtual memory** if RAM is limited (8GB+ recommended)
- **Close background applications** during model training
- **Use WSL2** (Windows Subsystem for Linux) for better Python performance

---

## Support

If you encounter issues:
1. Check this troubleshooting section
2. Check the main README.md
3. Open an issue on the project repository
