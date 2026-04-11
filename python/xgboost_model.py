\"\"\"
system - Child Malnutrition Prediction System
XGBoost Model Utilities

This module provides utilities for training, saving, loading,
and evaluating XGBoost models for malnutrition prediction.

Author: system AI Team
Version: 1.1.0
\"\"\"

import os
import json
import logging
import numpy as np
import pandas as pd
import joblib
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format=\"%(asctime)s [%(levelname)s] %(name)s - %(message)s\"
)
logger = logging.getLogger(__name__)

# WHO Z-score reference constants
WHO_REFERENCE = {
    \"haz_median\": {
        0: {\"male\": 49.9, \"female\": 49.1},
        6: {\"male\": 67.6, \"female\": 65.7},
        12: {\"male\": 75.7, \"female\": 74.0},
        18: {\"male\": 82.3, \"female\": 80.7},
        24: {\"male\": 87.8, \"female\": 86.4},
        36: {\"male\": 96.1, \"female\": 95.1},
        48: {\"male\": 103.3, \"female\": 102.7},
        60: {\"male\": 110.0, \"female\": 109.4},
    },
    \"waz_median\": {
        0: {\"male\": 3.35, \"female\": 3.23},
        6: {\"male\": 7.93, \"female\": 7.30},
        12: {\"male\": 9.65, \"female\": 8.95},
        18: {\"male\": 10.9, \"female\": 10.2},
        24: {\"male\": 12.2, \"female\": 11.5},
        36: {\"male\": 14.3, \"female\": 13.9},
        48: {\"male\": 16.3, \"female\": 15.9},
        60: {\"male\": 18.3, \"female\": 17.7},
    },
    \"sd\": 0.12,
}

@dataclass
class ModelConfig:
    n_estimators: int = 300
    max_depth: int = 5
    learning_rate: float = 0.05
    subsample: float = 0.8
    colsample_bytree: float = 0.8
    min_child_weight: int = 3
    gamma: float = 0.1
    reg_alpha: float = 0.1
    reg_lambda: float = 1.0
    scale_pos_weight: float = 1.0
    random_state: int = 42
    n_jobs: int = -1
    eval_metric: str = \"logloss\"

    def to_xgb_params(self) -> Dict:
        return {
            \"n_estimators\": self.n_estimators,
            \"max_depth\": self.max_depth,
            \"learning_rate\": self.learning_rate,
            \"subsample\": self.subsample,
            \"colsample_bytree\": self.colsample_bytree,
            \"min_child_weight\": self.min_child_weight,
            \"gamma\": self.gamma,
            \"reg_alpha\": self.reg_alpha,
            \"reg_lambda\": self.reg_lambda,
            \"scale_pos_weight\": self.scale_pos_weight,
            \"random_state\": self.random_state,
            \"n_jobs\": self.n_jobs,
            \"eval_metric\": self.eval_metric,
        }

@dataclass
class ModelMetrics:
    accuracy: float
    precision: float
    recall: float
    f1: float
    auc_roc: float
    target: str
    training_samples: int
    test_samples: int
    timestamp: str = \"\"

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()

    def to_dict(self) -> Dict:
        return asdict(self)

@dataclass
class PredictionResult:
    child_name: str
    age_months: int
    sex: str
    weight_kg: float
    height_cm: float
    muac_cm: float
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
    stunting_severity: str = \"Normal\"
    wasting_severity: str = \"Normal\"
    underweight_severity: str = \"Normal\"

    def to_dict(self) -> Dict:
        return asdict(self)

    def print_summary(self):
        risk_icons = {\"low\": \"✓\", \"moderate\": \"⚠\", \"high\": \"!\", \"critical\": \"✗\"}
        severity_colors = {
            \"Normal\": \"\", \"Mild\": \" (Mild)\", \"Moderate\": \" (MODERATE)\", \"Severe\": \" (SEVERE)\",
            \"طبيعي\": \"\", \"خفيف\": \" (خفيف)\", \"متوسط\": \" (متوسط)\", \"حاد\": \" (حاد)\"
        }
        
        print(\"\
\" + \"=\" * 60)
        print(\" system PREDICTION RESULT\")
        print(\"=\" * 60)
        print(f\" Child  : {self.child_name}\")
        print(f\" Age    : {self.age_months} months\")
        print(f\" Sex    : {self.sex.title()}\")
        print(f\" Weight : {self.weight_kg:.1f} kg\")
        print(f\" Height : {self.height_cm:.1f} cm\")
        print(f\" MUAC   : {self.muac_cm:.1f} cm\")
        print(\"-\" * 60)
        print(\" MALNUTRITION ASSESSMENT (WHO THRESHOLDS)\")
        print(\"-\" * 60)
        
        icon = risk_icons.get(self.stunting_risk, \"?\")
        print(f\" [{icon}] Stunting (HAZ)    : {self.stunting_risk.upper()} | Severity: {self.stunting_severity}\")
        
        icon = risk_icons.get(self.wasting_risk, \"?\")
        print(f\" [{icon}] Wasting (WHZ/MUAC): {self.wasting_risk.upper()} | Severity: {self.wasting_severity}\")
        
        icon = risk_icons.get(self.underweight_risk, \"?\")
        print(f\" [{icon}] Underweight (WAZ): {self.underweight_risk.upper()} | Severity: {self.underweight_severity}\")
        
        print(\"-\" * 60)
        print(f\" OVERALL RISK : {self.overall_risk.upper()}\")
        
        if self.haz is not None:
            print(f\"\
 Z-Scores:\")
            print(f\" HAZ (Height-for-Age) : {self.haz:.2f}\")
            print(f\" WAZ (Weight-for-Age) : {self.waz:.2f}\" if self.waz is not None else \"\")
            print(f\" WHZ (Weight-for-Height): {self.whz:.2f}\" if self.whz is not None else \"\")
        print(\"=\" * 60)

def classify_severity(z_score: float, indicator: str, muac: Optional[float] = None) -> str:
    \"\"\"
    Classify severity according to WHO thresholds.
    Returns: Normal, Mild, Moderate, Severe (or Arabic equivalent)
    \"\"\"
    # Support for MUAC in Wasting
    if indicator == \"wasting\" and muac is not None:
        if z_score < -3 or muac < 11.5: return \"Severe\"
        if -3 <= z_score < -2 or 11.5 <= muac < 12.5: return \"Moderate\"
        if -2 <= z_score < -1 or 12.5 <= muac < 13.5: return \"Mild\"
        return \"Normal\"
    
    # Generic Z-score based indicators (Stunting, Underweight)
    if z_score < -3: return \"Severe\"
    if -3 <= z_score < -2: return \"Moderate\"
    if -2 <= z_score < -1: return \"Mild\"
    return \"Normal\"

def compute_anthropometric_indices(
    age_months: int, sex: str, weight_kg: float, height_cm: float, muac_cm: float
) -> Dict[str, float]:
    sex = sex.lower()
    age_keys = sorted(WHO_REFERENCE[\"haz_median\"].keys())
    lower_age = max([a for a in age_keys if a <= age_months], default=0)
    upper_age = min([a for a in age_keys if a >= age_months], default=60)
    
    if lower_age == upper_age:
        h_median = WHO_REFERENCE[\"haz_median\"][lower_age][sex]
        w_median = WHO_REFERENCE[\"waz_median\"][lower_age][sex]
    else:
        t = (age_months - lower_age) / (upper_age - lower_age)
        h_median = (WHO_REFERENCE[\"haz_median\"][lower_age][sex] * (1 - t) +
                   WHO_REFERENCE[\"haz_median\"][upper_age][sex] * t)
        w_median = (WHO_REFERENCE[\"waz_median\"][lower_age][sex] * (1 - t) +
                   WHO_REFERENCE[\"waz_median\"][upper_age][sex] * t)
                   
    sd = WHO_REFERENCE[\"sd\"]
    haz = (height_cm - h_median) / (h_median * sd)
    waz = (weight_kg - w_median) / (w_median * sd)
    
    # Weight-for-Height (simplified approximation)
    expected_weight_for_height = 0.0006 * (height_cm ** 2.1) * (0.9 if sex == \"female\" else 1.0)
    whz = (weight_kg - expected_weight_for_height) / (expected_weight_for_height * 0.15)
    
    return {
        \"haz\": round(float(haz), 3),
        \"waz\": round(float(waz), 3),
        \"whz\": round(float(whz), 3),
    }

def classify_risk(probability: float) -> str:
    if probability < 0.20: return \"low\"
    if probability < 0.45: return \"moderate\"
    if probability < 0.70: return \"high\"
    return \"critical\"

def get_overall_risk(stunting_risk: str, wasting_risk: str, underweight_risk: str) -> str:
    risk_order = {\"low\": 0, \"moderate\": 1, \"high\": 2, \"critical\": 3}
    reverse_order = {0: \"low\", 1: \"moderate\", 2: \"high\", 3: \"critical\"}
    max_risk = max(risk_order[stunting_risk], risk_order[wasting_risk], risk_order[underweight_risk])
    return reverse_order[max_risk]

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df[\"sex_encoded\"] = (df[\"sex\"].str.lower() == \"male\").astype(int)
    df[\"bmi\"] = df[\"weight_kg\"] / ((df[\"height_cm\"] / 100) ** 2)
    df[\"weight_height_ratio\"] = df[\"weight_kg\"] / df[\"height_cm\"]
    df[\"muac_height_ratio\"] = df[\"muac_cm\"] / df[\"height_cm\"]
    df[\"age_years\"] = df[\"age_months\"] / 12.0
    df[\"age_group\"] = pd.cut(df[\"age_months\"], bins=[0, 6, 12, 24, 36, 60], labels=[0, 1, 2, 3, 4], include_lowest=True).astype(int)
    
    z_scores = df.apply(lambda r: compute_anthropometric_indices(int(r[\"age_months\"]), str(r[\"sex\"]), float(r[\"weight_kg\"]), float(r[\"height_cm\"]), float(r[\"muac_cm\"])), axis=1)
    z_df = pd.DataFrame(z_scores.tolist())
    df = pd.concat([df, z_df], axis=1)
    
    df[\"age_weight_interaction\"] = df[\"age_months\"] * df[\"weight_kg\"]
    df[\"age_height_interaction\"] = df[\"age_months\"] * df[\"height_cm\"]
    return df

FEATURE_COLUMNS = [
    \"age_months\", \"sex_encoded\", \"weight_kg\", \"height_cm\", \"muac_cm\",
    \"bmi\", \"weight_height_ratio\", \"muac_height_ratio\",
    \"age_years\", \"age_group\", \"haz\", \"waz\", \"whz\",
    \"age_weight_interaction\", \"age_height_interaction\",
]

class systemModel:
    def __init__(self, target: str, config: Optional[ModelConfig] = None):
        self.target = target
        self.config = config or ModelConfig()
        self.model: Optional[xgb.XGBClassifier] = None
        self.feature_columns = FEATURE_COLUMNS
        self.metrics: Optional[ModelMetrics] = None
        self.version = \"1.1.0\"

    def predict(self, child_data: Dict) -> Tuple[str, float]:
        if self.model is None: raise ValueError(\"Model not loaded.\")
        df = pd.DataFrame([child_data])
        df_features = engineer_features(df)
        X = df_features[self.feature_columns].values
        proba = float(self.model.predict_proba(X)[0, 1])
        return classify_risk(proba), proba

    def save(self, directory: str = \"models\") -> str:
        os.makedirs(directory, exist_ok=True)
        filepath = os.path.join(directory, f\"system_{self.target}_model.joblib\")
        joblib.dump({\"model\": self.model, \"metadata\": {\"target\": self.target, \"version\": self.version}}, filepath)
        return filepath

    @classmethod
    def load(cls, target: str, directory: str = \"models\") -> \"systemModel\":
        filepath = os.path.join(directory, f\"system_{target}_model.joblib\")
        saved = joblib.load(filepath)
        instance = cls(target=target)
        instance.model = saved[\"model\"]
        return instance

class systemPredictor:
    def __init__(self, model_dir: str = \"models\"):
        self.model_dir = model_dir
        self.models: Dict[str, systemModel] = {}

    def load_all(self):
        for target in (\"stunting\", \"wasting\", \"underweight\"):
            self.models[target] = systemModel.load(target, self.model_dir)

    def predict(self, child_data: Dict) -> PredictionResult:
        if not self.models: raise ValueError(\"Models not loaded.\")
        
        s_risk, s_prob = self.models[\"stunting\"].predict(child_data)
        w_risk, w_prob = self.models[\"wasting\"].predict(child_data)
        u_risk, u_prob = self.models[\"underweight\"].predict(child_data)
        
        z = compute_anthropometric_indices(
            child_data[\"age_months\"], child_data[\"sex\"], 
            child_data[\"weight_kg\"], child_data[\"height_cm\"], child_data[\"muac_cm\"]
        )
        
        return PredictionResult(
            child_name=child_data.get(\"child_name\", \"Unknown\"),
            age_months=child_data[\"age_months\"],
            sex=child_data[\"sex\"],
            weight_kg=child_data[\"weight_kg\"],
            height_cm=child_data[\"height_cm\"],
            muac_cm=child_data[\"muac_cm\"],
            stunting_risk=s_risk,
            stunting_probability=round(s_prob, 4),
            wasting_risk=w_risk,
            wasting_probability=round(w_prob, 4),
            underweight_risk=u_risk,
            underweight_probability=round(u_prob, 4),
            overall_risk=get_overall_risk(s_risk, w_risk, u_risk),
            haz=z[\"haz\"], waz=z[\"waz\"], whz=z[\"whz\"],
            stunting_severity=classify_severity(z[\"haz\"], \"stunting\"),
            wasting_severity=classify_severity(z[\"whz\"], \"wasting\", child_data[\"muac_cm\"]),
            underweight_severity=classify_severity(z[\"waz\"], \"underweight\")
        )
