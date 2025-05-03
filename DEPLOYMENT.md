# Deployment Guide: Free Testing Environment

This guide explains how to deploy the Alumni Document Verification System for free testing.

## Prerequisites
- GitHub account
- MongoDB Atlas account (free tier)
- Render account (free tier)
- Vercel account (free tier)

## Step 1: Database Setup with MongoDB Atlas

1. Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster:
   - Choose the FREE tier (M0)
   - Select a cloud provider and region closest to your users
   - Name your cluster (e.g., "alumni-verification")
   
3. Set up database access:
   - Create a new database user with password authentication
   - Give this user "Read and Write to any database" privileges
   
4. Configure network access:
   - Add an IP address (for testing, you can allow access from anywhere by adding 0.0.0.0/0)
   
5. Get your connection string:
   - Go to "Clusters" → "Connect" → "Connect your application"
   - Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority`)
   - Replace `<username>`, `<password>`, and `<dbname>` with your values

## Step 2: Backend Deployment with Render

1. Sign up at [Render](https://render.com/)

2. Create a new Web Service:
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repository

3. Configure the web service:
   - Name: `alumni-verification-api`
   - Environment: `Python 3`
   - Region: Choose closest to your users
   - Branch: `main` (or your default branch)
   - Build Command: `pip install -r backend/requirements.txt`
   - Start Command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. Add environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `SECRET_KEY`: Random string for JWT authentication
   - `NOTIFICATIONS_ENABLED`: `true`
   - `JWT_ALGORITHM`: `HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: `60`
   - `CORS_ORIGINS`: Add your Vercel frontend URL (after deploying frontend)

5. Click "Create Web Service"

6. Wait for deployment to complete (may take a few minutes)

7. Note your API URL (e.g., `https://alumni-verification-api.onrender.com`)

## Step 3: Frontend Deployment with Vercel

1. Sign up at [Vercel](https://vercel.com/)

2. Import your GitHub repository:
   - Click "Add New" → "Project"
   - Select your repository
   
3. Configure project:
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   
4. Add environment variables:
   - `VITE_API_URL`: Your Render backend URL (e.g., `https://alumni-verification-api.onrender.com/api/v1`)
   - `VITE_POLLING_INTERVAL`: `5000` (or your preferred polling interval in ms)
   
5. Click "Deploy"

6. Wait for deployment to complete

7. Note your frontend URL (e.g., `https://alumni-verification.vercel.app`)

## Step 4: Update CORS Settings

1. Go back to your Render dashboard

2. Update the `CORS_ORIGINS` environment variable to include your Vercel frontend URL:
   - E.g., `https://alumni-verification.vercel.app,http://localhost:3000`

3. Redeploy your backend service

## Step 5: Initial Database Setup

After deployment, you'll need to create an admin user. You can do this by:

1. Create a new file `create_admin.js` locally:

```javascript
// Run this in your local Node.js environment after deployment
const fetch = require('node-fetch');

const API_URL = 'https://your-backend-url.onrender.com/api/v1';

async function createAdmin() {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'adminpassword123',
        full_name: 'System Administrator',
        is_admin: true
      }),
    });
    
    const data = await response.json();
    console.log('Admin created:', data);
  } catch (error) {
    console.error('Error creating admin:', error);
  }
}

createAdmin();
```

2. Run this script with Node.js:
   ```
   npm install node-fetch
   node create_admin.js
   ```

## Testing Your Deployment

1. Visit your Vercel frontend URL
2. Log in with your admin credentials
3. Create a test alumni account 
4. Submit a document request
5. Verify that notifications work correctly

## Limitations of Free Tier

- Render free tier will spin down after inactivity
- MongoDB Atlas free tier has storage limitations (512MB)
- Performance may be slower than production environments

## Upgrading to Production

When ready for production:
- Upgrade to paid Render plan
- Consider using Docker containers
- Implement secure authentication
- Set up automated backups
- Add monitoring and alerts 