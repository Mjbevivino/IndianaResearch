import urllib.request, json, time, pandas as pd

print("Fetching Census County Business Patterns 2022...")

sectors = ['11','21','22','23','31-33','42','44-45','48-49',
           '51','52','53','54','55','56','61','62','71','72','81']

SECTOR_NAMES = {
    '11':'Agriculture & Forestry','21':'Mining & Oil/Gas','22':'Utilities',
    '23':'Construction','31-33':'Manufacturing','42':'Wholesale Trade',
    '44-45':'Retail Trade','48-49':'Transportation & Warehousing',
    '51':'Information','52':'Finance & Insurance','53':'Real Estate',
    '54':'Professional & Technical Services','55':'Management',
    '56':'Administrative & Waste Services','61':'Educational Services',
    '62':'Health Care & Social Assistance','71':'Arts & Entertainment',
    '72':'Accommodation & Food Services','81':'Other Services',
}

all_rows = []
headers = None

for naics in sectors:
    url = f"https://api.census.gov/data/2022/cbp?get=GEO_ID,NAME,NAICS2017,NAICS2017_LABEL,ESTAB,EMP,PAYANN&for=county:*&in=state:18&NAICS2017={naics}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.load(r)
        if headers is None:
            headers = data[0]
        all_rows.extend(data[1:])
        print(f"  {naics}: {len(data)-1} counties")
    except Exception as e:
        print(f"  {naics}: FAILED — {e}")
    time.sleep(0.3)

# Also fetch totals
url_total = "https://api.census.gov/data/2022/cbp?get=GEO_ID,NAME,NAICS2017,NAICS2017_LABEL,ESTAB,EMP,PAYANN&for=county:*&in=state:18&NAICS2017=00"
req = urllib.request.Request(url_total, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=20) as r:
    total_data = json.load(r)
total_rows = total_data[1:]
print(f"  00 (total): {len(total_rows)} counties")

# Build DataFrames
df = pd.DataFrame(all_rows, columns=headers)
df_total = pd.DataFrame(total_rows, columns=total_data[0])

for d in [df, df_total]:
    d['fips'] = '18' + d['county'].str.zfill(3)
    d['EMP']    = pd.to_numeric(d['EMP'],    errors='coerce')
    d['ESTAB']  = pd.to_numeric(d['ESTAB'],  errors='coerce')
    d['PAYANN'] = pd.to_numeric(d['PAYANN'], errors='coerce')

# Pivot: one row per county, columns per sector
df2 = df.rename(columns={"NAICS2017": "naics_key"}).drop(columns=["NAICS2017"], errors="ignore") if df.columns.tolist().count("NAICS2017") > 1 else df.rename(columns={"NAICS2017":"naics_key"})
pivot_emp   = df2.pivot_table(index="fips", columns="naics_key", values="EMP",   aggfunc="sum")
pivot_estab = df.pivot_table(index='fips', columns='NAICS2017', values='ESTAB', aggfunc='sum')

pivot_emp.columns   = [f'emp_{c.replace("-","_")}' for c in pivot_emp.columns]
pivot_estab.columns = [f'estab_{c.replace("-","_")}' for c in pivot_estab.columns]

total = df_total[['fips','NAME','EMP','ESTAB','PAYANN']].copy()
total.columns = ['fips','county_name','total_emp','total_estab','total_payann']
total['county_name'] = total['county_name'].str.replace(' County, Indiana','',regex=False)

result = total.merge(pivot_emp,   on='fips', how='left')
result = result.merge(pivot_estab, on='fips', how='left')

# Compute employment share per sector
emp_cols = [c for c in result.columns if c.startswith('emp_')]
for col in emp_cols:
    naics = col.replace('emp_','').replace('_','-')
    result[f'share_{col[4:]}'] = (result[col] / result['total_emp'] * 100).round(2)

# Avg annual wage
result['avg_annual_wage'] = (result['total_payann'] * 1000 / result['total_emp']).round(0)

result.to_csv('data/indiana_industry_master.csv', index=False)
print(f"\nSaved: {len(result)} counties, {len(result.columns)} columns")

print("\nTop manufacturing counties (employment share):")
print(result[['county_name','share_31_33','emp_31_33','avg_annual_wage']].dropna(subset=['share_31_33']).sort_values('share_31_33',ascending=False).head(10).to_string())
