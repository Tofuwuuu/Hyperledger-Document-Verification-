// Use environment variable with fallback
const isDevelopment = import.meta.env.MODE === 'development';
// For development, use the direct URL to the backend
let baseApiUrl = isDevelopment 
  ? 'http://localhost:8000/api/v1' // Direct URL to backend in development
  : (import.meta.env.VITE_API_URL || 'https://final-ecri.onrender.com');

// Remove trailing slash if present
baseApiUrl = baseApiUrl.endsWith('/') ? baseApiUrl.slice(0, -1) : baseApiUrl;
// Add /api/v1 only if it's not already included and we're not in development mode
export const API_URL = isDevelopment 
  ? baseApiUrl 
  : (baseApiUrl.includes('/api/v1') ? baseApiUrl : `${baseApiUrl}/api/v1`); 
