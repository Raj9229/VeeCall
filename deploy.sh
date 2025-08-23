#!/bin/bash
set -e

echo "Setting up Python environment..."
python3 --version || python --version

echo "Upgrading pip..."
python3 -m pip install --upgrade pip || python -m pip install --upgrade pip

echo "Installing requirements..."
python3 -m pip install -r requirements.txt || python -m pip install -r requirements.txt

echo "Starting application..."
exec python3 -m uvicorn videocalling:app --host 0.0.0.0 --port ${PORT:-8001} || exec python -m uvicorn videocalling:app --host 0.0.0.0 --port ${PORT:-8001}
