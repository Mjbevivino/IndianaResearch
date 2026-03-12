import pandas as pd, json, math

df = pd.read_csv('data/indiana_demographics_master.csv')
df['fips'] = df['fips'].apply(lambda x: f"{int(x):05d}")

def clean(v):
    try:
        if math.isnan(float(v)): return None
        return round(float(v), 2)
    except: return str(v)

counties = []
for _, row in df.iterrows():
    counties.append({k: clean(v) if k not in ['fips','county_name'] else str(v) for k,v in row.items()})

with open('frontend/public/data/demographics_counties.json','w') as f:
    json.dump(counties, f)
print(f"Written {len(counties)} counties")

indicators = [
    {"id":"total_population",    "label":"Total Population",         "unit":"people",  "higher_is_worse":False},
    {"id":"median_age",          "label":"Median Age",               "unit":"years",   "higher_is_worse":None},
    {"id":"pct_under_18",        "label":"Population Under 18",      "unit":"percent", "higher_is_worse":None},
    {"id":"pct_65_plus",         "label":"Population 65+",           "unit":"percent", "higher_is_worse":None},
    {"id":"pct_white",           "label":"White (Non-Hispanic)",     "unit":"percent", "higher_is_worse":None},
    {"id":"pct_black",           "label":"Black or African American","unit":"percent", "higher_is_worse":None},
    {"id":"pct_hispanic",        "label":"Hispanic or Latino",       "unit":"percent", "higher_is_worse":None},
    {"id":"pct_asian",           "label":"Asian",                    "unit":"percent", "higher_is_worse":None},
    {"id":"pct_foreign_born",    "label":"Foreign Born",             "unit":"percent", "higher_is_worse":None},
    {"id":"pct_moved_in_county", "label":"Moved Within County",      "unit":"percent", "higher_is_worse":None},
    {"id":"pct_moved_from_state","label":"Moved From Another State", "unit":"percent", "higher_is_worse":None},
]

with open('frontend/public/data/demographics_indicators.json','w') as f:
    json.dump(indicators, f)
print("Written demographics_indicators.json")
