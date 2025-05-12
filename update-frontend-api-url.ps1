# Create environment file for the frontend with the new API URL
Write-Host "Creating frontend environment file with the correct API URL..." -ForegroundColor Cyan
"VITE_API_URL=https://final-ecri.onrender.com/api/v1" | Out-File -FilePath frontend\.env.production -Encoding UTF8

# Rebuild the frontend
Write-Host "Rebuilding frontend..." -ForegroundColor Cyan
cd frontend
npm run build

Write-Host "Frontend environment updated successfully. Please redeploy your frontend to Render." -ForegroundColor Green
Write-Host "New API URL configured: https://final-ecri.onrender.com/api/v1" -ForegroundColor Green 