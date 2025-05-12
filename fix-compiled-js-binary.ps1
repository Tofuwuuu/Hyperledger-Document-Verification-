# This script searches for binary patterns in compiled JavaScript files
Write-Host "Checking binary patterns in JavaScript files..." -ForegroundColor Cyan

# Get all JS files in the dist/assets directory
$jsFiles = Get-ChildItem -Path "frontend\dist\assets\" -Filter "*.js" -Recurse

# Create a temp directory to save files with matches
$tempDir = "frontend\dist\temp"
if (!(Test-Path $tempDir)) {
    New-Item -Path $tempDir -ItemType Directory | Out-Null
}

$matchCount = 0

foreach ($file in $jsFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    
    # Check for partial matches of the URL to catch minified or encoded versions
    if ($content -match "api-i4gs" -or $content -match "alumni-api" -or 
        $content -match "i4gs.onrender" -or $content -match "alumni.*onrender") {
        Write-Host "Found suspicious pattern in: $($file.Name)" -ForegroundColor Yellow
        # Copy the file to the temp directory for manual inspection
        Copy-Item $file.FullName -Destination "$tempDir\$($file.Name)" -Force
        $matchCount++
    }
}

Write-Host "Found suspicious patterns in $matchCount files" -ForegroundColor Green
Write-Host "Files with matches are copied to $tempDir for inspection" -ForegroundColor Cyan

# Now let's try direct binary search and replace
Write-Host "Attempting binary replace in the index.js file..." -ForegroundColor Cyan

$mainIndexJsFile = "frontend\dist\assets\index-Dq7ztNkn.js"
$content = Get-Content -Path $mainIndexJsFile -Raw

$replacements = @(
    @("alumni-api-i4gs.onrender.com", "final-ecri.onrender.com"),
    @("alumni-api-i4gs", "final-ecri"),
    @("api-i4gs", "inal-ecri")
)

foreach ($replacement in $replacements) {
    $oldValue = $replacement[0]
    $newValue = $replacement[1]
    
    if ($content -match $oldValue) {
        Write-Host "Found '$oldValue' in main index.js file" -ForegroundColor Green
        $content = $content -replace $oldValue, $newValue
        Set-Content -Path $mainIndexJsFile -Value $content
    }
}

Write-Host "Done! Direct binary replacements completed." -ForegroundColor Cyan 