# Restart backend server
Write-Host "Stopping any existing Python processes..." -ForegroundColor Yellow
try {
    Stop-Process -Name python -ErrorAction SilentlyContinue
    Write-Host "Python processes stopped." -ForegroundColor Green
} 
catch {
    Write-Host "No Python processes were running." -ForegroundColor Gray
}

Write-Host "Starting backend server..." -ForegroundColor Green
cd backend
python run.py 