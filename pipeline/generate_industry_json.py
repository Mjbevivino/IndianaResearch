import pandas as pd, json, math

df = pd.read_csv('data/indiana_industry_master.csv')
df['fips'] = df['fips'].apply(lambda x: f"{int(x):05d}")

SECTOR_LABELS = {
    '11':'Agriculture & Forestry','21':'Mining & Oil/Gas','22':'Utilities',
    '23':'Construction','31_33':'Manufacturing','42':'Wholesale Trade',
    '44_45':'Retail Trade','48_49':'Transportation & Warehousing',
    '51':'Information','52':'Finance & Insurance','53':'Real Estate',
    '54':'Professional & Technical Services','55':'Management',
    '56':'Administrative Services','61':'Educational Services',
    '62':'Health Care & Social Assistance','71':'Arts & Entertainment',
    '72':'Accommodation & Food Services','81':'Other Services',
}

def clean(v):
    try:
        if math.isnan(float(v)): return None
        return round(float(v), 2)
    except: return str(v)

counties = []
for _, row in df.iterrows():
    counties.append({k: clean(v) if k not in ['fips','county_name'] else str(v) for k,v in row.items()})

with open('frontend/public/data/industry_counties.json','w') as f:
    json.dump(counties, f)
print(f"Written {len(counties)} counties")

indicators = [
    {"id":"avg_annual_wage",   "label":"Avg Annual Wage",              "unit":"dollars",  "higher_is_worse":False},
    {"id":"total_emp",         "label":"Total Employment",             "unit":"workers",  "higher_is_worse":False},
    {"id":"share_31_33",       "label":"Manufacturing Share",          "unit":"percent",  "higher_is_worse":False},
    {"id":"share_62",          "label":"Health Care Share",            "unit":"percent",  "higher_is_worse":False},
    {"id":"share_44_45",       "label":"Retail Trade Share",           "unit":"percent",  "higher_is_worse":False},
    {"id":"share_72",          "label":"Food & Accommodation Share",   "unit":"percent",  "higher_is_worse":False},
    {"id":"share_48_49",       "label":"Transportation Share",         "unit":"percent",  "higher_is_worse":False},
    {"id":"share_23",          "label":"Construction Share",           "unit":"percent",  "higher_is_worse":False},
    {"id":"share_54",          "label":"Professional Services Share",  "unit":"percent",  "higher_is_worse":False},
    {"id":"share_61",          "label":"Educational Services Share",   "unit":"percent",  "higher_is_worse":False},
    {"id":"share_11",          "label":"Agriculture Share",            "unit":"percent",  "higher_is_worse":False},
    {"id":"share_52",          "label":"Finance & Insurance Share",    "unit":"percent",  "higher_is_worse":False},
]

with open('frontend/public/data/industry_indicators.json','w') as f:
    json.dump(indicators, f)
print("Written industry_indicators.json")

print("\nTop 5 by avg wage:")
print(df[['county_name','avg_annual_wage','share_31_33','share_62']].sort_values('avg_annual_wage',ascending=False).head(5).to_string())
