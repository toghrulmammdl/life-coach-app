#!/bin/bash

echo "Activating Python virtual environment..."
cd server/
source .venv/bin/activate

echo "Starting Backend..."
pip install -r requirements.txt
uvicorn main:app --reload &

echo "Starting Frontend..."
cd ../client/
npm install
npm run dev &

sleep 3

echo "Opening browser..."
xdg-open http://localhost:5173

wait
