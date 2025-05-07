// Hardcode API URL to avoid environment issues
let baseApiUrl = 'https://alumni-api-klrk.onrender.com';
// Remove trailing slash if present
baseApiUrl = baseApiUrl.endsWith('/') ? baseApiUrl.slice(0, -1) : baseApiUrl;
// Add /api/v1 only if it's not already included
export const API_URL = baseApiUrl.includes('/api/v1') ? baseApiUrl : `${baseApiUrl}/api/v1`; 