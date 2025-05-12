# Fix hardcoded API URLs in compiled JS files
param(
    [string]$oldUrl = "alumni-api-i4gs.onrender.com",
    [string]$newUrl = "final-ecri.onrender.com"
)

Write-Host "=== Fix Hardcoded API URLs in Build Files ===" -ForegroundColor Cyan

# Check if the dist folder exists
if (!(Test-Path "frontend\dist")) {
    Write-Host "The frontend/dist folder does not exist. Please build the frontend first." -ForegroundColor Red
    exit 1
}

# Find all JS files in the dist folder
$jsFiles = Get-ChildItem -Path "frontend\dist" -Filter "*.js" -Recurse

# Create a regex pattern that matches even URL substrings
$patterns = @(
    $oldUrl,
    "api-i4gs",
    "alumni-api",
    "i4gs.onrender"
)

$totalChanges = 0
$filesChanged = 0

foreach ($file in $jsFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    $originalContent = $content
    $hasChanges = $false
    
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            Write-Host "Found API URL pattern '$pattern' in $($file.Name)" -ForegroundColor Yellow
            
            # Apply different replacements based on pattern
            if ($pattern -eq $oldUrl) {
                $content = $content -replace $oldUrl, $newUrl
            }
            elseif ($pattern -eq "api-i4gs") {
                $content = $content -replace "api-i4gs", "inal-ecri"
            }
            elseif ($pattern -eq "alumni-api") {
                $content = $content -replace "alumni-api", "final-ecri"
            }
            elseif ($pattern -eq "i4gs.onrender") {
                $content = $content -replace "i4gs.onrender", "ecri.onrender"
            }
            
            $hasChanges = $true
        }
    }
    
    # Special case for index.js which could have other references
    if ($file.Name -match "index") {
        # Try to find any reference to the old API URL
        if ($content -match "alumni-api-i4gs" -or $content -match "i4gs.onrender" -or $content -match "api-i4gs") {
            Write-Host "Found additional API URL patterns in index file $($file.Name)" -ForegroundColor Yellow
            
            # More aggressive replacements for index file
            $content = $content -replace "alumni-api-i4gs", "final-ecri"
            $content = $content -replace "i4gs\.onrender\.com", "ecri.onrender.com"
            $hasChanges = $true
        }
    }
    
    if ($hasChanges) {
        # Count changes to show progress
        $changesMade = ($originalContent.Length - $content.Length)
        $totalChanges += [Math]::Abs($changesMade)
        $filesChanged++
        
        # Write content back to file
        Set-Content -Path $file.FullName -Value $content
        Write-Host "Updated file: $($file.Name) with $changesMade bytes changed" -ForegroundColor Green
    }
}

Write-Host "Fix complete. Changed $filesChanged files with $totalChanges total bytes changed." -ForegroundColor Cyan
Write-Host "Please redeploy your frontend with the updated files." -ForegroundColor Cyan 