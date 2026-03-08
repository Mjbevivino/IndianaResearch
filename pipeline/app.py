"""
app.py
------
Indiana 92-County Economic Dashboard
Run: streamlit run app.py
"""

import json
import os
from pathlib import Path

import pandas as pd
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go

# ── Page config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Indiana Economic Dashboard",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Constants ──────────────────────────────────────────────────────────────────
DATA_PATH = Path("data/indiana_counties_master.csv")
MANIFEST_PATH = Path("data/pipeline_manifest.json")

INDICATORS = {
    "median_household_income":  {"label": "Median Household Income",       "fmt": "${:,.0f}",   "color": "Blues",    "unit": "USD"},
    "poverty_rate":             {"label": "Poverty Rate",                   "fmt": "{:.1f}%",    "color": "Reds",     "unit": "%"},
    "unemployment_rate":        {"label": "Unemployment Rate (BLS LAUS)",   "fmt": "{:.1f}%",    "color": "Oranges",  "unit": "%"},
    "lfp_rate":                 {"label": "Labor Force Participation Rate",  "fmt": "{:.1f}%",    "color": "Greens",   "unit": "%"},
    "bachelors_rate":           {"label": "Bachelor's Degree Attainment",   "fmt": "{:.1f}%",    "color": "Purples",  "unit": "%"},
    "median_home_value":        {"label": "Median Home Value",              "fmt": "${:,.0f}",   "color": "YlOrBr",   "unit": "USD"},
    "total_population":         {"label": "Total Population",               "fmt": "{:,.0f}",    "color": "Greys",    "unit": "people"},
}

RUCC_LABELS = {
    1: "Metro 1M+", 2: "Metro 250K–1M", 3: "Metro <250K",
    4: "Nonmetro adj", 5: "Nonmetro urban", 6: "Nonmetro small adj",
    7: "Nonmetro small", 8: "Rural adj", 9: "Rural",
}

# ── Custom CSS ─────────────────────────────────────────────────────────────────
st.markdown("""
<style>
  [data-testid="stSidebar"] { background: #0f1923; }
  [data-testid="stSidebar"] * { color: #e0e6ed !important; }
  .metric-card {
    background: #1a2535; border: 1px solid #2d3d50; border-radius: 8px;
    padding: 16px; margin: 4px 0;
  }
  .metric-value { font-size: 1.8rem; font-weight: 700; color: #4fc3f7; }
  .metric-label { font-size: 0.75rem; color: #8899aa; text-transform: uppercase; letter-spacing: .05em; }
  .source-badge {
    display: inline-block; background: #1e3a5f; border: 1px solid #2d6aad;
    border-radius: 4px; padding: 2px 8px; font-size: 0.7rem; color: #7ec8e3;
    margin: 2px;
  }
  h1 { color: #e8f4fd !important; }
  .stTabs [data-baseweb="tab"] { color: #8899aa; }
  .stTabs [aria-selected="true"] { color: #4fc3f7 !important; }
</style>
""", unsafe_allow_html=True)


# ── Data loading ───────────────────────────────────────────────────────────────
@st.cache_data(ttl=3600)
def load_data() -> pd.DataFrame:
    if not DATA_PATH.exists():
        return None
    df = pd.read_csv(DATA_PATH, dtype={"fips": str})
    df["fips"] = df["fips"].str.zfill(5)
    return df


@st.cache_data
def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {}
    with open(MANIFEST_PATH) as f:
        return json.load(f)


@st.cache_data
def load_geojson() -> dict:
    """Indiana county boundaries from public Census TIGER GeoJSON."""
    import urllib.request
    url = (
        "https://raw.githubusercontent.com/plotly/datasets/master/"
        "geojson-counties-fips.json"
    )
    with urllib.request.urlopen(url) as r:
        full = json.loads(r.read())
    # Filter to Indiana (FIPS starts with 18)
    full["features"] = [f for f in full["features"] if f["id"].startswith("18")]
    return full


# ── Sidebar ────────────────────────────────────────────────────────────────────
def sidebar(df: pd.DataFrame):
    st.sidebar.markdown("## 🏭 Indiana Economic\nDashboard")
    st.sidebar.markdown("---")

    indicator = st.sidebar.selectbox(
        "Map Indicator",
        options=list(INDICATORS.keys()),
        format_func=lambda k: INDICATORS[k]["label"],
    )

    st.sidebar.markdown("### Filter Counties")
    rucc_options = sorted(df["rucc_code"].dropna().unique().astype(int).tolist())
    rucc_filter = st.sidebar.multiselect(
        "Rural-Urban Class (RUCC)",
        options=rucc_options,
        default=rucc_options,
        format_func=lambda x: f"{x} — {RUCC_LABELS.get(x, '')}",
    )

    pop_min = int(df["total_population"].min())
    pop_max = int(df["total_population"].max())
    pop_range = st.sidebar.slider(
        "Population Range",
        min_value=pop_min, max_value=pop_max,
        value=(pop_min, pop_max),
        format="%d",
    )

    county_select = st.sidebar.selectbox(
        "Spotlight County",
        options=["(All counties)"] + sorted(df["county_name"].tolist()),
    )

    st.sidebar.markdown("---")
    st.sidebar.markdown("**Data Sources**")
    for badge in ["Census ACS 2022", "BLS LAUS 2023", "USDA ERS 2023"]:
        st.sidebar.markdown(f'<span class="source-badge">{badge}</span>', unsafe_allow_html=True)

    return indicator, rucc_filter, pop_range, county_select


# ── Choropleth map ─────────────────────────────────────────────────────────────
def render_map(df: pd.DataFrame, geojson: dict, indicator: str):
    meta = INDICATORS[indicator]

    fig = px.choropleth(
        df,
        geojson=geojson,
        locations="fips",
        color=indicator,
        color_continuous_scale=meta["color"],
        hover_name="county_name",
        hover_data={
            "fips": False,
            indicator: True,
            "total_population": True,
            "rucc_label": True,
        },
        labels={
            indicator: meta["label"],
            "total_population": "Population",
            "rucc_label": "Rural-Urban Class",
        },
    )
    fig.update_geos(
        fitbounds="locations",
        visible=False,
    )
    fig.update_layout(
        margin={"r": 0, "t": 0, "l": 0, "b": 0},
        paper_bgcolor="#0f1923",
        plot_bgcolor="#0f1923",
        coloraxis_colorbar=dict(
            title=meta["unit"],
            tickfont=dict(color="#8899aa"),
            titlefont=dict(color="#8899aa"),
        ),
        geo=dict(bgcolor="#0f1923"),
    )
    return fig


# ── Summary metric cards ───────────────────────────────────────────────────────
def metric_card(label: str, value, fmt: str):
    try:
        display = fmt.format(value) if pd.notna(value) else "N/A"
    except Exception:
        display = str(value)
    st.markdown(
        f'<div class="metric-card"><div class="metric-label">{label}</div>'
        f'<div class="metric-value">{display}</div></div>',
        unsafe_allow_html=True,
    )


def render_state_summary(df: pd.DataFrame):
    cols = st.columns(4)
    with cols[0]:
        metric_card("Median Income (state avg)", df["median_household_income"].median(), "${:,.0f}")
    with cols[1]:
        metric_card("Avg Unemployment Rate", df["unemployment_rate"].mean(), "{:.1f}%")
    with cols[2]:
        metric_card("Avg Poverty Rate", df["poverty_rate"].mean(), "{:.1f}%")
    with cols[3]:
        metric_card("Total Population", df["total_population"].sum(), "{:,.0f}")


# ── County spotlight ───────────────────────────────────────────────────────────
def render_county_spotlight(df: pd.DataFrame, county_name: str):
    row = df[df["county_name"] == county_name].iloc[0]
    st.markdown(f"### 📍 {county_name} County")

    cols = st.columns(4)
    metrics = [
        ("Median Income",     row.get("median_household_income"), "${:,.0f}"),
        ("Unemployment Rate", row.get("unemployment_rate"),       "{:.1f}%"),
        ("Poverty Rate",      row.get("poverty_rate"),            "{:.1f}%"),
        ("LF Participation",  row.get("lfp_rate"),                "{:.1f}%"),
        ("Median Home Value", row.get("median_home_value"),       "${:,.0f}"),
        ("Population",        row.get("total_population"),        "{:,.0f}"),
        ("Bachelor's Rate",   row.get("bachelors_rate"),          "{:.1f}%"),
        ("Rural-Urban Class", row.get("rucc_label"),              "{}"),
    ]
    for i, (label, val, fmt) in enumerate(metrics):
        with cols[i % 4]:
            metric_card(label, val, fmt)


# ── Distribution charts ────────────────────────────────────────────────────────
def render_distribution(df: pd.DataFrame, indicator: str):
    meta = INDICATORS[indicator]

    fig = px.histogram(
        df,
        x=indicator,
        nbins=20,
        color="is_metro",
        color_discrete_map={True: "#4fc3f7", False: "#f48fb1"},
        labels={indicator: meta["label"], "is_metro": "Metro County"},
        template="plotly_dark",
        barmode="overlay",
        opacity=0.75,
    )
    fig.update_layout(
        paper_bgcolor="#1a2535",
        plot_bgcolor="#1a2535",
        font_color="#8899aa",
        title=f"Distribution: {meta['label']} (Metro vs Non-Metro)",
        legend=dict(title="Metro?", bgcolor="#1a2535"),
    )
    return fig


def render_scatter(df: pd.DataFrame):
    fig = px.scatter(
        df,
        x="median_household_income",
        y="unemployment_rate",
        size="total_population",
        color="rucc_code",
        hover_name="county_name",
        color_continuous_scale="Viridis",
        labels={
            "median_household_income": "Median Household Income ($)",
            "unemployment_rate": "Unemployment Rate (%)",
            "rucc_code": "RUCC",
        },
        template="plotly_dark",
    )
    fig.update_layout(
        paper_bgcolor="#1a2535",
        plot_bgcolor="#1a2535",
        font_color="#8899aa",
        title="Income vs Unemployment (bubble size = population)",
    )
    return fig


# ── Rankings table ─────────────────────────────────────────────────────────────
def render_rankings(df: pd.DataFrame, indicator: str):
    meta = INDICATORS[indicator]
    ranked = df[["county_name", indicator, "total_population", "rucc_label"]].copy()
    ranked = ranked.sort_values(indicator, ascending=False).reset_index(drop=True)
    ranked.index = ranked.index + 1

    try:
        ranked[indicator] = ranked[indicator].map(lambda v: meta["fmt"].format(v) if pd.notna(v) else "N/A")
    except Exception:
        pass

    ranked.columns = ["County", meta["label"], "Population", "Rural-Urban Class"]
    st.dataframe(ranked, use_container_width=True, height=400)

    csv = df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="⬇ Download Full Dataset (CSV)",
        data=csv,
        file_name="indiana_counties_economic_data.csv",
        mime="text/csv",
    )


# ── Data dictionary ────────────────────────────────────────────────────────────
def render_data_dict(manifest: dict):
    st.markdown("### Data Dictionary")
    dict_rows = [
        ("fips",                    "string", "5-digit FIPS county code",             "FIPS Standard"),
        ("county_name",             "string", "County name (without 'County')",       "Census"),
        ("total_population",        "int",    "Total resident population",            "ACS B01003"),
        ("median_household_income", "int",    "Median household income (dollars)",    "ACS B19013"),
        ("median_home_value",       "int",    "Median owner-occupied home value",     "ACS B25077"),
        ("poverty_rate",            "float",  "% population below poverty line",      "ACS B17001"),
        ("lfp_rate",                "float",  "% pop 16+ in civilian labor force",    "ACS B23025"),
        ("bachelors_rate",          "float",  "% adults 25+ with bachelor's degree",  "ACS B15003"),
        ("unemployment_rate",       "float",  "Annual avg unemployment rate (BLS)",   "BLS LAUS M13"),
        ("labor_force",             "int",    "Civilian labor force count",           "BLS LAUS M13"),
        ("employment",              "int",    "Employed persons count",               "BLS LAUS M13"),
        ("rucc_code",               "int",    "USDA Rural-Urban Continuum Code (1–9)","USDA ERS 2023"),
        ("rucc_label",              "string", "RUCC descriptive label",               "USDA ERS 2023"),
        ("is_metro",                "bool",   "True if RUCC 1–3 (metro county)",      "Derived"),
        ("is_rural",                "bool",   "True if RUCC 7–9 (rural county)",      "Derived"),
    ]
    dd = pd.DataFrame(dict_rows, columns=["Field", "Type", "Description", "Source"])
    st.dataframe(dd, use_container_width=True, hide_index=True)

    if manifest:
        st.markdown("### Source Citations")
        for key, src in manifest.get("sources", {}).items():
            st.markdown(f"**{src['description']}**  \n[{src['url']}]({src['url']})")
            st.caption(f"Variables: {', '.join(src['variables'])}")

        st.markdown("### Methodology")
        st.info(manifest.get("methodology", ""))

        build_ts = manifest.get("build_timestamp", "unknown")
        st.caption(f"Pipeline last run: {build_ts}")


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    df = load_data()
    manifest = load_manifest()

    # Header
    st.markdown("# 🏭 Indiana 92-County Economic Dashboard")
    st.markdown(
        "County-level economic indicators for all 92 Indiana counties. "
        "Sources: U.S. Census ACS · BLS LAUS · USDA ERS"
    )

    if df is None:
        st.error(
            "⚠️ No data found. Run the pipeline first:\n\n"
            "```bash\npython pipeline/build_dataset.py\n```"
        )
        st.stop()

    # Sidebar filters
    indicator, rucc_filter, pop_range, county_select = sidebar(df)

    # Apply filters
    filtered = df.copy()
    if rucc_filter:
        filtered = filtered[filtered["rucc_code"].isin(rucc_filter)]
    filtered = filtered[
        filtered["total_population"].between(pop_range[0], pop_range[1])
    ]

    # State summary
    st.markdown("---")
    render_state_summary(filtered)
    st.markdown("---")

    # Tabs
    tab_map, tab_charts, tab_table, tab_docs = st.tabs(
        ["🗺 Map", "📊 Charts", "📋 Rankings", "📚 Data Dictionary"]
    )

    with tab_map:
        st.markdown(f"**{INDICATORS[indicator]['label']}** — {len(filtered)} counties")
        try:
            geojson = load_geojson()
            fig = render_map(filtered, geojson, indicator)
            st.plotly_chart(fig, use_container_width=True)
        except Exception as e:
            st.warning(f"Map unavailable (requires internet for GeoJSON): {e}")
            st.info("Charts and tables remain fully functional.")

        if county_select != "(All counties)":
            render_county_spotlight(df, county_select)

    with tab_charts:
        col1, col2 = st.columns(2)
        with col1:
            st.plotly_chart(render_distribution(filtered, indicator), use_container_width=True)
        with col2:
            st.plotly_chart(render_scatter(filtered), use_container_width=True)

        if county_select != "(All counties)":
            render_county_spotlight(df, county_select)

    with tab_table:
        render_rankings(filtered, indicator)

    with tab_docs:
        render_data_dict(manifest)


if __name__ == "__main__":
    main()
