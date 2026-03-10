import pandas as pd

print("Parsing County Health Rankings 2024...")

select = pd.read_excel("data/chr_indiana_2024.xlsx", sheet_name="Select Measure Data", header=1)
additional = pd.read_excel("data/chr_indiana_2024.xlsx", sheet_name="Additional Measure Data", header=1)

# Select key columns from each sheet
sel_cols = {
    'FIPS': 'fips',
    'County': 'county_name',
    'Average Number of Mentally Unhealthy Days': 'mental_unhealthy_days',
    'Average Number of Physically Unhealthy Days': 'physical_unhealthy_days',
    '% Uninsured': 'pct_uninsured',
    'Primary Care Physicians Rate': 'primary_care_rate',
    'Mental Health Provider Rate': 'mental_health_provider_rate',
    'Mental Health Provider Ratio': 'mental_health_provider_ratio',
    '% Driving Deaths with Alcohol Involvement': 'pct_alcohol_driving_deaths',
    'Injury Death Rate': 'injury_death_rate',
}

add_cols = {
    'FIPS': 'fips',
    'Life Expectancy': 'life_expectancy',
    'Age-Adjusted Death Rate': 'age_adjusted_death_rate',
    '% Frequent Mental Distress': 'pct_frequent_mental_distress',
    '% Frequent Physical Distress': 'pct_frequent_physical_distress',
    'Drug Overdose Mortality Rate': 'drug_overdose_rate',
    'Suicide Rate (Age-Adjusted)': 'suicide_rate',
}

sel = select[list(sel_cols.keys())].rename(columns=sel_cols)
add = additional[list(add_cols.keys())].rename(columns=add_cols)

df = sel.merge(add, on='fips')

# Drop state-level row (FIPS ends in 000)
df = df[df['fips'].astype(str).str[-3:] != '000']

# Clean FIPS to 5-digit string
df['fips'] = df['fips'].astype(int).apply(lambda x: f"{x:05d}")

print(f"Shape: {df.shape}")
print(df[['fips','county_name','drug_overdose_rate','suicide_rate','mental_health_provider_rate','life_expectancy']].head(10))

df.to_csv("data/indiana_health_master.csv", index=False)
print("Saved to data/indiana_health_master.csv")
