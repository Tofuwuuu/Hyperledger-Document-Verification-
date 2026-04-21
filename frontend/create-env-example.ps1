# Create .env.example file for frontend
$envContent = @"
# API Connection
VITE_API_URL=http://127.0.0.1:8000/api/v1

# Features
VITE_POLLING_INTERVAL=5000
VITE_ENABLE_BLOCKCHAIN=false
VITE_ENABLE_WEBSOCKETS=false
VITE_ENABLE_ADMIN_TOOLS=true

# Authentication
VITE_JWT_EXPIRE_DAYS=7
VITE_REFRESH_TOKEN_DAYS=30

# External Services
VITE_JITSI_SERVER=meet.jit.si
VITE_JITSI_ROOM_PREFIX=cvsu_alumni_
"@

# Output to .env.example file
$envContent | Out-File -FilePath ".env.example" -Encoding utf8
Write-Host ".env.example file created successfully"

# Also create .env.local with the same content
$envContent | Out-File -FilePath ".env.local" -Encoding utf8
Write-Host ".env.local file created successfully (contains same defaults as example)" 
