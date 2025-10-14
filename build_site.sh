#!/usr/bin/env bash
set -euo pipefail

VENV_DIR=".venv"
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtualenv in $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
pip install -r requirements.txt
python build_blog.py

