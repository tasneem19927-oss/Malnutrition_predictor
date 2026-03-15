"""
Nizam - Child Malnutrition Prediction System
XGBoost Model Utilities

This module provides utilities for training, saving, loading,
and evaluating XGBoost models for malnutrition prediction.

Author: Nizam AI Team
Version: 1.0.0
"""

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
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report,
    confusion_matrix
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)

# WHO Z-score reference constants (simplified LMS parameters)
# Source: WHO Child Growth Standards
WHO_REFERENCE = {
    "haz_median": {  # Height-for-Age median (cm)
        0: {"male": 49.9, "female": 49.1},
        6: {"male": 67.6, "female": 65.7},
        12: {"male": 75.7, "female": 74.0},
        18: {"male": 82.3, "female": 80.7},
        24: {"male": 87.8, "female": 86.4},
        36: {"male": 96.1, "female": 95.1},
        48: {"male": 103.3, "female": 102.7},
        60: {"male": 110.0, "female": 109.4},
    },
    "waz_median": {  # Weight-for-Age median (kg)
        0: {"male": 3.35, "female": 3.23},
        6: {"male": 7.93, "female": 7.30},
        12: {"male": 9.65, "female": 8.95},
        18: {"male": 10.9, "female": 10.2},
        24: {"male": 12.2, "female": 11.5},
        36: {"male": 14.3, "female": 13.9},
        48: {"male": 16.3, "female": 15.9},
        60: {"male": 18.3, "female": 17.7},
    },
    "sd": 0.12,  # Simplified SD (as fraction of median)
}


@dataclass
class ModelConfig:
    """XGBoost model configuration."""
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
    eval_metric: str = "logloss"

    def to_xgb_params(self) -> Dict:
        return {
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "learning_rate": self.learning_rate,
            "subsample": self.subsample,
            "colsample_bytree": self.colsample_bytree,
            "min_child_weight": self.min_child_weight,
            "gamma": self.gamma,
            "reg_alpha": self.reg_alpha,
            "reg_lambda": self.reg_lambda,
            "scale_pos_weight": self.scale_pos_weight,
            "random_state": self.random_state,
            "n_jobs": self.n_jobs,
            "eval_metric": self.eval_metric,
            "use_label_encoder": False,
        }


@dataclass
class ModelMetrics:
    """Model evaluation metrics."""
    accuracy: float
    precision: float
    recall: float
    f1: float
    auc_roc: float
    target: str
    training_samples: int
    test_samples: int
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class PredictionResult:
    """Result from a malnutrition prediction."""
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

    def to_dict(self) -> Dict:
        return asdict(self)

    def print_summary(self):
        """Print a formatted prediction summary."""
        risk_icons = {"low": "✓", "moderate": "⚠", "high": "!", "critical": "✗"}

        print("\n" + "=" * 60)
        print("  NIZAM PREDICTION RESULT")
        print("=" * 60)
        print(f"  Child    : {self.child_name}")
        print(f"  Age      : {self.age_months} months")
        print(f"  Sex      : {self.sex.title()}")
        print(f"  Weight   : {self.weight_kg:.1f} kg")
        print(f"  Height   : {self.height_cm:.1f} cm")
        print(f"  MUAC     : {self.muac_cm:.1f} cm")
        print("-" * 60)
        print("  MALNUTRITION ASSESSMENT")
        print("-" * 60)
        icon = risk_icons.get(self.stunting_risk, "?")
        print(f"  [{icon}] Stunting (HAZ)     : {self.stunting_risk.upper()} ({self.stunting_probability:.1%})")
        icon = risk_icons.get(self.wasting_risk, "?")
        print(f"  [{icon}] Wasting (WHZ)      : {self.wasting_risk.upper()} ({self.wasting_probability:.1%})")
        icon = risk_icons.get(self.underweight_risk, "?")
        print(f"  [{icon}] Underweight (WAZ)  : {self.underweight_risk.upper()} ({self.underweight_probability:.1%})")
        print("-" * 60)
        print(f"  OVERALL RISK         : {self.overall_risk.upper()}")
        if self.haz:
            print(f"\n  Z-Scores:")
            print(f"    HAZ (Height-for-Age)    : {self.haz:.2f}")
        if self.waz:
            print(f"    WAZ (Weight-for-Age)    : {self.waz:.2f}")
        print("=" * 60)


def compute_anthropometric_indices(
    age_months: int,
    sex: str,
    weight_kg: float,
    height_cm: float,
    muac_cm: float
) -> Dict[str, float]:
    """
    Compute WHO anthropometric z-scores.

    These are simplified approximations of WHO z-score calculations.
    For clinical use, use the WHO Anthro software.
    """
    sex = sex.lower()

    # Interpolate reference values
    age_keys = sorted(WHO_REFERENCE["haz_median"].keys())
    lower_age = max([a for a in age_keys if a <= age_months], default=0)
    upper_age = min([a for a in age_keys if a >= age_months], default=60)

    if lower_age == upper_age:
        h_median = WHO_REFERENCE["haz_median"][lower_age][sex]
        w_median = WHO_REFERENCE["waz_median"][lower_age][sex]
    else:
        t = (age_months - lower_age) / (upper_age - lower_age)
        h_median = (WHO_REFERENCE["haz_median"][lower_age][sex] * (1 - t) +
                    WHO_REFERENCE["haz_median"][upper_age][sex] * t)
        w_median = (WHO_REFERENCE["waz_median"][lower_age][sex] * (1 - t) +
                    WHO_REFERENCE["waz_median"][upper_age][sex] * t)

    sd = WHO_REFERENCE["sd"]
    haz = (height_cm - h_median) / (h_median * sd)
    waz = (weight_kg - w_median) / (w_median * sd)

    # Weight-for-Height (simplified)
    expected_weight_for_height = 0.0006 * (height_cm ** 2.1) * (0.9 if sex == "female" else 1.0)
    whz = (weight_kg - expected_weight_for_height) / (expected_weight_for_height * 0.15)

    # MUAC z-score (simplified)
    muac_median = 14.5 + (age_months * 0.035)
    muacz = (muac_cm - muac_median) / (muac_median * 0.08)

    return {
        "haz": round(float(haz), 3),
        "waz": round(float(waz), 3),
        "whz": round(float(whz), 3),
        "muacz": round(float(muacz), 3),
    }


def classify_risk(probability: float) -> str:
    """Convert probability to risk category."""
    if probability < 0.20:
        return "low"
    elif probability < 0.45:
        return "moderate"
    elif probability < 0.70:
        return "high"
    else:
        return "critical"


def get_overall_risk(stunting_risk: str, wasting_risk: str, underweight_risk: str) -> str:
    """Determine overall risk from individual risks."""
    risk_order = {"low": 0, "moderate": 1, "high": 2, "critical": 3}
    reverse_order = {0: "low", 1: "moderate", 2: "high", 3: "critical"}
    max_risk = max(
        risk_order[stunting_risk],
        risk_order[wasting_risk],
        risk_order[underweight_risk]
    )
    return reverse_order[max_risk]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Engineer features from raw child measurements.

    Args:
        df: DataFrame with columns: age_months, sex, weight_kg, height_cm, muac_cm

    Returns:
        DataFrame with engineered features
    """
    df = df.copy()

    # Sex encoding
    df["sex_encoded"] = (df["sex"].str.lower() == "male").astype(int)

    # BMI
    df["bmi"] = df["weight_kg"] / ((df["height_cm"] / 100) ** 2)

    # Weight-to-height ratio
    df["weight_height_ratio"] = df["weight_kg"] / df["height_cm"]

    # MUAC-to-height ratio
    df["muac_height_ratio"] = df["muac_cm"] / df["height_cm"]

    # Age-based features
    df["age_years"] = df["age_months"] / 12.0
    df["age_group"] = pd.cut(
        df["age_months"],
        bins=[0, 6, 12, 24, 36, 60],
        labels=[0, 1, 2, 3, 4],
        include_lowest=True
    ).astype(int)

    # Compute anthropometric z-scores for each row
    z_scores = df.apply(
        lambda row: compute_anthropometric_indices(
            int(row["age_months"]),
            str(row["sex"]),
            float(row["weight_kg"]),
            float(row["height_cm"]),
            float(row["muac_cm"])
        ),
        axis=1
    )
    z_df = pd.DataFrame(z_scores.tolist())
    df = pd.concat([df, z_df], axis=1)

    # Interaction features
    df["age_weight_interaction"] = df["age_months"] * df["weight_kg"]
    df["age_height_interaction"] = df["age_months"] * df["height_cm"]

    return df


FEATURE_COLUMNS = [
    "age_months", "sex_encoded", "weight_kg", "height_cm", "muac_cm",
    "bmi", "weight_height_ratio", "muac_height_ratio",
    "age_years", "age_group",
    "haz", "waz", "whz", "muacz",
    "age_weight_interaction", "age_height_interaction",
]


class NizamModel:
    """
    Nizam XGBoost model wrapper for malnutrition prediction.

    Supports training, evaluation, saving, loading, and prediction
    for three targets: stunting, wasting, and underweight.
    """

    def __init__(self, target: str, config: Optional[ModelConfig] = None):
        """
        Initialize model.

        Args:
            target: One of 'stunting', 'wasting', 'underweight'
            config: Model configuration (uses defaults if None)
        """
        assert target in ("stunting", "wasting", "underweight"), \
            f"target must be one of: stunting, wasting, underweight"
        self.target = target
        self.config = config or ModelConfig()
        self.model: Optional[xgb.XGBClassifier] = None
        self.feature_columns = FEATURE_COLUMNS
        self.metrics: Optional[ModelMetrics] = None
        self.version = "1.0.0"
        logger.info(f"NizamModel initialized for target: {target}")

    def _build_model(self) -> xgb.XGBClassifier:
        params = self.config.to_xgb_params()
        return xgb.XGBClassifier(**params)

    def train(self, df: pd.DataFrame, target_column: str) -> ModelMetrics:
        """
        Train the XGBoost model.

        Args:
            df: DataFrame with features and target
            target_column: Column name for the binary target (0/1)

        Returns:
            ModelMetrics with evaluation results
        """
        logger.info(f"Training {self.target} model on {len(df)} samples...")

        df_features = engineer_features(df)
        X = df_features[self.feature_columns].values
        y = df_features[target_column].values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=self.config.random_state, stratify=y
        )

        # Adjust scale_pos_weight for class imbalance
        pos_count = y_train.sum()
        neg_count = len(y_train) - pos_count
        if pos_count > 0:
            self.config.scale_pos_weight = neg_count / pos_count

        self.model = self._build_model()
        self.model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False
        )

        # Evaluate
        y_pred = self.model.predict(X_test)
        y_proba = self.model.predict_proba(X_test)[:, 1]

        self.metrics = ModelMetrics(
            accuracy=float(accuracy_score(y_test, y_pred)),
            precision=float(precision_score(y_test, y_pred, zero_division=0)),
            recall=float(recall_score(y_test, y_pred, zero_division=0)),
            f1=float(f1_score(y_test, y_pred, zero_division=0)),
            auc_roc=float(roc_auc_score(y_test, y_proba)),
            target=self.target,
            training_samples=len(X_train),
            test_samples=len(X_test),
        )

        logger.info(f"Model trained | AUC-ROC: {self.metrics.auc_roc:.4f} | F1: {self.metrics.f1:.4f}")
        return self.metrics

    def predict(self, child_data: Dict) -> Tuple[str, float]:
        """
        Predict malnutrition risk for a single child.

        Args:
            child_data: Dict with keys: age_months, sex, weight_kg, height_cm, muac_cm

        Returns:
            Tuple of (risk_category, probability)
        """
        if self.model is None:
            raise ValueError("Model not trained or loaded. Call .train() or .load() first.")

        df = pd.DataFrame([child_data])
        df_features = engineer_features(df)
        X = df_features[self.feature_columns].values

        proba = float(self.model.predict_proba(X)[0, 1])
        risk = classify_risk(proba)
        return risk, proba

    def get_feature_importance(self) -> pd.DataFrame:
        """Get feature importance as a DataFrame."""
        if self.model is None:
            raise ValueError("Model not trained.")
        importance = self.model.feature_importances_
        return pd.DataFrame({
            "feature": self.feature_columns,
            "importance": importance
        }).sort_values("importance", ascending=False)

    def save(self, directory: str = "models") -> str:
        """Save model to disk."""
        if self.model is None:
            raise ValueError("No model to save.")
        os.makedirs(directory, exist_ok=True)
        filepath = os.path.join(directory, f"nizam_{self.target}_model.joblib")
        metadata = {
            "target": self.target,
            "version": self.version,
            "feature_columns": self.feature_columns,
            "metrics": self.metrics.to_dict() if self.metrics else None,
            "config": asdict(self.config),
            "saved_at": datetime.now().isoformat(),
        }
        joblib.dump({
            "model": self.model,
            "metadata": metadata
        }, filepath)
        meta_path = filepath.replace(".joblib", "_metadata.json")
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"Model saved to: {filepath}")
        return filepath

    @classmethod
    def load(cls, target: str, directory: str = "models") -> "NizamModel":
        """Load a saved model from disk."""
        filepath = os.path.join(directory, f"nizam_{target}_model.joblib")
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file not found: {filepath}")
        saved = joblib.load(filepath)
        instance = cls(target=target)
        instance.model = saved["model"]
        metadata = saved.get("metadata", {})
        instance.version = metadata.get("version", "1.0.0")
        instance.feature_columns = metadata.get("feature_columns", FEATURE_COLUMNS)
        if metadata.get("metrics"):
            m = metadata["metrics"]
            instance.metrics = ModelMetrics(**m)
        logger.info(f"Model loaded from: {filepath}")
        return instance


class NizamPredictor:
    """
    Unified predictor that combines all three Nizam models
    (stunting, wasting, underweight) into a single prediction call.
    """

    def __init__(self, model_dir: str = "models"):
        self.model_dir = model_dir
        self.models: Dict[str, NizamModel] = {}

    def load_all(self):
        """Load all three models from disk."""
        for target in ("stunting", "wasting", "underweight"):
            self.models[target] = NizamModel.load(target, self.model_dir)
        logger.info("All Nizam models loaded successfully.")

    def predict(self, child_data: Dict) -> PredictionResult:
        """
        Run prediction for a child across all malnutrition types.

        Args:
            child_data: Dict with keys:
                - child_name: str
                - age_months: int
                - sex: str ('male' or 'female')
                - weight_kg: float
                - height_cm: float
                - muac_cm: float

        Returns:
            PredictionResult with all risk levels and probabilities
        """
        if not self.models:
            raise ValueError("Models not loaded. Call .load_all() first.")

        stunting_risk, stunting_prob = self.models["stunting"].predict(child_data)
        wasting_risk, wasting_prob = self.models["wasting"].predict(child_data)
        underweight_risk, underweight_prob = self.models["underweight"].predict(child_data)
        overall_risk = get_overall_risk(stunting_risk, wasting_risk, underweight_risk)

        z_scores = compute_anthropometric_indices(
            child_data["age_months"],
            child_data["sex"],
            child_data["weight_kg"],
            child_data["height_cm"],
            child_data["muac_cm"]
        )

        return PredictionResult(
            child_name=child_data.get("child_name", "Unknown"),
            age_months=child_data["age_months"],
            sex=child_data["sex"],
            weight_kg=child_data["weight_kg"],
            height_cm=child_data["height_cm"],
            muac_cm=child_data["muac_cm"],
            stunting_risk=stunting_risk,
            stunting_probability=round(stunting_prob, 4),
            wasting_risk=wasting_risk,
            wasting_probability=round(wasting_prob, 4),
            underweight_risk=underweight_risk,
            underweight_probability=round(underweight_prob, 4),
            overall_risk=overall_risk,
            haz=z_scores["haz"],
            waz=z_scores["waz"],
            whz=z_scores["whz"],
        )

    def batch_predict(self, children: List[Dict]) -> List[PredictionResult]:
        """Run predictions for a list of children."""
        results = []
        for child in children:
            result = self.predict(child)
            results.append(result)
        return results
