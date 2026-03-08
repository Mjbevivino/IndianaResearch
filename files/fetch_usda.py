"""
fetch_usda.py
-------------
Downloads USDA Economic Research Service county-level data for Indiana.

Sources:
  1. Rural-Urban Continuum Codes (RUCC) 2023
     Direct download: https://www.ers.usda.gov/webdocs/DataFiles/53251/ruralurbancodes2023.xlsx
     Docs: https://www.ers.usda.gov/data-products/rural-urban-continuum-codes/

  2. County-Level Farm Income & Wealth Statistics
     Direct download: https://www.ers.usda.gov/webdocs/DataFiles/48747/county_farm_income.csv
     Docs: https://www.ers.usda.gov/data-products/farm-income-and-wealth-statistics/

RUCC codes (1-9):
  1-3  Metro counties (by population size)
  4-6  Nonmetro, adjacent to metro (by urbanization)
  7-9  Nonmetro, not adjacent to metro (by urbanization)
"""

import io
import os
import requests
import pandas as pd

RUCC_URL = "https://www.ers.usda.gov/webdocs/DataFiles/53251/ruralurbancodes2023.xlsx"
FARM_INCOME_URL = "https://www.ers.usda.gov/webdocs/DataFiles/48747/county_farm_income.csv"

RUCC_LABELS = {
    1: "Metro: 1M+ population",
    2: "Metro: 250K–1M",
    3: "Metro: <250K",
    4: "Nonmetro: Urban 20K+, adj to metro",
    5: "Nonmetro: Urban 20K+, not adj",
    6: "Nonmetro: Urban 2.5K–20K, adj",
    7: "Nonmetro: Urban 2.5K–20K, not adj",
    8: "Nonmetro: <2.5K, adj",
    9: "Nonmetro: <2.5K, not adj",
}

HEADERS = {
    "User-Agent": "Indiana Economic Dashboard / research use / contact via GitHub"
}


def fetch_rucc() -> pd.DataFrame:
    print("Fetching USDA RUCC 2023...")
    resp = requests.get(RUCC_URL, headers=HEADERS, timeout=60)
    resp.raise_for_status()

    df = pd.read_excel(io.BytesIO(resp.content), dtype={"FIPS": str})
    df.columns = df.columns.str.strip()

    # Filter to Indiana (state FIPS 18)
    df["FIPS"] = df["FIPS"].str.zfill(5)
    df = df[df["FIPS"].str.startswith("18")].copy()

    df = df.rename(columns={
        "FIPS": "fips",
        "RUCC_2023": "rucc_code",
        "Description": "rucc_description",
    })

    df["rucc_label"] = df["rucc_code"].map(RUCC_LABELS)
    df["is_metro"] = df["rucc_code"].between(1, 3)
    df["is_rural"] = df["rucc_code"] >= 7

    keep = ["fips", "rucc_code", "rucc_label", "is_metro", "is_rural"]
    return df[keep].reset_index(drop=True)


def fetch_farm_income() -> pd.DataFrame:
    """
    Pulls net farm income by county for Indiana, most recent available year.
    USDA ERS updates this annually; current series runs through 2022.
    """
    print("Fetching USDA ERS farm income...")
    resp = requests.get(FARM_INCOME_URL, headers=HEADERS, timeout=60)
    resp.raise_for_status()

    df = pd.read_csv(io.StringIO(resp.text), dtype={"FIPS": str})
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

    df["fips"] = df["fips"].str.zfill(5)
    df = df[df["fips"].str.startswith("18")].copy()

    # Keep most recent year with net farm income
    if "year" in df.columns:
        latest_year = df["year"].max()
        df = df[df["year"] == latest_year].copy()
        print(f"  Using farm income year: {latest_year}")

    # Normalize column names — USDA ERS schema varies by release
    col_map = {}
    for col in df.columns:
        if "net_farm" in col or "net farm" in col:
            col_map[col] = "net_farm_income_1000s"
        elif "cash_receipts" in col or "cash receipts" in col:
            col_map[col] = "farm_cash_receipts_1000s"

    df = df.rename(columns=col_map)

    keep = ["fips"]
    for c in ["net_farm_income_1000s", "farm_cash_receipts_1000s"]:
        if c in df.columns:
            keep.append(c)

    return df[keep].reset_index(drop=True)


def fetch(output_path: str = "data/usda_ers.csv") -> pd.DataFrame:
    rucc = fetch_rucc()
    try:
        farm = fetch_farm_income()
        df = rucc.merge(farm, on="fips", how="left")
    except Exception as e:
        print(f"  Warning: farm income fetch failed ({e}). Continuing with RUCC only.")
        df = rucc

    df["data_source"] = "USDA ERS 2023 RUCC"
    df["data_year"] = 2023

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"  ✓ {len(df)} counties → {output_path}")
    return df


if __name__ == "__main__":
    fetch()
