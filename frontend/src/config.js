// Parse API URL to avoid path duplication
// For development with Vite proxy
let baseApiUrl = '';  // Empty base means it will use the same origin (the Vite dev server)

// For production or explicit configuration
if (import.meta.env.PROD || import.meta.env.VITE_API_URL) {
  baseApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  // Remove trailing slash if present
  baseApiUrl = baseApiUrl.endsWith('/') ? baseApiUrl.slice(0, -1) : baseApiUrl;
}

// API URL configuration - matching the FastAPI API_PREFIX in backend settings
// This handles cases where we're running directly on port 8000 vs through the Vite dev server
export const API_URL = '/api/v1';  // Simplified to always use the proxy

// Other configuration options
export const DEFAULT_TIMEOUT = 10000; // 10 seconds
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

// App version
export const APP_VERSION = '1.0.0'; 