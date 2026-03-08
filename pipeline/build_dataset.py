"""
build_dataset.py
----------------
Orchestrates all fetch scripts and merges into a single county-level master file.
Run this to refresh all data:

    python pipeline/build_dataset.py

Outputs:
    data/indiana_counties_master.csv   — one row per county, all indicators
    data/pipeline_manifest.json        — metadata: sources, fetch timestamps, row counts

Usage from project root:
    python pipeline/build_dataset.py [--force]   # --force re-fetches even if cache exists
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.fetch_census import fetch as fetch_census
from pipeline.fetch_bls import fetch as fetch_bls
from pipeline.fetch_usda import fetch as fetch_usda

import pandas as pd

CACHE_FILES = {
    "census": "data/census_acs.csv",
    "bls": "data/bls_laus.csv",
    "usda": "data/usda_ers.csv",
}
MASTER_FILE = "data/indiana_counties_master.csv"
MANIFEST_FILE = "data/pipeline_manifest.json"


def load_or_fetch(name: str, fetch_fn, cache_path: str, force: bool) -> pd.DataFrame:
    if not force and os.path.exists(cache_path):
        print(f"  [{name}] Using cached file: {cache_path}")
        return pd.read_csv(cache_path, dtype={"fips": str})
    return fetch_fn(output_path=cache_path)


def build(force: bool = False):
    print("=" * 60)
    print("Indiana Economic Dashboard — Pipeline Build")
    print(f"Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 60)

    os.makedirs("data", exist_ok=True)

    # --- Fetch ---
    census = load_or_fetch("Census ACS", fetch_census, CACHE_FILES["census"], force)
    bls    = load_or_fetch("BLS LAUS",   fetch_bls,    CACHE_FILES["bls"],    force)
    usda   = load_or_fetch("USDA ERS",   fetch_usda,   CACHE_FILES["usda"],   force)

    # Ensure consistent FIPS format (5 chars, zero-padded)
    for df in [census, bls, usda]:
        df["fips"] = df["fips"].astype(str).str.zfill(5)

    # --- Merge ---
    print("\nMerging datasets...")
    master = census.merge(
        bls[["fips", "unemployment_rate", "labor_force", "employment", "unemployment_level"]],
        on="fips",
        how="left",
        suffixes=("", "_bls"),
    )
    master = master.merge(
        usda[["fips", "rucc_code", "rucc_label", "is_metro", "is_rural"]],
        on="fips",
        how="left",
    )

    # Prefer BLS unemployment rate (more current, official) over ACS estimate
    master["unemployment_rate"] = master["unemployment_rate"].fillna(master["unemployment_rate_acs"])
    master = master.drop(columns=["unemployment_rate_acs"], errors="ignore")

    # Clean up duplicate source columns
    master = master.drop(columns=["data_source", "data_year"], errors="ignore")
    master["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Sort by county name
    master = master.sort_values("county_name").reset_index(drop=True)

    master.to_csv(MASTER_FILE, index=False)
    print(f"  ✓ Master dataset: {len(master)} counties, {len(master.columns)} columns → {MASTER_FILE}")

    # --- Manifest ---
    manifest = {
        "build_timestamp": datetime.now(timezone.utc).isoformat(),
        "county_count": len(master),
        "columns": list(master.columns),
        "sources": {
            "census_acs": {
                "description": "U.S. Census Bureau, ACS 5-Year Estimates 2022",
                "url": "https://api.census.gov/data/2022/acs/acs5",
                "variables": ["median_household_income", "poverty_rate", "lfp_rate", "bachelors_rate", "total_population"],
            },
            "bls_laus": {
                "description": "BLS Local Area Unemployment Statistics, 2023 Annual Average",
                "url": "https://www.bls.gov/lau/",
                "variables": ["unemployment_rate", "labor_force", "employment"],
            },
            "usda_ers": {
                "description": "USDA ERS Rural-Urban Continuum Codes 2023",
                "url": "https://www.ers.usda.gov/data-products/rural-urban-continuum-codes/",
                "variables": ["rucc_code", "rucc_label", "is_metro", "is_rural"],
            },
        },
        "methodology": (
            "County-level indicators merged on 5-digit FIPS code. "
            "BLS LAUS unemployment rate preferred over ACS estimate where both available. "
            "Census ACS 5-year estimates cover 2018–2022 rolling period. "
            "Missing values encoded as null/NaN; no imputation applied."
        ),
    }
    with open(MANIFEST_FILE, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"  ✓ Manifest → {MANIFEST_FILE}")

    print("\nBuild complete.")
    print(f"  Columns: {', '.join(master.columns.tolist())}")
    return master


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-fetch all data ignoring cache")
    args = parser.parse_args()
    build(force=args.force)
