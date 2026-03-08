# HoosierDataLab

Indiana 92-County Economic Research Dashboard — [hoosierDataLab.com](https://hoosierDataLab.com)

Interactive county map with hover tooltips, indicator selector, county detail panel, and rankings table. All data sourced from public government APIs.

## Stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Frontend | React + Vite + D3 (choropleth)|
| Backend  | FastAPI + Uvicorn             |
| Pipeline | Python (Census, BLS, USDA)   |
| Server   | Nginx + systemd               |
| SSL      | Let's Encrypt / Certbot       |

## Data Sources

| Source | Data | Year |
|--------|------|------|
| U.S. Census ACS 5-Year | Income, poverty, education, LFP | 2022 |
| BLS Local Area Unemployment Statistics | Unemployment rate | 2023 |
| USDA ERS Rural-Urban Continuum Codes | Rural/metro classification | 2023 |

## Quick Start (local dev)

```bash
# 1. Install dependencies
pip install -r requirements.txt -r api/requirements.txt
cd frontend && npm install && cd ..

# 2. Fetch real data
python pipeline/build_dataset.py

# 3. Start API (terminal 1)
uvicorn api.main:app --port 8000 --reload

# 4. Start frontend dev server (terminal 2)
cd frontend && npm run dev
# → http://localhost:5173
```

## Deploy to Home Server

```bash
bash deploy.sh
```

Then:
1. Point `HoosierDataLab.com` DNS A record → your home IP
2. Forward ports 80 and 443 on your router to this machine
3. Set up dynamic DNS (Cloudflare recommended — free, hides home IP)
4. Run `sudo certbot --nginx -d hoosierDataLab.com` for HTTPS

## Project Structure

```
hoosier-data-lab/
  api/
    main.py               ← FastAPI — serves /api/counties, /api/county/{fips}, etc.
    requirements.txt
  frontend/
    src/
      App.jsx             ← Root layout
      components/
        Map.jsx           ← D3 choropleth with hover/click/tooltip
        LeftPanel.jsx     ← Indicator selector + state summary stats
        RightPanel.jsx    ← County detail + rankings table
      hooks/
        useData.js        ← Fetches all API data on load
      utils/
        format.js         ← Value formatting (currency, percent, number)
      styles/
        global.css        ← Full design system (editorial dark theme)
  pipeline/               ← Data pipeline (unchanged from v1)
  nginx/
    hoosierdata.conf      ← Nginx reverse proxy config
  systemd/
    hoosierdata-api.service     ← Keeps API running on reboot
    hoosierdata-refresh.service ← Weekly data refresh timer
  deploy.sh               ← One-shot setup script
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/counties` | All 92 counties, all indicators |
| `GET /api/county/{fips}` | Single county by FIPS |
| `GET /api/indicators` | Indicator metadata |
| `GET /api/stats/summary` | State-level summary stats |
| `GET /api/manifest` | Pipeline build metadata |
| `GET /health` | Server health check |

## Refresh Data

```bash
# Re-fetch all sources
python pipeline/build_dataset.py --force

# Restart API to pick up new data
sudo systemctl restart hoosierdata-api
```

## v2 Planned

- BLS QCEW manufacturing employment + wages by county
- FRED economic indicators (GDP, personal income)
- Historical trend charts (multi-year ACS comparison)
