import urllib.request, json, pandas as pd

print("Fetching Census ACS 5-Year 2022 — Housing...")

vars = "B25002_001E,B25002_003E,B25003_001E,B25003_002E,B25003_003E,B25064_001E,B25077_001E,B25070_007E,B25070_008E,B25070_009E,B25070_010E"
url = f"https://api.census.gov/data/2022/acs/acs5?get=NAME,{vars}&for=county:*&in=state:18"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=20) as r:
    data = json.load(r)

cols = data[0]
df = pd.DataFrame(data[1:], columns=cols)
df['fips'] = '18' + df['county'].str.zfill(3)
df['county_name'] = df['NAME'].str.replace(' County, Indiana', '', regex=False)

num_cols = [c for c in cols if c not in ['NAME','state','county']]
for c in num_cols:
    df[c] = pd.to_numeric(df[c], errors='coerce')

# Computed metrics
df['vacancy_rate']       = (df['B25002_003E'] / df['B25002_001E'] * 100).round(2)
df['owner_occ_rate']     = (df['B25003_002E'] / df['B25003_001E'] * 100).round(2)
df['renter_occ_rate']    = (df['B25003_003E'] / df['B25003_001E'] * 100).round(2)
df['median_gross_rent']  = df['B25064_001E']
df['median_home_value']  = df['B25077_001E']
# Rent burden = 30%+ of income (severe = 50%+)
df['rent_burden_30plus'] = ((df['B25070_007E'] + df['B25070_008E'] + df['B25070_009E'] + df['B25070_010E']) / df['B25003_003E'] * 100).round(2)
df['rent_burden_50plus'] = (df['B25070_010E'] / df['B25003_003E'] * 100).round(2)

result = df[['fips','county_name','vacancy_rate','owner_occ_rate','renter_occ_rate',
             'median_gross_rent','median_home_value','rent_burden_30plus','rent_burden_50plus']].copy()

result.to_csv('data/indiana_housing_master.csv', index=False)
print(f"Saved: {len(result)} counties, {len(result.columns)} columns")

print("\nTop 10 highest vacancy rates:")
print(result[['county_name','vacancy_rate','median_home_value','median_gross_rent']].sort_values('vacancy_rate',ascending=False).head(10).to_string())
print("\nTop 10 rent burden (50%+):")
print(result[['county_name','rent_burden_50plus','median_gross_rent','renter_occ_rate']].sort_values('rent_burden_50plus',ascending=False).head(10).to_string())
