# Emergency fix for CVSU Alumni login CORS issue
# This script directly modifies the index.js files where the problem typically occurs

Write-Host "=== CVSU Alumni EMERGENCY Login Fix ===" -ForegroundColor Red

# Build a new client-side script that will fix the URL at runtime
$clientFixScript = @"
<script>
// Emergency CORS fix - this will patch API URLs at runtime
(function() {
    console.log('🔧 Emergency CORS fix: Applying runtime patches');
    
    // Override XMLHttpRequest open method to intercept API calls
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        // Check if URL contains the old API URL and replace it
        if (typeof url === 'string' && url.includes('alumni-api-i4gs.onrender.com')) {
            url = url.replace('alumni-api-i4gs.onrender.com', 'final-ecri.onrender.com');
            console.log('🔄 CORS fix: Redirecting API call to:', url);
        }
        
        return originalOpen.call(this, method, url, async, user, password);
    };
    
    // Also patch fetch API
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (typeof url === 'string' && url.includes('alumni-api-i4gs.onrender.com')) {
            url = url.replace('alumni-api-i4gs.onrender.com', 'final-ecri.onrender.com');
            console.log('🔄 CORS fix: Redirecting fetch to:', url);
        }
        
        return originalFetch.call(this, url, options);
    };
    
    // Also patch axios if available
    if (window.axios) {
        const originalAxiosRequest = window.axios.request;
        window.axios.request = function(config) {
            if (config.url && typeof config.url === 'string' && config.url.includes('alumni-api-i4gs.onrender.com')) {
                config.url = config.url.replace('alumni-api-i4gs.onrender.com', 'final-ecri.onrender.com');
                console.log('🔄 CORS fix: Redirecting axios request to:', config.url);
            }
            
            if (config.baseURL && typeof config.baseURL === 'string' && config.baseURL.includes('alumni-api-i4gs.onrender.com')) {
                config.baseURL = config.baseURL.replace('alumni-api-i4gs.onrender.com', 'final-ecri.onrender.com');
                console.log('🔄 CORS fix: Redirecting axios baseURL to:', config.baseURL);
            }
            
            return originalAxiosRequest.call(this, config);
        };
    }
    
    console.log('✅ Emergency CORS fix applied');
})();
</script>
"@

# Check if index.html exists
$indexHtmlPath = "frontend\dist\index.html"
if (!(Test-Path $indexHtmlPath)) {
    Write-Host "Cannot find index.html at: $indexHtmlPath" -ForegroundColor Red
    exit 1
}

# Backup the original index.html
$backupPath = "frontend\dist\index.html.bak"
Copy-Item -Path $indexHtmlPath -Destination $backupPath -Force
Write-Host "Created backup of index.html at: $backupPath" -ForegroundColor Yellow

# Read the index.html content
$indexHtml = Get-Content -Path $indexHtmlPath -Raw

# Insert our fix script right before the closing </head> tag
if ($indexHtml -match "</head>") {
    $indexHtml = $indexHtml -replace "</head>", "$clientFixScript`n</head>"
    Set-Content -Path $indexHtmlPath -Value $indexHtml
    Write-Host "Successfully added emergency fix script to index.html" -ForegroundColor Green
    
    # Also scan and directly patch the main index JS files specifically
    $indexJsFiles = Get-ChildItem -Path "frontend\dist\assets" -Filter "index*.js"
    foreach ($file in $indexJsFiles) {
        Write-Host "Scanning $($file.Name) for API URLs..." -ForegroundColor Yellow
        $content = Get-Content -Path $file.FullName -Raw
        
        # Try several variations of the API URL pattern
        $content = $content -replace "alumni-api-i4gs\.onrender\.com", "final-ecri.onrender.com"
        $content = $content -replace "alumni-api-i4gs", "final-ecri"
        $content = $content -replace "i4gs\.onrender", "ecri.onrender"
        
        # Write the changed content back
        Set-Content -Path $file.FullName -Value $content
        Write-Host "Attempted direct replace in $($file.Name)" -ForegroundColor Green
    }
} else {
    Write-Host "Could not find </head> tag in index.html" -ForegroundColor Red
}

Write-Host "`nEmergency fix applied. Steps to deploy:" -ForegroundColor Cyan
Write-Host "1. Deploy the updated dist folder to your hosting service" -ForegroundColor White
Write-Host "2. Clear your browser cache completely" -ForegroundColor White
Write-Host "3. Try logging in again" -ForegroundColor White
Write-Host "`nIf issues persist, contact the backend team to update CORS settings to:" -ForegroundColor Cyan
Write-Host "  - Allow origin: https://alumni-frontend-4r7o.onrender.com" -ForegroundColor White
Write-Host "  - Allow credentials: true" -ForegroundColor White 