#!/bin/bash
echo "Starting VeeCall application..."
echo "Python version: $(python --version)"
echo "Installing dependencies..."
pip install -r requirements.txt
echo "Starting FastAPI server..."
uvicorn videocalling:app --host 0.0.0.0 --port ${PORT:-8001} --log-level info
