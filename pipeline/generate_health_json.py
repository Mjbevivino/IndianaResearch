import pandas as pd, json, math

df = pd.read_csv("data/indiana_health_master.csv")
df['fips'] = df['fips'].apply(lambda x: f"{int(x):05d}")

def clean(v):
    if v is None: return None
    try:
        if math.isnan(float(v)): return None
        return round(float(v), 2)
    except:
        return v

counties = []
for _, row in df.iterrows():
    counties.append({k: clean(v) if k not in ['fips','county_name'] else str(v) for k, v in row.items()})

with open("frontend/public/data/health_counties.json", "w") as f:
    json.dump(counties, f)
print(f"Written {len(counties)} counties to frontend/public/data/health_counties.json")

indicators = [
    {"id": "drug_overdose_rate", "label": "Drug Overdose Rate", "description": "Drug overdose deaths per 100,000 residents", "unit": "per 100k", "source": "County Health Rankings 2024", "higher_is_worse": True},
    {"id": "suicide_rate", "label": "Suicide Rate", "description": "Age-adjusted suicide deaths per 100,000 residents", "unit": "per 100k", "source": "County Health Rankings 2024", "higher_is_worse": True},
    {"id": "mental_unhealthy_days", "label": "Mentally Unhealthy Days", "description": "Average mentally unhealthy days per month", "unit": "days/month", "source": "County Health Rankings 2024", "higher_is_worse": True},
    {"id": "mental_health_provider_rate", "label": "Mental Health Provider Rate", "description": "Mental health providers per 100,000 residents", "unit": "per 100k", "source": "County Health Rankings 2024", "higher_is_worse": False},
    {"id": "life_expectancy", "label": "Life Expectancy", "description": "Average life expectancy at birth in years", "unit": "years", "source": "County Health Rankings 2024", "higher_is_worse": False},
    {"id": "age_adjusted_death_rate", "label": "Age-Adjusted Death Rate", "description": "Age-adjusted deaths per 100,000 residents", "unit": "per 100k", "source": "County Health Rankings 2024", "higher_is_worse": True},
    {"id": "pct_frequent_mental_distress", "label": "% Frequent Mental Distress", "description": "Percentage reporting frequent mental distress", "unit": "%", "source": "County Health Rankings 2024", "higher_is_worse": True},
    {"id": "pct_uninsured", "label": "% Uninsured", "description": "Percentage of population without health insurance", "unit": "%", "source": "County Health Rankings 2024", "higher_is_worse": True},
    {"id": "injury_death_rate", "label": "Injury Death Rate", "description": "Injury deaths per 100,000 residents", "unit": "per 100k", "source": "County Health Rankings 2024", "higher_is_worse": True},
]

with open("frontend/public/data/health_indicators.json", "w") as f:
    json.dump(indicators, f)
print("Written health_indicators.json")
