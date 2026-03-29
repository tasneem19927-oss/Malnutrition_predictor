"""
system - Child Malnutrition Prediction System
Demo Prediction Script

Demonstrates the prediction capabilities of trained system models
with sample children data.

Usage:
    python predict_demo_script.py
    python predict_demo_script.py --model-dir models/
    python predict_demo_script.py --child-name "Amara" --age 18 --sex female --weight 8.5 --height 79.0 --muac 13.2

Author: system AI Team
Version: 1.0.0
"""

import os
import sys
import json
import argparse
import logging
from typing import Dict, List, Optional

from xgboost_model import systemPredictor, PredictionResult, classify_risk

logging.basicConfig(level=logging.WARNING)

BANNER = """
╔══════════════════════════════════════════════════════════════╗
║          system - Child Malnutrition Prediction System        ║
║                    Demo Prediction Script                    ║
╚══════════════════════════════════════════════════════════════╝
"""

# Demo children for batch prediction demonstration
DEMO_CHILDREN = [
    {
        "child_name": "Amara Osei",
        "age_months": 18,
        "sex": "female",
        "weight_kg": 8.2,
        "height_cm": 76.5,
        "muac_cm": 12.8,
        "region": "Central"
    },
    {
        "child_name": "Kwame Mensah",
        "age_months": 24,
        "sex": "male",
        "weight_kg": 11.5,
        "height_cm": 86.0,
        "muac_cm": 14.5,
        "region": "Northern"
    },
    {
        "child_name": "Fatima Al-Hassan",
        "age_months": 36,
        "sex": "female",
        "weight_kg": 10.2,
        "height_cm": 88.5,
        "muac_cm": 12.2,
        "region": "Eastern"
    },
    {
        "child_name": "Emmanuel Boateng",
        "age_months": 12,
        "sex": "male",
        "weight_kg": 9.8,
        "height_cm": 75.0,
        "muac_cm": 14.8,
        "region": "Western"
    },
    {
        "child_name": "Zainab Ibrahim",
        "age_months": 48,
        "sex": "female",
        "weight_kg": 14.0,
        "height_cm": 99.0,
        "muac_cm": 15.2,
        "region": "Central"
    },
    {
        "child_name": "Kofi Acheampong",
        "age_months": 6,
        "sex": "male",
        "weight_kg": 6.5,
        "height_cm": 64.0,
        "muac_cm": 13.5,
        "region": "Ashanti"
    },
    {
        "child_name": "Adaeze Okafor",
        "age_months": 30,
        "sex": "female",
        "weight_kg": 9.8,
        "height_cm": 82.0,
        "muac_cm": 11.8,
        "region": "South"
    },
]

RISK_COLORS = {
    "low": "\033[92m",       # Green
    "moderate": "\033[93m",  # Yellow
    "high": "\033[91m",      # Red
    "critical": "\033[95m",  # Magenta
}
RESET = "\033[0m"
BOLD = "\033[1m"


def colorize(text: str, risk: str) -> str:
    """Add ANSI color codes based on risk level."""
    color = RISK_COLORS.get(risk, "")
    return f"{color}{text}{RESET}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="system malnutrition prediction demo",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("--model-dir", default="models", help="Model directory")
    parser.add_argument("--child-name", default=None, help="Child's name")
    parser.add_argument("--age", type=int, default=None, help="Age in months (0-60)")
    parser.add_argument("--sex", choices=["male", "female"], default=None)
    parser.add_argument("--weight", type=float, default=None, help="Weight in kg")
    parser.add_argument("--height", type=float, default=None, help="Height in cm")
    parser.add_argument("--muac", type=float, default=None, help="MUAC in cm")
    parser.add_argument("--output-json", default=None, help="Save results to JSON file")
    parser.add_argument("--demo-batch", action="store_true", help="Run batch demo")
    return parser.parse_args()


def print_risk_bar(probability: float, risk: str, width: int = 30) -> str:
    """Generate a visual risk bar."""
    filled = int(probability * width)
    bar = "█" * filled + "░" * (width - filled)
    color = RISK_COLORS.get(risk, "")
    return f"{color}[{bar}]{RESET} {probability:.1%}"


def print_result(result: PredictionResult, index: Optional[int] = None):
    """Print a formatted prediction result."""
    header = f"PREDICTION {index}" if index else "PREDICTION RESULT"

    print(f"\n  {BOLD}{'─' * 56}{RESET}")
    print(f"  {BOLD}{header}{RESET}")
    print(f"  {'─' * 56}")
    print(f"  Child      : {BOLD}{result.child_name}{RESET}")
    print(f"  Age        : {result.age_months} months ({result.age_months / 12:.1f} years)")
    print(f"  Sex        : {result.sex.title()}")
    print(f"  Weight     : {result.weight_kg:.1f} kg")
    print(f"  Height     : {result.height_cm:.1f} cm")
    print(f"  MUAC       : {result.muac_cm:.1f} cm")
    if result.haz:
        print(f"  HAZ        : {result.haz:.2f}")
    if result.waz:
        print(f"  WAZ        : {result.waz:.2f}")
    print(f"  {'─' * 56}")
    print(f"  MALNUTRITION ASSESSMENT")
    print(f"  {'─' * 56}")
    print(f"  Stunting   : {colorize(result.stunting_risk.upper(), result.stunting_risk):25s} "
          f"  {print_risk_bar(result.stunting_probability, result.stunting_risk)}")
    print(f"  Wasting    : {colorize(result.wasting_risk.upper(), result.wasting_risk):25s} "
          f"  {print_risk_bar(result.wasting_probability, result.wasting_risk)}")
    print(f"  Underweight: {colorize(result.underweight_risk.upper(), result.underweight_risk):25s} "
          f"  {print_risk_bar(result.underweight_probability, result.underweight_risk)}")
    print(f"  {'─' * 56}")
    overall_colored = colorize(f"  OVERALL RISK: {result.overall_risk.upper()}", result.overall_risk)
    print(f"  {BOLD}{overall_colored}{RESET}")


def print_batch_summary(results: List[PredictionResult]):
    """Print a summary table for batch predictions."""
    risk_counts = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
    for r in results:
        risk_counts[r.overall_risk] = risk_counts.get(r.overall_risk, 0) + 1

    print(f"\n  {'═' * 60}")
    print(f"  {BOLD}BATCH PREDICTION SUMMARY{RESET}")
    print(f"  {'═' * 60}")
    print(f"  Total children assessed: {len(results)}")
    print(f"  {'─' * 60}")
    print(f"  {'Risk Level':15s}  {'Count':6s}  {'%':6s}  {'Bar'}")
    print(f"  {'─' * 60}")
    for risk in ["low", "moderate", "high", "critical"]:
        count = risk_counts.get(risk, 0)
        pct = count / len(results) * 100 if results else 0
        bar = "█" * count
        color = RISK_COLORS.get(risk, "")
        print(f"  {colorize(risk.capitalize():15s, risk)}  {count:6d}  {pct:5.1f}%  {color}{bar}{RESET}")
    print(f"  {'═' * 60}")

    # Identify critical cases
    critical = [r for r in results if r.overall_risk in ("critical", "high")]
    if critical:
        print(f"\n  {BOLD}URGENT INTERVENTIONS NEEDED:{RESET}")
        for r in critical:
            print(f"  ⚠  {r.child_name} ({r.age_months}mo) — {r.overall_risk.upper()}")
            if r.stunting_risk in ("critical", "high"):
                print(f"     → Stunting risk: {r.stunting_risk} ({r.stunting_probability:.1%})")
            if r.wasting_risk in ("critical", "high"):
                print(f"     → Wasting risk: {r.wasting_risk} ({r.wasting_probability:.1%})")
            if r.underweight_risk in ("critical", "high"):
                print(f"     → Underweight risk: {r.underweight_risk} ({r.underweight_probability:.1%})")


def run_single_prediction(predictor: systemPredictor, args: argparse.Namespace):
    """Run prediction for a single child from command line args."""
    child_data = {
        "child_name": args.child_name or "Unknown",
        "age_months": args.age,
        "sex": args.sex,
        "weight_kg": args.weight,
        "height_cm": args.height,
        "muac_cm": args.muac,
    }
    result = predictor.predict(child_data)
    print_result(result)
    return result


def run_demo_batch(predictor: systemPredictor) -> List[PredictionResult]:
    """Run predictions on all demo children."""
    print(f"\n  Running batch prediction on {len(DEMO_CHILDREN)} children...")
    results = []
    for i, child in enumerate(DEMO_CHILDREN, 1):
        result = predictor.predict(child)
        print_result(result, i)
        results.append(result)
    return results


def main():
    print(BANNER)
    args = parse_args()

    # Check if models exist
    model_dir = args.model_dir
    required_models = ["stunting", "wasting", "underweight"]
    missing_models = []
    for target in required_models:
        model_path = os.path.join(model_dir, f"system_{target}_model.joblib")
        if not os.path.exists(model_path):
            missing_models.append(target)

    if missing_models:
        print(f"  ERROR: Missing trained models: {missing_models}")
        print(f"  Please run training first:")
        print(f"    python train_models.py --data system_sample_training_data.csv")
        sys.exit(1)

    # Load models
    print(f"  Loading system models from: {model_dir}/")
    predictor = systemPredictor(model_dir=model_dir)
    predictor.load_all()
    print(f"  Models loaded successfully.\n")

    results = []

    # Check if single child prediction
    if all([args.child_name, args.age, args.sex, args.weight, args.height, args.muac]):
        result = run_single_prediction(predictor, args)
        results = [result]
    else:
        # Run demo batch
        results = run_demo_batch(predictor)
        print_batch_summary(results)

    # Save to JSON if requested
    if args.output_json:
        output_data = {
            "predictions": [r.to_dict() for r in results],
            "total": len(results),
            "model_dir": model_dir
        }
        with open(args.output_json, "w") as f:
            json.dump(output_data, f, indent=2)
        print(f"\n  Results saved to: {args.output_json}")

    print(f"\n  system prediction complete.\n")


if __name__ == "__main__":
    main()
