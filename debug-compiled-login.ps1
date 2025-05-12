# Script to find references to old API URLs in compiled JS files
Write-Host "=== Debug Compiled Login Script ===" -ForegroundColor Cyan

$urlPatterns = @(
    "alumni-api-i4gs.onrender.com",
    "alumni-api",
    "i4gs.onrender.com",
    "onrender.com/api/v1/auth/login",
    "/api/v1/auth/login",
    "https://alumni-"
)

$jsFiles = Get-ChildItem -Path "frontend\dist\assets" -Filter "*.js"

Write-Host "Scanning $($jsFiles.Count) JavaScript files for references to API URLs..."

$foundReferences = @()

foreach ($file in $jsFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    $foundInFile = $false
    $matchedLines = @()
    
    foreach ($pattern in $urlPatterns) {
        if ($content -match $pattern) {
            if (!$foundInFile) {
                Write-Host "Found reference in: $($file.Name)" -ForegroundColor Yellow
                $foundInFile = $true
            }
            
            # Extract lines containing the reference
            $lines = (Get-Content -Path $file.FullName) -join "`n" -split "`n"
            $lineNumber = 1
            
            foreach ($line in $lines) {
                if ($line -match $pattern) {
                    # Avoid duplicates
                    if (!($matchedLines | Where-Object { $_.LineNumber -eq $lineNumber })) {
                        $contextStart = [Math]::Max(0, $line.IndexOf($pattern) - 30)
                        $contextLength = [Math]::Min(200, $line.Length - $contextStart)
                        
                        $matchedLines += @{
                            LineNumber = $lineNumber
                            Pattern = $pattern
                            Line = $line
                            Context = if ($line.Length -le 200) { $line } else { "..." + $line.Substring($contextStart, $contextLength) + "..." }
                        }
                    }
                }
                $lineNumber++
            }
        }
    }
    
    if ($matchedLines.Count -gt 0) {
        $foundReferences += @{
            FileName = $file.Name
            FilePath = $file.FullName
            Matches = $matchedLines
        }
    }
}

Write-Host "Summary of findings:" -ForegroundColor Green
if ($foundReferences.Count -eq 0) {
    Write-Host "No references to any known API URL patterns found in compiled JavaScript files." -ForegroundColor Green
} else {
    Write-Host "Found $($foundReferences.Count) files with references to API URLs:" -ForegroundColor Yellow
    
    foreach ($ref in $foundReferences) {
        Write-Host "`nFile: $($ref.FileName)" -ForegroundColor Yellow
        Write-Host "Path: $($ref.FilePath)" -ForegroundColor Gray
        Write-Host "Matches:" -ForegroundColor Yellow
        
        foreach ($match in $ref.Matches) {
            Write-Host "  Line $($match.LineNumber) (Pattern: $($match.Pattern)):" -ForegroundColor Cyan
            Write-Host "    $($match.Context)" -ForegroundColor White
        }
    }
    
    Write-Host "`nThese references may be causing the CORS issues. Consider fixing them." -ForegroundColor Yellow
}

# Check the login files specifically
Write-Host "`nAnalyzing login-related files:" -ForegroundColor Cyan
$loginFiles = Get-ChildItem -Path "frontend\dist\assets" -Filter "*ogin*.js"
foreach ($file in $loginFiles) {
    Write-Host "`nFull content analysis of $($file.Name):" -ForegroundColor Gray
    $content = Get-Content -Path $file.FullName -Raw
    
    # Look for auth-related endpoints 
    $authEndpoints = [regex]::Matches($content, '(https://[^"\''\s]+|/api/v1/auth/[^"\''\s]+)')
    
    if ($authEndpoints.Count -gt 0) {
        Write-Host "Found $($authEndpoints.Count) auth endpoints:" -ForegroundColor Yellow
        foreach ($endpoint in $authEndpoints) {
            Write-Host "  - $($endpoint.Value)" -ForegroundColor White
        }
    } else {
        Write-Host "No explicit auth endpoints found in this file." -ForegroundColor Gray
    }
}

# Check for CORS configuration in backend
Write-Host "`nChecking for environment variables:" -ForegroundColor Cyan
$envFiles = Get-ChildItem -Path "frontend" -Filter ".env*" -Force
foreach ($file in $envFiles) {
    Write-Host "`nContent of $($file.Name):" -ForegroundColor Gray
    Get-Content -Path $file.FullName
}

# Check index.html
Write-Host "`nChecking index.html for any hardcoded URLs:" -ForegroundColor Cyan
$indexHtml = Get-Content -Path "frontend\dist\index.html" -Raw
$htmlUrls = [regex]::Matches($indexHtml, '(https://[^"\''\s]+)')
if ($htmlUrls.Count -gt 0) {
    Write-Host "Found $($htmlUrls.Count) URLs in index.html:" -ForegroundColor Yellow
    foreach ($url in $htmlUrls) {
        Write-Host "  - $($url.Value)" -ForegroundColor White
    }
} else {
    Write-Host "No hardcoded URLs found in index.html." -ForegroundColor Gray
}

Write-Host "`nSolution recommendations:" -ForegroundColor Green
Write-Host "1. Update any hard-coded URLs in the compiled files using fix-compiled-api-url.ps1" -ForegroundColor White
Write-Host "2. Ensure all environment variables are correctly set" -ForegroundColor White
Write-Host "3. Check backend CORS configuration to ensure it accepts the frontend origin" -ForegroundColor White
Write-Host "4. Rebuild the frontend with the correct API URL (npm run build)" -ForegroundColor White
Write-Host "5. Try setting withCredentials explicitly in the auth service API calls" -ForegroundColor White
Write-Host "6. Update the CORS policy in the backend to allow credentials with specific origins" -ForegroundColor White
