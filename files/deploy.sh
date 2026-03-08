#!/usr/bin/env bash
# deploy.sh — HoosierDataLab home server setup
# Run once after cloning the repo.
# Usage: bash deploy.sh

set -e

echo ""
echo "═══════════════════════════════════════"
echo "  HoosierDataLab — Deployment Setup"
echo "═══════════════════════════════════════"
echo ""

# ── 1. System dependencies ──────────────────────────────────────────────────
echo "→ Installing system packages..."
sudo apt update -q
sudo apt install -y python3-pip nodejs npm nginx certbot python3-certbot-nginx

# ── 2. Python API dependencies ──────────────────────────────────────────────
echo "→ Installing Python dependencies..."
pip3 install --user -r api/requirements.txt
pip3 install --user -r requirements.txt  # pipeline deps

# ── 3. Data pipeline ─────────────────────────────────────────────────────────
echo "→ Running data pipeline (this may take a few minutes)..."
python3 pipeline/build_dataset.py

# ── 4. Build React frontend ──────────────────────────────────────────────────
echo "→ Building React frontend..."
cd frontend
npm install
npm run build
cd ..

# ── 5. Nginx ─────────────────────────────────────────────────────────────────
echo "→ Configuring Nginx..."
# Replace YOUR_USER with actual username
ACTUAL_USER=$(whoami)
sed -i "s/YOUR_USER/$ACTUAL_USER/g" nginx/hoosierdata.conf

sudo cp nginx/hoosierdata.conf /etc/nginx/sites-available/hoosierdata
sudo ln -sf /etc/nginx/sites-available/hoosierdata /etc/nginx/sites-enabled/hoosierdata
sudo nginx -t && sudo systemctl reload nginx

# ── 6. systemd services ───────────────────────────────────────────────────────
echo "→ Setting up systemd services..."
sed -i "s/YOUR_USER/$ACTUAL_USER/g" systemd/hoosierdata-api.service
sed -i "s/YOUR_USER/$ACTUAL_USER/g" systemd/hoosierdata-refresh.service

sudo cp systemd/hoosierdata-api.service /etc/systemd/system/
sudo cp systemd/hoosierdata-refresh.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hoosierdata-api
sudo systemctl start hoosierdata-api

echo ""
echo "═══════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Point HoosierDataLab.com DNS A record → $(curl -s ifconfig.me)"
echo "  2. Forward ports 80 and 443 on your router → this machine"
echo "  3. Run: sudo certbot --nginx -d hoosierDataLab.com"
echo "  4. Add API keys to /etc/systemd/system/hoosierdata-api.service"
echo "     then: sudo systemctl daemon-reload && sudo systemctl restart hoosierdata-api"
echo ""
echo "  Check status: sudo systemctl status hoosierdata-api"
echo "  View logs:    sudo journalctl -u hoosierdata-api -f"
echo "═══════════════════════════════════════"
