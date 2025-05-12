#!/bin/bash

# Script to redeploy the frontend with the correct API URL
echo "Updating API URL for deployment..."

# Create temporary .env.production file
echo "VITE_API_URL=https://final-ecri.onrender.com/api/v1" > .env.production
echo "VITE_POLLING_INTERVAL=5000" >> .env.production

echo "Building with new API URL..."
npm run build

echo "Done! You can now redeploy the dist folder to Render."
echo "Your frontend will connect to the correct backend at final-ecri.onrender.com" 