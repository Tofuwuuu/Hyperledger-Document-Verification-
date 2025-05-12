# CVSU Alumni System - CORS Login Problem Fix Script
# This script addresses the CORS issues when logging in from the frontend to the backend API

Write-Host "=== CVSU Alumni System - CORS Login Fix Script ===" -ForegroundColor Cyan

# Step 1: Define the correct API URL and frontend URL
$NEW_API_URL = "https://final-ecri.onrender.com"
$FRONTEND_URL = "https://alumni-frontend-4r7o.onrender.com"
$OLD_API_URL = "https://alumni-api-i4gs.onrender.com"

Write-Host "Using the following URLs:" -ForegroundColor Yellow
Write-Host "  Frontend URL: $FRONTEND_URL" -ForegroundColor White
Write-Host "  New API URL: $NEW_API_URL" -ForegroundColor White
Write-Host "  Old API URL (to be replaced): $OLD_API_URL" -ForegroundColor White

# Step 2: Check if the compiled dist directory exists
if (!(Test-Path "frontend\dist")) {
    Write-Host "The frontend/dist folder does not exist. Please build the frontend first." -ForegroundColor Red
    Write-Host "Run 'cd frontend && npm run build' to build the frontend." -ForegroundColor Red
    exit 1
}

# Step 3: Update all environment files to use the correct API URL 
Write-Host "`nUpdating environment files..." -ForegroundColor Green
$envFiles = @(".env", ".env.local", ".env.production")
foreach ($file in $envFiles) {
    $filePath = "frontend\$file"
    
    if (Test-Path $filePath) {
        "VITE_API_URL=$NEW_API_URL/api/v1" | Out-File -FilePath $filePath -Encoding utf8 -Force
        Write-Host "  Updated $file with the new API URL" -ForegroundColor White
    }
}

# Step 4: Create a direct login patch to avoid CORS issues
Write-Host "`nCreating authService patch..." -ForegroundColor Green
$authServicePatchContent = @"
// Direct login method with CORS-friendly configuration
directLogin: async (email, password, remember = false) => {
  try {
    console.log('Attempting direct login with secure configuration');
    
    // Create form data object with the correct fields
    const formData = new FormData();
    formData.append('username', email);  // Use 'username' as the field name for FastAPI OAuth2
    formData.append('password', password);
    formData.append('remember', String(remember));
    
    // Get the current origin to help with CORS
    const origin = window.location.origin;
    
    // Use the correct API URL from environment variables with fallback
    const apiUrl = "$NEW_API_URL/api/v1";
    
    console.log('Using API URL for login:', apiUrl + '/auth/login');
    
    // Create a custom axios instance for this request with CORS-friendly config
    const response = await axios({
      method: 'post',
      url: apiUrl + '/auth/login',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
        'Origin': origin
      },
      withCredentials: true
    });
    
    if (response.data.access_token) {
      // Store the token in localStorage
      localStorage.setItem('token', response.data.access_token);
      
      // Store the refresh token if available
      if (response.data.refresh_token) {
        localStorage.setItem('refresh_token', response.data.refresh_token);
      }
      
      // Store the user data if available
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } else {
      throw new Error('No access token received');
    }
  } catch (error) {
    console.error('Direct login error:', error);
    throw error;
  }
}
"@

# Step 5: Find and patch auth service files
Write-Host "`nPatching auth service files..." -ForegroundColor Green
$authServiceFiles = Get-ChildItem -Path frontend\src -Recurse -Include "*.js" | Where-Object { 
    (Get-Content $_ -Raw) -match "directLogin"
}

if ($authServiceFiles.Count -eq 0) {
    Write-Host "  No auth service files found with directLogin method." -ForegroundColor Yellow
} else {
    foreach ($file in $authServiceFiles) {
        $filePath = $file.FullName
        $fileName = $file.Name
        Write-Host "  Found directLogin in file: $fileName" -ForegroundColor Yellow
        $fileContent = Get-Content -Path $filePath -Raw
        
        if ($fileContent -match "directLogin:\s*async\s*\(.*?\)\s*=>.*?\{") {
            Write-Host "  Backing up original file to: $filePath.bak" -ForegroundColor Yellow
            Copy-Item -Path $filePath -Destination "$filePath.bak" -Force
            
            # Replace the directLogin method with our patched version
            $newContent = $fileContent -replace "directLogin:\s*async\s*\(.*?\)\s*=>.*?(?=,\s*(?:getMFAStatus|setupMFA|[a-zA-Z]*Service|[}]))", $authServicePatchContent
            Set-Content -Path $filePath -Value $newContent
            Write-Host "  Patched directLogin method in $fileName" -ForegroundColor Green
        }
    }
}

# Step 6: Find all JS files in the dist folder
Write-Host "`nScanning compiled JavaScript files for hard-coded API URLs..." -ForegroundColor Green
$jsFiles = Get-ChildItem -Path "frontend\dist\assets" -Filter "*.js"
$totalChanges = 0
$filesChanged = 0

foreach ($file in $jsFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    $originalContent = $content
    $hasChanges = $false
    
    # Check if file contains any reference to the old API URL
    if ($content -match $OLD_API_URL) {
        Write-Host "  Found old API URL in $($file.Name)" -ForegroundColor Yellow
        $content = $content -replace $OLD_API_URL, $NEW_API_URL
        $hasChanges = $true
    }
    
    # Also check for any other variations that might cause problems
    $patterns = @(
        "alumni-api-i4gs",
        "i4gs.onrender"
    )
    
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            Write-Host "  Found pattern '$pattern' in $($file.Name)" -ForegroundColor Yellow
            
            # Apply different replacements based on pattern
            if ($pattern -eq "alumni-api-i4gs") {
                $content = $content -replace "alumni-api-i4gs", "final-ecri"
            }
            elseif ($pattern -eq "i4gs.onrender") {
                $content = $content -replace "i4gs.onrender", "ecri.onrender"
            }
            
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
        Write-Host "  Updated file: $($file.Name) with $([Math]::Abs($changesMade)) bytes changed" -ForegroundColor Green
    }
}

Write-Host "`nCompleted scanning of compiled JS files. Changed $filesChanged files with $totalChanges total bytes changed." -ForegroundColor Cyan

# Step 7: Provide instructions for further actions
Write-Host "`nInstallation and deployment recommendations:" -ForegroundColor Green
Write-Host "1. Redeploy the frontend with updated files" -ForegroundColor Yellow
Write-Host "   - Upload the updated dist folder to your hosting service" -ForegroundColor White
Write-Host "2. Ensure the backend CORS settings are correct:" -ForegroundColor Yellow
Write-Host "   - The backend should allow requests from: $FRONTEND_URL" -ForegroundColor White
Write-Host "   - The backend should have 'allow_credentials=True' in CORS settings" -ForegroundColor White
Write-Host "   - The backend should not use wildcard '*' when credentials are enabled" -ForegroundColor White
Write-Host "3. Clear browser cache and cookies before testing" -ForegroundColor Yellow
Write-Host "   - This ensures old cached values don't interfere with your changes" -ForegroundColor White

Write-Host "`nCORS fix complete. If issues persist, ensure both frontend and backend were redeployed." -ForegroundColor Cyan
