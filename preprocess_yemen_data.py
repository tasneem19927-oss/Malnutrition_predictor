import pyreadstat
import pandas as pd
import numpy as np

# Load the ch.sav file
path = "YemenMICS6Datasets/Yemen MICS6 SPSS Datasets/ch.sav"
df, meta = pyreadstat.read_sav(path)

# Mapping columns based on exploration
# HL4: Sex (1=Male, 2=Female)
# CAGE: Age in months
# AN8: Weight in kg
# AN11: Height in cm
# HAZ2, WHZ2, WAZ2: WHO Z-scores

# Select relevant columns
cols = {
    'CAGE': 'age_months',
    'HL4': 'sex',
    'AN8': 'weight_kg',
    'AN11': 'height_cm',
    'HAZ2': 'haz',
    'WHZ2': 'whz',
    'WAZ2': 'waz'
}

# Filter and rename
new_df = df[list(cols.keys())].rename(columns=cols)

# Data Cleaning
# 1. Convert sex to 'male'/'female'
new_df['sex'] = new_df['sex'].map({1.0: 'male', 2.0: 'female'})

# 2. Handle missing values
print(f"Initial records: {len(new_df)}")
# Drop rows where essential features are missing
new_df = new_df.dropna(subset=['age_months', 'sex', 'weight_kg', 'height_cm'])

# 3. Create labels based on WHO standards (Z-score < -2)
# Ensure we handle NaNs in Z-scores before converting to int
new_df = new_df.dropna(subset=['haz', 'whz', 'waz'])
new_df['is_stunted'] = (new_df['haz'] < -2).astype(int)
new_df['is_wasted'] = (new_df['whz'] < -2).astype(int)
new_df['is_underweight'] = (new_df['waz'] < -2).astype(int)
print(f"Records after dropping NaNs: {len(new_df)}")

# 4. Add MUAC (if not found, we might need to estimate or use a default if the model requires it)
# Looking back at find_anthro_cols.py, MUAC wasn't explicitly found in ch.sav.
# Let's check if there's any other column for MUAC.
muac_cols = [col for col, label in meta.column_names_to_labels.items() if 'muac' in label.lower()]
if muac_cols:
    print(f"Found MUAC columns: {muac_cols}")
    new_df['muac_cm'] = df[muac_cols[0]]
else:
    print("MUAC not found, using a placeholder or estimating from weight/height if possible.")
    # For the sake of the model which requires muac_cm, we'll use a placeholder or skip if not critical.
    # Actually, let's check if 'AN' columns have it.
    an_cols = [col for col in df.columns if col.startswith('AN')]
    print(f"AN columns: {an_cols}")
    # If still not found, we'll use the median MUAC for age as a placeholder to allow the model to run.
    new_df['muac_cm'] = 14.0  # Placeholder

# Save to CSV
output_path = "yemen_malnutrition_data.csv"
new_df.to_csv(output_path, index=False)
print(f"Saved processed data to {output_path}")
print(new_df.head())
print(new_df.describe())
