# Fix CORS login issues in the CVSU Alumni System

Write-Host "=== CORS Login Fix Script ===" -ForegroundColor Cyan

# 1. Create environment variables with the new API URL
Write-Host "Creating .env files with the correct API URL..." -ForegroundColor Green
"VITE_API_URL=https://final-ecri.onrender.com/api/v1" | Out-File -FilePath frontend\.env -Encoding UTF8
"VITE_API_URL=https://final-ecri.onrender.com/api/v1" | Out-File -FilePath frontend\.env.production -Encoding UTF8
"VITE_API_URL=https://final-ecri.onrender.com/api/v1" | Out-File -FilePath frontend\.env.local -Encoding UTF8

# 2. Update config.js file to make sure it's using the environment variable
Write-Host "Checking frontend/src/config.js file..." -ForegroundColor Green
$configPath = "frontend\src\config.js"
$updatedConfig = @'
// Use environment variable with fallback
let baseApiUrl = import.meta.env.VITE_API_URL || 'https://final-ecri.onrender.com/api/v1';
// Remove trailing slash if present
baseApiUrl = baseApiUrl.endsWith('/') ? baseApiUrl.slice(0, -1) : baseApiUrl;
// Add /api/v1 only if it's not already included
export const API_URL = baseApiUrl.includes('/api/v1') ? baseApiUrl : `${baseApiUrl}/api/v1`; 
'@

Set-Content -Path $configPath -Value $updatedConfig -Force
Write-Host "Updated config.js to use environment variables" -ForegroundColor Green

# 3. Rebuild the frontend
Write-Host "Rebuilding frontend..." -ForegroundColor Green
cd frontend
npm run build

Write-Host "CORS login fix complete. Please redeploy your frontend and backend changes." -ForegroundColor Cyan
Write-Host "Backend will now use specific allowed origins instead of wildcards, and frontend will use the correct API URL." -ForegroundColor Cyan
cd .. 