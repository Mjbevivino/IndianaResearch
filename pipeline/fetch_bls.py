"""
fetch_bls.py
------------
Pulls BLS Local Area Unemployment Statistics (LAUS) for all 92 Indiana counties.
Source: U.S. Bureau of Labor Statistics, LAUS Program
API docs: https://www.bls.gov/developers/api_faqs.htm
Series format: LAUCNssssssMMYY — county-level monthly unemployment

Fetches annual averages for the most recent available year.
No key required (v1 API). Register for v2 key to increase daily limit to 500 req:
  https://data.bls.gov/registrationEngine/

Series IDs for Indiana counties (FIPS prefix 18):
  LAUCN18{3-digit-county-fips}0000000003  — unemployment rate
  LAUCN18{3-digit-county-fips}0000000004  — unemployment level
  LAUCN18{3-digit-county-fips}0000000005  — employment
  LAUCN18{3-digit-county-fips}0000000006  — labor force
"""

import os
import time
import requests
import pandas as pd

BLS_API_V2 = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
BLS_API_V1 = "https://api.bls.gov/publicAPI/v1/timeseries/data/"

# BLS limits: 50 series per request (v2), 25 (v1)
BATCH_SIZE = 50

# Indiana county FIPS codes (3-digit suffix)
INDIANA_COUNTY_FIPS = [
    "001", "003", "005", "007", "009", "011", "013", "015", "017", "019",
    "021", "023", "025", "027", "029", "031", "033", "035", "037", "039",
    "041", "043", "045", "047", "049", "051", "053", "055", "057", "059",
    "061", "063", "065", "067", "069", "071", "073", "075", "077", "079",
    "081", "083", "085", "087", "089", "091", "093", "095", "097", "099",
    "101", "103", "105", "107", "109", "111", "113", "115", "117", "119",
    "121", "123", "125", "127", "129", "131", "133", "135", "137", "139",
    "141", "143", "145", "147", "149", "151", "153", "155", "157", "159",
    "161", "163", "165", "167", "169", "171", "173", "175", "177", "179",
    "181", "183",
]

MEASURE_CODES = {
    "03": "unemployment_rate",
    "04": "unemployment_level",
    "05": "employment",
    "06": "labor_force",
}

FETCH_YEAR = 2023  # most recent full year with complete LAUS data


def build_series_ids(county_fips: str) -> dict[str, str]:
    """Build BLS series IDs for all 4 measures for one county."""
    return {
        f"LAUCN18{county_fips}0000000{code}": measure
        for code, measure in MEASURE_CODES.items()
    }


def get_annual_average(series_data: list[dict]) -> float | None:
    """Extract the M13 (annual average) observation for the target year."""
    for obs in series_data:
        if obs.get("year") == str(FETCH_YEAR) and obs.get("period") == "M13":
            try:
                return float(obs["value"])
            except (ValueError, KeyError):
                return None
    return None


def fetch_batch(series_ids: list[str], api_key: str | None) -> dict:
    """POST a batch of series IDs to BLS API, return parsed JSON."""
    payload = {
        "seriesid": series_ids,
        "startyear": str(FETCH_YEAR),
        "endyear": str(FETCH_YEAR),
    }
    if api_key:
        payload["registrationkey"] = api_key
        url = BLS_API_V2
    else:
        url = BLS_API_V1

    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch(output_path: str = "data/bls_laus.csv") -> pd.DataFrame:
    api_key = os.getenv("BLS_API_KEY")
    if not api_key:
        print("  Note: No BLS_API_KEY set. Using v1 API (25 series/req, 50 req/day limit).")
        print("  Register free at https://data.bls.gov/registrationEngine/ for higher limits.")
        batch_size = 25
    else:
        batch_size = 50

    # Build all series IDs and county lookup
    all_series: dict[str, tuple[str, str]] = {}  # series_id -> (county_fips, measure)
    for fips in INDIANA_COUNTY_FIPS:
        for series_id, measure in build_series_ids(fips).items():
            all_series[series_id] = (fips, measure)

    series_list = list(all_series.keys())
    results: dict[str, dict[str, float]] = {}  # county_fips -> {measure: value}

    print(f"Fetching BLS LAUS {FETCH_YEAR} annual averages for {len(INDIANA_COUNTY_FIPS)} Indiana counties...")

    for i in range(0, len(series_list), batch_size):
        batch = series_list[i : i + batch_size]
        print(f"  Batch {i // batch_size + 1}/{-(-len(series_list) // batch_size)}...", end=" ")

        data = fetch_batch(batch, api_key)

        if data.get("status") != "REQUEST_SUCCEEDED":
            print(f"WARNING: {data.get('message', 'Unknown error')}")
            continue

        for series in data.get("Results", {}).get("series", []):
            sid = series["seriesID"]
            county_fips, measure = all_series[sid]
            value = get_annual_average(series.get("data", []))
            if county_fips not in results:
                results[county_fips] = {}
            results[county_fips][measure] = value

        print("✓")
        time.sleep(0.5)  # be polite to BLS servers

    rows = []
    for fips, measures in results.items():
        rows.append({
            "fips": f"18{fips}",
            "county_fips_3": fips,
            **measures,
        })

    df = pd.DataFrame(rows)
    df["data_source"] = f"BLS LAUS {FETCH_YEAR} Annual Average"
    df["data_year"] = FETCH_YEAR

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"  ✓ {len(df)} counties → {output_path}")
    return df


if __name__ == "__main__":
    fetch()
