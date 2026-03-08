"""
fetch_census.py
---------------
Pulls ACS 5-Year estimates for all 92 Indiana counties from the Census Bureau API.
Source: U.S. Census Bureau, American Community Survey 5-Year Estimates (2022)
API docs: https://api.census.gov/data/2022/acs/acs5/variables.html

Variables pulled:
  B19013_001E  Median household income (dollars)
  B17001_002E  Population below poverty level
  B17001_001E  Total population for poverty determination
  B23025_002E  Civilian labor force
  B23025_003E  Employed
  B23025_005E  Unemployed
  B23025_001E  Population 16+ (labor force universe)
  B01003_001E  Total population
  B25077_001E  Median home value
  B15003_022E  Bachelor's degree holders (25+)
  B15003_001E  Total population 25+ (education universe)

No API key required for up to 500 req/day. Add key via CENSUS_API_KEY env var
to remove rate limits: https://api.census.gov/data/key_signup.html
"""

import os
import requests
import pandas as pd

ACS_YEAR = 2022
BASE_URL = f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5"

VARIABLES = {
    "B19013_001E": "median_household_income",
    "B17001_002E": "pop_below_poverty",
    "B17001_001E": "pop_poverty_universe",
    "B23025_002E": "civilian_labor_force",
    "B23025_003E": "employed",
    "B23025_005E": "unemployed",
    "B23025_001E": "pop_16plus",
    "B01003_001E": "total_population",
    "B25077_001E": "median_home_value",
    "B15003_022E": "bachelors_degree",
    "B15003_001E": "pop_25plus",
}


def fetch(output_path: str = "data/census_acs.csv") -> pd.DataFrame:
    params = {
        "get": "NAME," + ",".join(VARIABLES.keys()),
        "for": "county:*",
        "in": "state:18",  # Indiana FIPS = 18
    }
    api_key = os.getenv("CENSUS_API_KEY")
    if api_key:
        params["key"] = api_key

    print(f"Fetching Census ACS {ACS_YEAR} 5-Year for Indiana counties...")
    resp = requests.get(BASE_URL, params=params, timeout=30)
    resp.raise_for_status()

    raw = resp.json()
    headers, *rows = raw
    df = pd.DataFrame(rows, columns=headers)

    # Rename census variable codes to readable names
    df = df.rename(columns=VARIABLES)

    # Build FIPS and clean county name
    df["fips"] = df["state"] + df["county"]
    df["county_name"] = df["NAME"].str.replace(r" County, Indiana$", "", regex=True)

    # Cast numeric columns; Census returns -666666666 for missing
    numeric_cols = list(VARIABLES.values())
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        df[col] = df[col].where(df[col] > -666666666)

    # Derived metrics
    df["poverty_rate"] = (df["pop_below_poverty"] / df["pop_poverty_universe"] * 100).round(2)
    df["lfp_rate"] = (df["civilian_labor_force"] / df["pop_16plus"] * 100).round(2)
    df["unemployment_rate_acs"] = (df["unemployed"] / df["civilian_labor_force"] * 100).round(2)
    df["bachelors_rate"] = (df["bachelors_degree"] / df["pop_25plus"] * 100).round(2)

    keep_cols = [
        "fips", "county_name",
        "total_population", "median_household_income", "median_home_value",
        "poverty_rate", "lfp_rate", "unemployment_rate_acs",
        "bachelors_rate", "civilian_labor_force",
    ]
    df = df[keep_cols].sort_values("county_name").reset_index(drop=True)
    df["data_source"] = f"Census ACS {ACS_YEAR} 5-Year"
    df["data_year"] = ACS_YEAR

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"  ✓ {len(df)} counties → {output_path}")
    return df


if __name__ == "__main__":
    fetch()
