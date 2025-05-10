#!/bin/bash

# MongoDB Settings
export MONGODB_URL="mongodb+srv://your_mongodb_atlas_url_here"
export MONGODB_DB="cvsu_alumni"

# CORS Settings
export CORS_ORIGINS="https://alumni-frontend-zzr2.onrender.com"

# API Settings
export API_V1_STR="/api/v1"

# JWT Settings
export SECRET_KEY="your_secure_secret_key_here"
export ALGORITHM="HS256"
export ACCESS_TOKEN_EXPIRE_MINUTES="1440"
export REFRESH_TOKEN_EXPIRE_DAYS="7"

# Frontend URL
export FRONTEND_URL="https://alumni-frontend-zzr2.onrender.com"

# Development Settings
export ALLOW_MOCK_DB="false"

# Print current settings
echo "Current environment variables:"
echo "MONGODB_URL: $MONGODB_URL"
echo "MONGODB_DB: $MONGODB_DB"
echo "CORS_ORIGINS: $CORS_ORIGINS"
echo "FRONTEND_URL: $FRONTEND_URL"
echo "API_V1_STR: $API_V1_STR" 