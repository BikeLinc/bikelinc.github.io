#!/usr/bin/env bash
set -euo pipefail

VENV_DIR=".venv"
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt