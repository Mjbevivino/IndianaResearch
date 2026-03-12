import pandas as pd, json, math

df = pd.read_csv('data/indiana_education_master.csv')
df['fips'] = df['fips'].apply(lambda x: f"{int(x):05d}")

def clean(v):
    try:
        if math.isnan(float(v)): return None
        return round(float(v), 4)
    except: return str(v)

counties = []
for _, row in df.iterrows():
    counties.append({k: clean(v) if k not in ['fips','county_name'] else str(v) for k,v in row.items()})

with open('frontend/public/data/education_counties.json','w') as f:
    json.dump(counties, f)
print(f"Written {len(counties)} counties to education_counties.json")

indicators = [
    {"id":"ela_proficient_pct",      "label":"ELA Proficiency",         "description":"% students proficient in English Language Arts (grades 3-8), ILEARN 2025", "unit":"percent","higher_is_worse":False},
    {"id":"math_proficient_pct",     "label":"Math Proficiency",        "description":"% students proficient in Math (grades 3-8), ILEARN 2025",                  "unit":"percent","higher_is_worse":False},
    {"id":"ela_math_proficient_pct", "label":"ELA & Math Proficiency",  "description":"% students proficient in both ELA and Math (grades 3-8), ILEARN 2025",     "unit":"percent","higher_is_worse":False},
    {"id":"science_proficient_pct",  "label":"Science Proficiency",     "description":"% students proficient in Science, ILEARN 2025",                            "unit":"percent","higher_is_worse":False},
    {"id":"grad_rate",               "label":"Graduation Rate",         "description":"4-year adjusted cohort graduation rate, class of 2025",                    "unit":"percent","higher_is_worse":False},
    {"id":"chronic_absent_rate",     "label":"Chronic Absenteeism",     "description":"% students chronically absent (missing 10%+ of school days), SY 2024-25",  "unit":"percent","higher_is_worse":True},
]

with open('frontend/public/data/education_indicators.json','w') as f:
    json.dump(indicators, f)
print("Written education_indicators.json")

print("\nBottom 10 counties by ELA & Math proficiency:")
print(df[['county_name','ela_math_proficient_pct','grad_rate','chronic_absent_rate']].dropna().sort_values('ela_math_proficient_pct').head(10).to_string())
