# This script searches and replaces the old API URL in all compiled JavaScript files
Write-Host "Fixing compiled JavaScript files..." -ForegroundColor Cyan

# Get all JS files in the dist/assets directory
$jsFiles = Get-ChildItem -Path "frontend\dist\assets\" -Filter "*.js" -Recurse

$oldApiUrl = "alumni-api-i4gs.onrender.com"
$newApiUrl = "final-ecri.onrender.com"

$fileCount = 0
$replacementCount = 0

foreach ($file in $jsFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    if ($content -match $oldApiUrl) {
        Write-Host "Found references in file: $($file.Name)" -ForegroundColor Yellow
        $newContent = $content -replace $oldApiUrl, $newApiUrl
        Set-Content -Path $file.FullName -Value $newContent
        $replacementCount++
    }
    $fileCount++
}

Write-Host "Processed $fileCount files, made replacements in $replacementCount files" -ForegroundColor Green

# Also check for any https://final-rkpz.onrender.com references
$oldApiUrl2 = "final-rkpz.onrender.com"
$fileCount = 0
$replacementCount = 0

foreach ($file in $jsFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    if ($content -match $oldApiUrl2) {
        Write-Host "Found references to $oldApiUrl2 in file: $($file.Name)" -ForegroundColor Yellow
        $newContent = $content -replace $oldApiUrl2, $newApiUrl
        Set-Content -Path $file.FullName -Value $newContent
        $replacementCount++
    }
    $fileCount++
}

Write-Host "Processed $fileCount files, made replacements in $replacementCount files" -ForegroundColor Green
Write-Host "Done! Upload the dist folder to Render." -ForegroundColor Cyan 