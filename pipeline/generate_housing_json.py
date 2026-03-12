import pandas as pd, json, math

df = pd.read_csv('data/indiana_housing_master.csv')
df['fips'] = df['fips'].apply(lambda x: f"{int(x):05d}")

def clean(v):
    try:
        if math.isnan(float(v)): return None
        return round(float(v), 2)
    except: return str(v)

counties = []
for _, row in df.iterrows():
    counties.append({k: clean(v) if k not in ['fips','county_name'] else str(v) for k,v in row.items()})

with open('frontend/public/data/housing_counties.json','w') as f:
    json.dump(counties, f)
print(f"Written {len(counties)} counties")

indicators = [
    {"id":"median_home_value",  "label":"Median Home Value",       "unit":"dollars", "higher_is_worse":False},
    {"id":"median_gross_rent",  "label":"Median Gross Rent",        "unit":"dollars", "higher_is_worse":False},
    {"id":"vacancy_rate",       "label":"Vacancy Rate",             "unit":"percent", "higher_is_worse":None},
    {"id":"owner_occ_rate",     "label":"Homeownership Rate",       "unit":"percent", "higher_is_worse":False},
    {"id":"renter_occ_rate",    "label":"Renter Rate",              "unit":"percent", "higher_is_worse":None},
    {"id":"rent_burden_30plus", "label":"Rent Burdened (30%+)",     "unit":"percent", "higher_is_worse":True},
    {"id":"rent_burden_50plus", "label":"Severely Rent Burdened (50%+)", "unit":"percent", "higher_is_worse":True},
]

with open('frontend/public/data/housing_indicators.json','w') as f:
    json.dump(indicators, f)
print("Written housing_indicators.json")
