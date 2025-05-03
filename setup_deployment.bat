@echo off
REM Script to prepare the alumni verification system for deployment

echo Preparing for deployment...

REM Create .env file for backend
echo # MongoDB Connection > backend\.env
echo MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority >> backend\.env
echo. >> backend\.env
echo # JWT Authentication >> backend\.env
echo SECRET_KEY=yoursecretkey >> backend\.env
echo JWT_ALGORITHM=HS256 >> backend\.env
echo ACCESS_TOKEN_EXPIRE_MINUTES=60 >> backend\.env
echo. >> backend\.env
echo # Feature flags >> backend\.env
echo NOTIFICATIONS_ENABLED=true >> backend\.env
echo BLOCKCHAIN_ENABLED=false >> backend\.env
echo. >> backend\.env
echo # CORS >> backend\.env
echo CORS_ORIGINS=https://your-frontend-domain.vercel.app,http://localhost:3000 >> backend\.env

echo Created backend\.env template

REM Create .env file for frontend
echo VITE_API_URL=https://your-backend-api.onrender.com/api/v1 > frontend\.env
echo VITE_POLLING_INTERVAL=5000 >> frontend\.env

echo Created frontend\.env template

REM Create Render build configuration
echo services: > render.yaml
echo   - type: web >> render.yaml
echo     name: alumni-verification-api >> render.yaml
echo     env: python >> render.yaml
echo     buildCommand: pip install -r backend/requirements.txt >> render.yaml
echo     startCommand: cd backend ^&^& uvicorn app.main:app --host 0.0.0.0 --port $PORT >> render.yaml
echo     envVars: >> render.yaml
echo       - key: MONGODB_URI >> render.yaml
echo         sync: false >> render.yaml
echo       - key: SECRET_KEY >> render.yaml
echo         generateValue: true >> render.yaml
echo       - key: JWT_ALGORITHM >> render.yaml
echo         value: HS256 >> render.yaml
echo       - key: ACCESS_TOKEN_EXPIRE_MINUTES >> render.yaml
echo         value: 60 >> render.yaml
echo       - key: NOTIFICATIONS_ENABLED >> render.yaml
echo         value: true >> render.yaml
echo       - key: BLOCKCHAIN_ENABLED >> render.yaml
echo         value: false >> render.yaml
echo       - key: CORS_ORIGINS >> render.yaml
echo         sync: false >> render.yaml

echo Created render.yaml configuration

echo Preparation complete! Follow these steps next:
echo 1. Replace the placeholder values in backend\.env and frontend\.env with your actual deployment values
echo 2. Commit your changes and push to your repository
echo 3. Follow the instructions in DEPLOYMENT.md to deploy on Render and Vercel 