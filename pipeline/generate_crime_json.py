import pandas as pd, json, math

crime = pd.read_csv("data/indiana_crime_master.csv")
crime["fips"] = crime["fips"].apply(lambda x: f"{int(x):05d}")

# Pull population from master CSV
econ = pd.read_csv("data/indiana_counties_master.csv")
econ["fips"] = econ["fips"].apply(lambda x: f"{int(x):05d}")
pop = econ[["fips", "county_name", "total_population"]]

df = crime.merge(pop, on="fips", how="left")

# Per-100k rates
for col in ["violent","property","drug","weapon","total_crimes"]:
    df[f"{col}_rate"] = (df[col] / df["total_population"] * 100000).round(1)

def clean(v):
    try:
        if math.isnan(float(v)): return None
        return round(float(v), 1)
    except:
        return v

counties = []
for _, row in df.iterrows():
    counties.append({k: clean(v) if k not in ["fips","county_name"] else str(v) for k, v in row.items()})

with open("frontend/public/data/crime_counties.json", "w") as f:
    json.dump(counties, f)
print(f"Written {len(counties)} counties to crime_counties.json")

indicators = [
    {"id":"violent_rate",    "label":"Violent Crime Rate",   "description":"Violent crimes per 100,000 residents (murder, assault, rape, robbery)",    "unit":"per 100k","higher_is_worse":True},
    {"id":"property_rate",   "label":"Property Crime Rate",  "description":"Property crimes per 100,000 residents (burglary, theft, arson)",            "unit":"per 100k","higher_is_worse":True},
    {"id":"drug_rate",       "label":"Drug Offense Rate",    "description":"Drug violations per 100,000 residents",                                     "unit":"per 100k","higher_is_worse":True},
    {"id":"weapon_rate",     "label":"Weapon Violation Rate","description":"Weapon law violations per 100,000 residents",                               "unit":"per 100k","higher_is_worse":True},
    {"id":"total_crimes_rate","label":"Total Crime Rate",    "description":"All reported offenses per 100,000 residents",                               "unit":"per 100k","higher_is_worse":True},
    {"id":"violent",         "label":"Violent Crimes (count)","description":"Raw count of violent crimes reported in 2024",                            "unit":"count",  "higher_is_worse":True},
    {"id":"property",        "label":"Property Crimes (count)","description":"Raw count of property crimes reported in 2024",                          "unit":"count",  "higher_is_worse":True},
]

with open("frontend/public/data/crime_indicators.json", "w") as f:
    json.dump(indicators, f)
print("Written crime_indicators.json")
print("\nTop 10 by violent crime rate:")
print(df[["county_name","violent_rate","violent","total_population"]].sort_values("violent_rate", ascending=False).head(10).to_string())
