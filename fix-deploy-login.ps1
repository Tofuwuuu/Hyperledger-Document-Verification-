# Quick emergency fix for CVSU Alumni login issue
# This script directly patches compiled JavaScript files for deployment

Write-Host "=== CVSU Alumni Emergency Login Fix ===" -ForegroundColor Cyan

# Define the URLs
$OLD_API = "alumni-api-i4gs.onrender.com"
$NEW_API = "final-ecri.onrender.com"

# Ensure dist directory exists
if (!(Test-Path "frontend\dist")) {
    Write-Host "The frontend/dist folder does not exist. Please build the frontend first." -ForegroundColor Red
    exit 1
}

# Find all JS files in dist directory
$jsFiles = Get-ChildItem -Path "frontend\dist\assets" -Filter "*.js"
Write-Host "Found $($jsFiles.Count) JavaScript files to check" -ForegroundColor Green

$totalChanges = 0
$filesChanged = 0

foreach ($file in $jsFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    $originalSize = $content.Length
    $hasChanged = $false
    
    # Replace all instances of the old API URL with the new one
    if ($content -match $OLD_API) {
        Write-Host "Found old API URL in $($file.Name)" -ForegroundColor Yellow
        $content = $content -replace $OLD_API, $NEW_API
        $hasChanged = $true
    }
    
    # Also check more specific patterns
    $patterns = @(
        "https://alumni-api-i4gs.onrender.com/api/v1",
        "alumni-api-i4gs",
        "i4gs.onrender"
    )
    
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            Write-Host "  Found pattern '$pattern' in $($file.Name)" -ForegroundColor Yellow
            
            if ($pattern -eq "https://alumni-api-i4gs.onrender.com/api/v1") {
                $content = $content -replace "https://alumni-api-i4gs.onrender.com/api/v1", "https://final-ecri.onrender.com/api/v1"
            }
            elseif ($pattern -eq "alumni-api-i4gs") {
                $content = $content -replace "alumni-api-i4gs", "final-ecri"
            }
            elseif ($pattern -eq "i4gs.onrender") {
                $content = $content -replace "i4gs.onrender", "ecri.onrender"
            }
            
            $hasChanged = $true
        }
    }
    
    # Write changes if any were made
    if ($hasChanged) {
        Set-Content -Path $file.FullName -Value $content
        $newSize = $content.Length
        $diffSize = [Math]::Abs($originalSize - $newSize)
        
        $filesChanged++
        $totalChanges += $diffSize
        
        Write-Host "  Updated file $($file.Name): Changed $diffSize bytes" -ForegroundColor Green
    }
}

Write-Host "`nSummary: Modified $filesChanged files with $totalChanges total bytes changed" -ForegroundColor Cyan

if ($filesChanged -gt 0) {
    Write-Host "`nNext steps:" -ForegroundColor Green
    Write-Host "1. Deploy the updated dist folder to your hosting service" -ForegroundColor White
    Write-Host "2. Clear your browser cache completely before testing" -ForegroundColor White
    Write-Host "3. Try logging in again" -ForegroundColor White
} else {
    Write-Host "`nNo files were changed. The issue might be with the backend CORS configuration." -ForegroundColor Yellow
    Write-Host "Please check the backend CORS settings to ensure it accepts the correct origin and credentials." -ForegroundColor White
} 