#!/bin/bash

# Create environment file for the frontend with the new API URL
echo "Creating frontend environment file with the correct API URL..."
echo "VITE_API_URL=https://final-ecri.onrender.com/api/v1" > frontend/.env.production

# Rebuild the frontend
echo "Rebuilding frontend..."
cd frontend
npm run build

echo "Frontend environment updated successfully. Please redeploy your frontend to Render."
echo "New API URL configured: https://final-ecri.onrender.com/api/v1" 