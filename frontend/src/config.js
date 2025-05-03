// Parse API URL to avoid path duplication
let baseApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// Remove trailing slash if present
baseApiUrl = baseApiUrl.endsWith('/') ? baseApiUrl.slice(0, -1) : baseApiUrl;
// Add /api/v1 only if it's not already included
export const API_URL = baseApiUrl.includes('/api/v1') ? baseApiUrl : `${baseApiUrl}/api/v1`; 