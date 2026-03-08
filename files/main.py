"""
api/main.py
-----------
FastAPI backend for HoosierDataLab.
Reads from the pipeline-generated CSV and serves county data as JSON.

Run:
    uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="HoosierDataLab API",
    description="Indiana 92-County Economic Indicators",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your domain in production
    allow_methods=["GET"],
    allow_headers=["*"],
)

DATA_PATH = Path(__file__).parent.parent / "data" / "indiana_counties_master.csv"
MANIFEST_PATH = Path(__file__).parent.parent / "data" / "pipeline_manifest.json"


@app.on_event("startup")
def load_data():
    global _df
    if not DATA_PATH.exists():
        raise RuntimeError(
            f"Data file not found at {DATA_PATH}. "
            "Run: python pipeline/build_dataset.py"
        )
    _df = pd.read_csv(DATA_PATH, dtype={"fips": str})
    _df["fips"] = _df["fips"].str.zfill(5)
    # Replace NaN with None for clean JSON serialization
    _df = _df.where(_df.notna(), other=None)
    print(f"Loaded {len(_df)} counties from {DATA_PATH}")


@app.get("/api/counties")
def get_all_counties():
    """All 92 Indiana counties with full indicator set."""
    return _df.to_dict(orient="records")


@app.get("/api/county/{fips}")
def get_county(fips: str):
    """Single county by 5-digit FIPS code."""
    fips = fips.zfill(5)
    row = _df[_df["fips"] == fips]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"County FIPS {fips} not found")
    return row.iloc[0].to_dict()


@app.get("/api/indicators")
def get_indicators():
    """Metadata for all available numeric indicators."""
    return [
        {
            "key": "median_household_income",
            "label": "Median Household Income",
            "unit": "USD",
            "format": "currency",
            "source": "Census ACS 2022",
            "description": "Median household income in the past 12 months (2022 dollars)",
        },
        {
            "key": "poverty_rate",
            "label": "Poverty Rate",
            "unit": "%",
            "format": "percent",
            "source": "Census ACS 2022",
            "description": "Percentage of population with income below the federal poverty level",
        },
        {
            "key": "unemployment_rate",
            "label": "Unemployment Rate",
            "unit": "%",
            "format": "percent",
            "source": "BLS LAUS 2023",
            "description": "Annual average unemployment rate (official BLS Local Area Unemployment Statistics)",
        },
        {
            "key": "lfp_rate",
            "label": "Labor Force Participation",
            "unit": "%",
            "format": "percent",
            "source": "Census ACS 2022",
            "description": "Percentage of civilian population 16+ in the labor force",
        },
        {
            "key": "bachelors_rate",
            "label": "Bachelor's Degree Attainment",
            "unit": "%",
            "format": "percent",
            "source": "Census ACS 2022",
            "description": "Percentage of adults 25+ with a bachelor's degree or higher",
        },
        {
            "key": "median_home_value",
            "label": "Median Home Value",
            "unit": "USD",
            "format": "currency",
            "source": "Census ACS 2022",
            "description": "Median value of owner-occupied housing units",
        },
        {
            "key": "total_population",
            "label": "Total Population",
            "unit": "people",
            "format": "number",
            "source": "Census ACS 2022",
            "description": "Total resident population estimate",
        },
    ]


@app.get("/api/stats/summary")
def get_summary():
    """State-level summary statistics."""
    numeric = _df.select_dtypes(include="number")
    summary = {}
    for col in numeric.columns:
        series = _df[col].dropna()
        if len(series) == 0:
            continue
        summary[col] = {
            "min": float(series.min()),
            "max": float(series.max()),
            "mean": float(series.mean()),
            "median": float(series.median()),
            "stdev": float(series.std()),
        }
    return summary


@app.get("/api/manifest")
def get_manifest():
    """Pipeline build manifest — sources, timestamps, methodology."""
    import json
    if not MANIFEST_PATH.exists():
        return {"error": "Manifest not found. Run pipeline/build_dataset.py"}
    with open(MANIFEST_PATH) as f:
        return json.load(f)


@app.get("/health")
def health():
    return {"status": "ok", "counties_loaded": len(_df)}
