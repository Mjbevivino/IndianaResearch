import urllib.request, csv, io, pandas as pd

print("Fetching election data...")

# ── 2000-2016: Harvard Dataverse (MEDSL) ─────────────────────────────────────
url_medsl = "https://dataverse.harvard.edu/api/access/datafile/:persistentId?persistentId=doi:10.7910/DVN/VOQCHQ/HEIJCQ"
req = urllib.request.Request(url_medsl, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=30) as r:
    content = r.read().decode('utf-8', errors='replace')

rows = list(csv.reader(io.StringIO(content), delimiter='\t'))
df_raw = pd.DataFrame(rows[1:], columns=rows[0])
df_in = df_raw[df_raw['state'] == 'Indiana'].copy()
df_in = df_in[df_in['office'] == 'President']
df_in = df_in[df_in['party'].isin(['democrat','republican'])]
df_in['candidatevotes'] = pd.to_numeric(df_in['candidatevotes'], errors='coerce')
df_in['year']  = pd.to_numeric(df_in['year'], errors='coerce')
df_in['FIPS']  = df_in['FIPS'].apply(lambda x: f"{int(float(x)):05d}" if x else None)
print(f"MEDSL Indiana rows (d/r): {len(df_in)}")

pivot = df_in.pivot_table(index=['year','FIPS','county'], columns='party', values='candidatevotes', aggfunc='sum').reset_index()
pivot.columns.name = None
pivot = pivot.rename(columns={'democrat':'dem_votes','republican':'rep_votes','county':'county_name'})
pivot['total_dr'] = pivot['dem_votes'].fillna(0) + pivot['rep_votes'].fillna(0)
pivot['dem_pct']  = (pivot['dem_votes'] / pivot['total_dr'] * 100).round(2)
pivot['rep_pct']  = (pivot['rep_votes'] / pivot['total_dr'] * 100).round(2)
pivot['margin']   = (pivot['rep_pct'] - pivot['dem_pct']).round(2)
pivot['county_name'] = pivot['county_name'].str.title()

def load_tonmcg(year):
    url = f"https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-24/master/{year}_US_County_Level_Presidential_Results.csv"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        df = pd.read_csv(r)
    df = df[df['state_name'] == 'Indiana'].copy()
    df['FIPS'] = df['county_fips'].apply(lambda x: f"{int(x):05d}")
    df['total_dr'] = df['votes_dem'] + df['votes_gop']
    df['dem_pct']  = (df['votes_dem'] / df['total_dr'] * 100).round(2)
    df['rep_pct']  = (df['votes_gop'] / df['total_dr'] * 100).round(2)
    df['margin']   = (df['rep_pct'] - df['dem_pct']).round(2)
    df['county_name'] = df['county_name'].str.replace(' County','',regex=False)
    df['year'] = year
    df = df.rename(columns={'votes_dem':'dem_votes','votes_gop':'rep_votes'})
    return df[['year','FIPS','county_name','dem_votes','rep_votes','total_dr','dem_pct','rep_pct','margin']]

df20 = load_tonmcg(2020)
df24 = load_tonmcg(2024)
print(f"2020 Indiana rows: {len(df20)}")
print(f"2024 Indiana rows: {len(df24)}")

pivot_clean = pivot[['year','FIPS','county_name','dem_votes','rep_votes','total_dr','dem_pct','rep_pct','margin']].copy()
all_years = pd.concat([pivot_clean, df20, df24], ignore_index=True)
all_years = all_years.sort_values(['FIPS','year']).reset_index(drop=True)
all_years['year'] = all_years['year'].astype(int)
all_years.to_csv('data/indiana_election_master.csv', index=False)

print(f"\nSaved: {len(all_years)} rows")
print(f"Years: {sorted(all_years['year'].unique())}")
print(f"Counties: {all_years['FIPS'].nunique()}")
print("\nMarion County trend:")
print(all_years[all_years['FIPS']=='18097'][['year','dem_pct','rep_pct','margin']].to_string())
