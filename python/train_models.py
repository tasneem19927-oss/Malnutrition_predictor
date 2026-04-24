"""
system - Child Malnutrition Prediction System
Model Training Script

This script trains three XGBoost models (stunting, wasting, underweight)
on the system sample training dataset.

Usage:
    python train_models.py --data system_sample_training_data.csv --output models/
    python train_models.py --help

Author: system AI Team
Version: 1.0.0
"""

import os
import sys
import time
import json
import logging
import argparse
import warnings
from pathlib import Path
from typing import Dict
# from rag_system import systemRAG
# from biobert_mobile import BioBERTMobile

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report
)

# Suppress XGBoost warnings
warnings.filterwarnings("ignore", category=UserWarning)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from xgboost_model import (
    systemModel, ModelConfig, engineer_features,
    classify_risk, FEATURE_COLUMNS
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger("system.train")

BANNER = """
╔══════════════════════════════════════════════════════════════╗
║          system - Child Malnutrition Prediction System        ║
║                     Model Training Script                    ║
║                          v1.0.0                              ║
╚══════════════════════════════════════════════════════════════╝
"""

TARGET_COLUMNS = {
    "stunting": "is_stunted",
    "wasting": "is_wasted",
    "underweight": "is_underweight",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train system malnutrition prediction models",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "--data",
        type=str,
        default="system_sample_training_data.csv",
        help="Path to training data CSV"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models",
        help="Directory to save trained models"
    )
    parser.add_argument(
        "--target",
        type=str,
        choices=["stunting", "wasting", "underweight", "all"],
        default="all",
        help="Which malnutrition type to train"
    )
    parser.add_argument(
        "--n-estimators",
        type=int,
        default=300,
        help="Number of XGBoost trees"
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=5,
        help="Maximum tree depth"
    )
    parser.add_argument(
        "--learning-rate",
        type=float,
        default=0.05,
        help="XGBoost learning rate"
    )
    parser.add_argument(
        "--cv-folds",
        type=int,
        default=5,
        help="Number of cross-validation folds"
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fraction of data to use for testing"
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed for reproducibility"
    )
    parser.add_argument(
        "--save-report",
        action="store_true",
        help="Save detailed training report to JSON"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed XGBoost training output"
    )
    return parser.parse_args()


def load_and_validate_data(filepath: str) -> pd.DataFrame:
    """Load and validate the training dataset."""
    logger.info(f"Loading data from: {filepath}")

    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Data file not found: {filepath}")

    df = pd.read_csv(filepath)
    logger.info(f"Loaded {len(df)} records with {len(df.columns)} columns")

    
required_columns = [
    "age_months", "sex", "weight_kg", "height_cm", 
    "is_stunted", "is_wasted", "is_underweight"
]
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Data quality checks
    initial_count = len(df)
    df = df.dropna(subset=required_columns)
    df = df[df["age_months"].between(0, 60)]
    df = df[df["weight_kg"].between(0.5, 30)]
    df = df[df["height_cm"].between(30, 130)]
if "muac_cm" in df.columns:
        df = df[df["muac_cm"].between(6, 25)]
    else:
        df["muac_cm"] = 14.0
    df = df[df["sex"].str.lower().isin(["male", "female"])]

    removed = initial_count - len(df)
    if removed > 0:
        logger.warning(f"Removed {removed} records with invalid data")

    logger.info(f"Final training set: {len(df)} records")
    return df


def print_data_summary(df: pd.DataFrame):
    """Print a summary of the training data."""
    print("\n" + "─" * 60)
    print("  DATA SUMMARY")
    print("─" * 60)
    print(f"  Total records   : {len(df):,}")
    print(f"  Age range       : {df['age_months'].min():.0f} - {df['age_months'].max():.0f} months")
    print(f"  Sex             : {df['sex'].value_counts().to_dict()}")
    print(f"  Weight range    : {df['weight_kg'].min():.1f} - {df['weight_kg'].max():.1f} kg")
    print(f"  Height range    : {df['height_cm'].min():.1f} - {df['height_cm'].max():.1f} cm")
    print(f"  MUAC range      : {df['muac_cm'].min():.1f} - {df['muac_cm'].max():.1f} cm")
    print("─" * 60)
    print("  PREVALENCE")
    print("─" * 60)
    for target_name, col in TARGET_COLUMNS.items():
        n_pos = df[col].sum()
        pct = 100 * n_pos / len(df)
        print(f"  {target_name.capitalize():15s} : {n_pos:4d} ({pct:.1f}%)")
    print("─" * 60 + "\n")


def train_single_model(
    df: pd.DataFrame,
    target: str,
    config: ModelConfig,
    cv_folds: int,
    verbose: bool = False
) -> systemModel:
    """Train a single malnutrition model with cross-validation."""

    target_col = TARGET_COLUMNS[target]
    logger.info(f"\n{'═' * 50}")
    logger.info(f"Training model: {target.upper()}")
    logger.info(f"Target column : {target_col}")
    logger.info(f"Positive cases: {int(df[target_col].sum())} / {len(df)}")

    model = systemModel(target=target, config=config)

    start_time = time.time()
    metrics = model.train(df, target_col)
    elapsed = time.time() - start_time

    print(f"\n  Results for {target.upper()}:")
    print(f"  ├── Accuracy  : {metrics.accuracy:.4f} ({metrics.accuracy*100:.1f}%)")
    print(f"  ├── Precision : {metrics.precision:.4f}")
    print(f"  ├── Recall    : {metrics.recall:.4f}")
    print(f"  ├── F1 Score  : {metrics.f1:.4f}")
    print(f"  ├── AUC-ROC   : {metrics.auc_roc:.4f}")
    print(f"  └── Time      : {elapsed:.1f}s")

    # Feature importance top 5
    fi = model.get_feature_importance().head(5)
    print(f"\n  Top features for {target}:")
    for _, row in fi.iterrows():
        bar = "█" * int(row["importance"] * 40)
        print(f"    {row['feature']:30s} {row['importance']:.4f} {bar}")

    return model


def save_training_report(
    models: Dict,
    output_dir: str,
    data_path: str,
    total_records: int
):
    """Save a comprehensive training report to JSON."""
    report = {
        "system_version": "1.0.0",
        "trained_at": pd.Timestamp.now().isoformat(),
        "training_data": data_path,
        "total_records": total_records,
        "models": {}
    }
    for target, model in models.items():
        if model.metrics:
            report["models"][target] = model.metrics.to_dict()

    report_path = os.path.join(output_dir, "training_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    logger.info(f"Training report saved to: {report_path}")
    return report_path


def main():
    print(BANNER)
    args = parse_args()

    # Load data
    df = load_and_validate_data(args.data)
    print_data_summary(df)

    # Model configuration
    config = ModelConfig(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        learning_rate=args.learning_rate,
        random_state=args.random_state,
    )

    print(f"XGBoost Configuration:")
    print(f"  n_estimators  : {config.n_estimators}")
    print(f"  max_depth     : {config.max_depth}")
    print(f"  learning_rate : {config.learning_rate}")
    print(f"  cv_folds      : {args.cv_folds}")

    # Determine which targets to train
    targets_to_train = (
        ["stunting", "wasting", "underweight"]
        if args.target == "all"
        else [args.target]
    )

    # Train models
    trained_models = {}
    total_start = time.time()

    for target in targets_to_train:
        model = train_single_model(
            df, target, config, args.cv_folds, args.verbose
        )
        filepath = model.save(args.output)
        trained_models[target] = model
        print(f"\n  Saved to: {filepath}")

    total_elapsed = time.time() - total_start

    # Summary
    print("\n" + "═" * 60)
    print("  TRAINING COMPLETE")
    print("═" * 60)
    print(f"  Models trained : {len(trained_models)}")
    print(f"  Total time     : {total_elapsed:.1f}s")
    print(f"  Output dir     : {os.path.abspath(args.output)}")
    print("═" * 60)

    if args.save_report:
        save_training_report(trained_models, args.output, args.data, len(df))

    print("\n  Models are ready for prediction. Run:")
    print(f"    python predict_demo_script.py\n")


if __name__ == "__main__":
    main()







































()


# ==============================================================================
# ENHANCED system CLASS - RAG + BioBERT Integration
# ==============================================================================

class Enhancedsystem:
    def __init__(self):
        self.ml_models = self.load_ml_models()
        self.rag_system = systemRAG()
        self.biobert_mobile = BioBERTMobile()

    def load_ml_models(self):
        loaded_models = {}
        for target in ["stunting", "wasting", "underweight"]:
            loaded_models[target] = ModelWrapper(model=None, name=target, features=[])  # Placeholder
        return loaded_models

    def full_prediction_pipeline(self, child_data):
        ml_result = self.ml_models["stunting"].predict(child_data) if self.ml_models.get("stunting") else {}
        evidence = self.rag_system.query(ml_result, child_data)
        entities = None
        if "notes" in child_data:
            entities = self.biobert_mobile.extract_medical_entities(child_data["notes"])
        return {
            "prediction": ml_result,
            "evidence": evidence,
            "entities": entities
        }


