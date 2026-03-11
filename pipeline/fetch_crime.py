import pandas as pd
import json, re

print("Building NIBRS 2024 county crime dataset...")

# ── Load tables ────────────────────────────────────────────────────────────────
incidents = pd.read_csv("data/nibrs_2024/NIBRS_incident.csv",
                        usecols=["incident_id", "agency_id"])

offenses = pd.read_csv("data/nibrs_2024/NIBRS_OFFENSE.csv",
                       usecols=["incident_id", "offense_code"])

month = pd.read_csv("data/nibrs_2024/NIBRS_month.csv",
                    usecols=["agency_id", "ddocname"]).drop_duplicates("agency_id")

# ── Extract county FIPS from ORI in ddocname ──────────────────────────────────
# ddocname format: 2024_01_IN0010000_... → ORI = IN0010000 → county = 001
def ori_to_fips(ddocname):
    if pd.isna(ddocname):
        return None
    m = re.search(r'_IN(\d{3})', str(ddocname))
    if m:
        county_num = int(m.group(1))
        return f"18{county_num * 2 - 1:03d}"  # Indiana FIPS: county 001 = 18001, 002 = 18003...
    return None

# Actually Indiana FIPS are sequential odd numbers: Adams=18001, Allen=18003...
# ORI county code 001 = FIPS 18001, 002 = 18003, etc. → fips = 18000 + (code*2 - 1)
month["fips"] = month["ddocname"].apply(ori_to_fips)
print("Agency-county mapping sample:")
print(month[["agency_id","ddocname","fips"]].dropna().head(10).to_string())
print(f"Agencies with valid FIPS: {month['fips'].notna().sum()} / {len(month)}")

# ── Offense categories ────────────────────────────────────────────────────────
VIOLENT = {"09A","09B","09C","11A","11B","11C","11D","13A","13B","13C","120","100","64A","64B"}
PROPERTY = {"220","240","23A","23B","23C","23D","23E","23F","23G","23H","290","200","250","280"}
DRUG = {"35A","35B"}
WEAPON = {"520","521","522","526"}

def categorize(code):
    if code in VIOLENT:   return "violent"
    if code in PROPERTY:  return "property"
    if code in DRUG:      return "drug"
    if code in WEAPON:    return "weapon"
    return "other"

offenses["category"] = offenses["offense_code"].apply(categorize)

# ── Join incidents → offenses → agency → county ───────────────────────────────
df = incidents.merge(offenses, on="incident_id", how="left")
df = df.merge(month[["agency_id","fips"]], on="agency_id", how="left")
df = df.dropna(subset=["fips"])

print(f"\nTotal offense records with county: {len(df)}")

# ── Aggregate to county ───────────────────────────────────────────────────────
county_counts = df.groupby(["fips","category"]).size().unstack(fill_value=0).reset_index()

# Ensure all columns exist
for col in ["violent","property","drug","weapon","other"]:
    if col not in county_counts.columns:
        county_counts[col] = 0

county_counts["total_crimes"] = county_counts[["violent","property","drug","weapon","other"]].sum(axis=1)

print(f"\nCounties with crime data: {len(county_counts)}")
print(county_counts.sort_values("violent", ascending=False).head(10).to_string())

county_counts.to_csv("data/indiana_crime_master.csv", index=False)
print("\nSaved to data/indiana_crime_master.csv")
