# PowerShell script to redeploy the frontend with the correct API URL
Write-Host "Updating API URL for deployment..." -ForegroundColor Green

# Create temporary .env.production file
"VITE_API_URL=https://final-rkpz.onrender.com" | Out-File -FilePath .env.production -Encoding UTF8
"VITE_POLLING_INTERVAL=5000" | Out-File -FilePath .env.production -Append -Encoding UTF8

Write-Host "Building with new API URL..." -ForegroundColor Green
npm run build

Write-Host "Done! You can now redeploy the dist folder to Render." -ForegroundColor Green
Write-Host "Your frontend will connect to the correct backend at final-rkpz.onrender.com" -ForegroundColor Cyan 