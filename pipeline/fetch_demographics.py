import urllib.request, json, pandas as pd

print("Fetching Census ACS 5-Year 2022 — Demographics...")

vars = "B01003_001E,B01002_001E,B03002_003E,B03002_004E,B03002_012E,B03002_006E,B05002_013E,B07001_017E,B07001_033E,B09001_001E,B09020_001E"
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

pop = df['B01003_001E']

df['total_population']  = pop
df['median_age']        = df['B01002_001E']
df['pct_white']         = (df['B03002_003E'] / pop * 100).round(2)
df['pct_black']         = (df['B03002_004E'] / pop * 100).round(2)
df['pct_hispanic']      = (df['B03002_012E'] / pop * 100).round(2)
df['pct_asian']         = (df['B03002_006E'] / pop * 100).round(2)
df['pct_foreign_born']  = (df['B05002_013E'] / pop * 100).round(2)
df['pct_under_18']      = (df['B09001_001E'] / pop * 100).round(2)
df['pct_65_plus']       = (df['B09020_001E'] / pop * 100).round(2)
df['pct_moved_in_county'] = (df['B07001_017E'] / pop * 100).round(2)
df['pct_moved_from_state'] = (df['B07001_033E'] / pop * 100).round(2)

result = df[['fips','county_name','total_population','median_age','pct_white','pct_black',
             'pct_hispanic','pct_asian','pct_foreign_born','pct_under_18','pct_65_plus',
             'pct_moved_in_county','pct_moved_from_state']].copy()

result.to_csv('data/indiana_demographics_master.csv', index=False)
print(f"Saved: {len(result)} counties, {len(result.columns)} columns")

print("\nOldest counties (median age):")
print(result[['county_name','median_age','pct_65_plus','total_population']].sort_values('median_age',ascending=False).head(8).to_string())
print("\nMost diverse counties (% non-white):")
result['pct_nonwhite'] = 100 - result['pct_white']
print(result[['county_name','pct_nonwhite','pct_hispanic','pct_black','pct_asian']].sort_values('pct_nonwhite',ascending=False).head(8).to_string())
