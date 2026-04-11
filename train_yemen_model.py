import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os

# Load data
df = pd.read_csv("yemen_malnutrition_data.csv")

# Ensure no NaNs in features or targets
features = ['age_months', 'weight_kg', 'height_cm']
targets = ['is_stunted', 'is_wasted', 'is_underweight']

# Convert sex to numeric
df['sex_encoded'] = (df['sex'] == 'male').astype(int)
features.append('sex_encoded')

# Drop any remaining NaNs
df = df.dropna(subset=features + targets)

print(f"Training on {len(df)} records")

models = {}
results = {}

for target in targets:
    print(f"\n--- Training for {target} ---")
    X = df[features]
    y = df[target]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = xgb.XGBClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred)

    print(f"Accuracy: {acc:.4f}")
    print("Classification Report:")
    print(report)

    models[target] = model
    results[target] = {"accuracy": acc, "report": report}

    # Save model
    os.makedirs("models", exist_ok=True)
    joblib.dump(model, f"models/{target}_model.joblib")

print("\nAll models trained and saved in 'models/' directory.")
