#!/bin/bash
# Script to prepare the alumni verification system for deployment

echo "Preparing for deployment..."

# Create .env file for backend
cat > backend/.env << EOL
# MongoDB Connection
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority

# JWT Authentication
SECRET_KEY=yoursecretkey
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Feature flags
NOTIFICATIONS_ENABLED=true
BLOCKCHAIN_ENABLED=false

# CORS
CORS_ORIGINS=https://your-frontend-domain.vercel.app,http://localhost:3000
EOL

echo "Created backend/.env template"

# Create .env file for frontend
cat > frontend/.env << EOL
VITE_API_URL=https://your-backend-api.onrender.com/api/v1
VITE_POLLING_INTERVAL=5000
EOL

echo "Created frontend/.env template"

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
  cat > .gitignore << EOL
# Node
node_modules/
npm-debug.log
yarn-error.log
yarn-debug.log
.pnpm-debug.log

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
*.egg-info/
.installed.cfg
*.egg
venv/
.venv/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.idea/
.vscode/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Build directories
/dist/
/build/
/out/

# Logs
logs/
*.log

# Uploads
uploads/
EOL

  echo "Created .gitignore file"
fi

# Create Render build configuration
cat > render.yaml << EOL
services:
  - type: web
    name: alumni-verification-api
    env: python
    buildCommand: pip install -r backend/requirements.txt
    startCommand: cd backend && uvicorn app.main:app --host 0.0.0.0 --port \$PORT
    envVars:
      - key: MONGODB_URI
        sync: false
      - key: SECRET_KEY
        generateValue: true
      - key: JWT_ALGORITHM
        value: HS256
      - key: ACCESS_TOKEN_EXPIRE_MINUTES
        value: 60
      - key: NOTIFICATIONS_ENABLED
        value: true
      - key: BLOCKCHAIN_ENABLED
        value: false
      - key: CORS_ORIGINS
        sync: false
EOL

echo "Created render.yaml configuration"

# Update README with deployment instructions
cat > README.md << EOL
# Alumni Document Verification System

A system for verifying academic documents from alumni using FastAPI (backend) and React (frontend).

## Features

- User authentication for alumni and administrators
- Document upload and verification
- Real-time notifications via polling
- MongoDB database for data storage

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for instructions on how to deploy this application for free.

## Local Development

### Backend

1. Navigate to backend directory:
   \`\`\`
   cd backend
   \`\`\`

2. Install dependencies:
   \`\`\`
   pip install -r requirements.txt
   \`\`\`

3. Start the server:
   \`\`\`
   uvicorn app.main:app --reload
   \`\`\`

### Frontend

1. Navigate to frontend directory:
   \`\`\`
   cd frontend
   \`\`\`

2. Install dependencies:
   \`\`\`
   npm install
   \`\`\`

3. Start the development server:
   \`\`\`
   npm run dev
   \`\`\`

## Testing

After starting both servers, open http://localhost:3000 in your browser.

## Initializing Database

Run the included script to initialize database:
\`\`\`
python backend/init_deployment_db.py --mongodb-uri="your-mongodb-uri"
\`\`\`
EOL

echo "Updated README.md"

echo "Preparation complete! Follow these steps next:"
echo "1. Replace the placeholder values in backend/.env and frontend/.env with your actual deployment values"
echo "2. Commit your changes and push to your repository"
echo "3. Follow the instructions in DEPLOYMENT.md to deploy on Render and Vercel" 