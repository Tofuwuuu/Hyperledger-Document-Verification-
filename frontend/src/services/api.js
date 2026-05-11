import axios from 'axios';
import { 
  validateToken, 
  getAuthTokens, 
  storeAuthTokens, 
  clearAuthTokens,
  isRememberedSession 
} from '../utils/authUtils';
import { API_ORIGIN, API_URL as CONFIG_API_URL } from '../config';
import { prepareProfileData } from '../utils/profile-helpers';

// Single source of truth (see `src/config.js`)
export const API_URL = CONFIG_API_URL;
console.log('API URL configured as:', API_URL); // Debug API URL

// Hard safety: never allow remote APIs in this localhost-only setup.
if (!API_URL.startsWith(`${API_ORIGIN}/`)) {
  throw new Error(`API_URL must stay on the local API origin. Got: ${API_URL}`);
}

// Flag to prevent multiple refresh token requests
let isRefreshing = false;
let failedQueue = [];

// Process the queue of failed requests after token refresh
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,  // Important for CORS with credentials
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'  // Help prevent CSRF attacks
  }
});

// Add request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    // Ensure withCredentials is always set for cross-origin requests
    config.withCredentials = true;
    
    // Debug current request in development
    if (import.meta.env.MODE === 'development') {
      console.log(`🚀 API Request [${config.method?.toUpperCase()}] ${config.url}`, { 
        headers: config.headers, 
        data: config.data,
        withCredentials: config.withCredentials
      });
    }

    // Add auth header if token exists
    const token = localStorage.getItem('token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    // Debug response in development
    if (import.meta.env.MODE === 'development') {
      console.log(`✅ API Response [${response.status}] ${response.config.url}`, { 
        headers: response.headers,
        data: response.data
      });
    }
    
    // Check for CSRF token in response headers and store it
    const csrfToken = response.headers['x-csrf-token'];
    if (csrfToken) {
      localStorage.setItem('csrf_token', csrfToken);
      console.log('CSRF token stored from response headers');
    }
    
    return response;
  },
  async (error) => {
    // Debug error in development
    if (import.meta.env.MODE === 'development') {
      console.error(`❌ API Error [${error.response?.status || 'Network Error'}]`, { 
        message: error.message,
        response: error.response,
        config: error.config
      });
    }

    if (error.response) {
      // Handle CORS errors more gracefully
      const statusCode = error.response.status;
      const requestUrl = error.config.url;
      
      // If we get a 401, check if the token is expired
      if (statusCode === 401) {
        // Handle token expiration (add refresh token logic if needed)
        console.log('Authentication error - check token validity');
      }

      // Add more specific error details
      error.isNetworkError = false;
      error.statusCode = statusCode;
      error.isAuthError = statusCode === 401;
      error.isForbidden = statusCode === 403;
      error.isServerError = statusCode >= 500;
    } else if (error.request) {
      // Network error - no response received
      console.error('Network error - no response received');
      error.isNetworkError = true;
      error.message = 'Unable to connect to the server. Please check your internet connection.';
    }

    return Promise.reject(error);
  }
);

// Generic API methods
export const apiService = {
  // Wrap api functions with more descriptive error handling
  get: async (url, config = {}) => {
    try {
      return await api.get(url, config);
    } catch (error) {
      // Transform the error for better user experience
      handleApiError(error, 'GET', url);
      throw error;
    }
  },
  post: async (url, data, config = {}) => {
    try {
      return await api.post(url, data, config);
    } catch (error) {
      handleApiError(error, 'POST', url);
      throw error;
    }
  },
  put: async (url, data, config = {}) => {
    try {
      return await api.put(url, data, config);
    } catch (error) {
      handleApiError(error, 'PUT', url);
      throw error;
    }
  },
  delete: async (url, config = {}) => {
    try {
      return await api.delete(url, config);
    } catch (error) {
      handleApiError(error, 'DELETE', url);
      throw error;
    }
  },
  // Specific method for CORS-sensitive endpoints
  withCORS: async (method, url, data = null, config = {}) => {
    console.log(`apiService.withCORS: ${method.toUpperCase()} ${url}`);
    
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    console.log('Full URL:', fullUrl);
    
    // Ensure we have headers
    if (!config.headers) {
      config.headers = {};
    }
    
    // Ensure we're using the token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add CSRF token if available
    const csrfToken = localStorage.getItem('csrf_token');
    if (csrfToken && !config.headers['X-CSRF-Token']) {
      config.headers['X-CSRF-Token'] = csrfToken;
      console.log('Added CSRF token to request');
    }
    
    // Create a merged config with specific CORS settings
    const mergedConfig = {
      ...config,
      timeout: config.timeout || 15000, // Default timeout of 15 seconds
      withCredentials: true,
      headers: {
        ...(config.headers || {}),
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    
    // Add the signal if provided
    if (config.signal) {
      mergedConfig.signal = config.signal;
      console.log('Using abort signal for request');
    }
    
    // Try the request with retries
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        let response;
        if (method.toLowerCase() === 'get') {
          response = await api.get(url, mergedConfig);
        } else if (method.toLowerCase() === 'post') {
          response = await api.post(url, data, mergedConfig);
        } else if (method.toLowerCase() === 'put') {
          response = await api.put(url, data, mergedConfig);
        } else if (method.toLowerCase() === 'delete') {
          response = await api.delete(url, mergedConfig);
        } else {
          throw new Error(`Unsupported method: ${method}`);
        }
        
        console.log(`API response (${response.status}):`, response.data);
        return response;
      } catch (error) {
        console.error(`API error (attempt ${retries + 1}/${maxRetries + 1}):`, error);
        
        // Check for abort error
        if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
          console.error('Request aborted or timed out');
          error.isTimeout = true;
          throw error; // Don't retry timeouts or aborted requests
        }
        
        // Check for CSRF errors specifically
        const isCsrfError = error.response?.data?.detail?.includes('CSRF token');
        if (isCsrfError && retries < maxRetries) {
          console.warn('CSRF error detected, will try to get a new token...');
          
          try {
            const tokenResponse = await api.get('/auth/csrf-token');
            if (tokenResponse.data && tokenResponse.data.csrf_token) {
              console.log('Successfully got new CSRF token');
              // Update config with new token
              mergedConfig.headers['X-CSRF-Token'] = tokenResponse.data.csrf_token;
              retries++;
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }
          } catch (tokenError) {
            console.error('Failed to get new CSRF token:', tokenError);
          }
        }
        
        // Check for CORS errors specifically
        const isCORSError = error.message && (
          error.message.includes('CORS') || 
          (error.response && error.response.status === 0)
        );
        
        if (isCORSError && retries < maxRetries) {
          console.warn(`CORS error detected, retrying (${retries + 1}/${maxRetries})...`);
          retries++;
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        throw error;
      }
    }
  }
};

// Helper function for consistent error handling
function handleApiError(error, method, url, isCORSRequest = false) {
  if (error.isNetworkError) {
    console.error(`Network error detected in API call: ${error.message}`);
  } else if (error.response) {
    console.error(`API ${method} ${url} failed with status ${error.response.status}:`, 
      error.response.data);
      
    // Log additional information for CORS errors
    if (isCORSRequest && !error.response.headers['access-control-allow-origin']) {
      console.error('Possible CORS error - missing Access-Control-Allow-Origin header');
    }
  } else {
    console.error(`API ${method} ${url} failed:`, error.message);
  }
}

// Authentication services
export const authService = {
  reloadUserWithFreshData: async () => {
    console.log("Performing complete user data reload...");
    
    // Clear all caches related to user data
    localStorage.removeItem('user_verification');
    
    // Get the token
    const { accessToken } = getAuthTokens();
    
    if (!accessToken) {
      console.log("No authentication token found");
      return null;
    }
    
    // Special case: Handle admin, alumni, or test domain bypass tokens
    if (accessToken.startsWith('admin_access_token_') || 
        accessToken.startsWith('alumni_access_token_')) {
      console.log("Using bypass token - returning cached data with verification flag set");
      
      // For bypass tokens, use the stored user data
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Make sure is_verified is set to true for bypass tokens
      if (userData && userData.email) {
        if (!userData.is_verified) {
          userData.is_verified = true;
          localStorage.setItem('user', JSON.stringify(userData));
          console.log("Updated user data with is_verified flag");
        }
        return userData;
      } else {
        console.error("No valid user data found in localStorage for bypass token");
        return null;
      }
    }
    
    try {
      // Add cache-busting parameter
      const timestamp = new Date().getTime();
      
      // Use the api instance with proper headers
      const response = await api.get(`/auth/me?t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      // Update local storage with fresh data
      const userData = response.data;
      localStorage.setItem('user', JSON.stringify(userData));
      console.log("User data reloaded successfully:", userData);
      
      return userData;
    } catch (error) {
      return handleApiError(error, 'reloadUserWithFreshData');
    }
  },
  
  getCsrfToken: async () => {
    try {
      const response = await api.get('/auth/csrf-token');
      if (response.data && response.data.csrf_token) {
        // Store the CSRF token for later use
        localStorage.setItem('csrf_token', response.data.csrf_token);
        return response.data.csrf_token;
      }
      return null;
    } catch (error) {
      console.error('Error getting CSRF token:', error);
      // Don't throw here as this is a non-critical operation
      return null;
    }
  },
  
  login: async (credentials) => {
    try {
      // Extract remember flag if present
      const { remember } = credentials;
      const payload = {
        email: credentials.email,
        password: credentials.password,
        remember: remember !== undefined ? remember : false
      };
      
      const loginUrl = `${API_URL}/auth/login`;
      
      console.log('[LOGIN] Using login URL:', loginUrl);
      console.log('[LOGIN] Payload:', {
        email: credentials.email,
        password: '***REDACTED***',
        remember: remember !== undefined ? remember : false
      });
      
      // Make the login request with JSON payload for simple auth mode.
      const loginResponse = await axios.post(loginUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log('[LOGIN] Response status:', loginResponse.status);
      console.log('[LOGIN] Response data:', loginResponse.data);
      
      if (loginResponse.data?.success && loginResponse.data?.user) {
        // Simple local auth state (no JWT in this mode).
        localStorage.setItem('user', JSON.stringify(loginResponse.data.user));
        localStorage.setItem('simple_auth', 'true');
        localStorage.removeItem('token');
        return loginResponse.data;
      } else {
        throw new Error('Login failed: invalid response payload');
      }
    } catch (error) {
      // Preserve the original error details, including headers and response data
      const enhancedError = new Error(error.response?.data?.detail || error.message || 'Login failed');
      enhancedError.originalError = error;
      enhancedError.response = error.response;
      enhancedError.status = error.response?.status;
      enhancedError.headers = error.response?.headers;
      
      console.error('[LOGIN] Error message:', enhancedError.message);
      console.error('[LOGIN] Error status:', enhancedError.status);
      console.error('[LOGIN] Error response data:', error.response?.data);
      throw enhancedError; // Throw the enhanced error to be caught by the LoginPage
    }
  },
  
  register: async (userData) => {
    try {
      console.log('Registration attempt with data:', userData);
      
      const registerUrl = `${API_URL}/auth/register`;
      
      console.log('Sending registration request to:', registerUrl);
      
      // Use direct axios instance to avoid interceptor issues
      const response = await axios({
        method: 'post',
        url: registerUrl,
        data: userData,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log('Registration response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Registration request failed:', error.message);
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      } else if (error.request) {
        // Request was made but no response received
        console.error('No response received:', error.request);
        
        // For CORS and network errors, provide a more useful message
        if (error.message.includes('Network Error')) {
          error.corsError = true;
          console.error('CORS or network error detected. Consider using a testing email (@google.com or @test.com) to bypass backend registration.');
        }
      }
      throw error;
    }
  },
  
  refreshToken: async () => {
    const { refreshToken } = getAuthTokens();
    if (!refreshToken) {
      return Promise.reject('No refresh token available');
    }
    
    try {
      // Ensure URL format is correct
      const apiUrlBase = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
      const refreshUrl = `${apiUrlBase}/auth/refresh`;
      
      const response = await axios.post(refreshUrl);
      
      if (response.data.access_token) {
        // Store the refreshed tokens
        storeAuthTokens(
          {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token
          },
          isRememberedSession()
        );
      }
      
      return response.data;
    } catch (error) {
      return handleApiError(error, 'refreshToken');
    }
  },
  
  logout: async () => {
    try {
      // Call logout endpoint to clear cookies
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local storage regardless of API success/failure
      clearAuthTokens();
    }
  },
  
  getCurrentUser: async () => {
    const { accessToken } = getAuthTokens();
    
    if (!accessToken) {
      return null;
    }
    
    // Special case: Handle admin or alumni bypass tokens that should use localStorage data instead of API calls
    if (accessToken.startsWith('admin_access_token_') || 
        accessToken.startsWith('alumni_access_token_')) {
      console.log("getCurrentUser: Using bypass token - returning local data");
      
      // For bypass tokens, just return the stored user data
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      if (userData && userData.email) {
        // Make sure is_verified flag is set
        if (!userData.is_verified) {
          userData.is_verified = true;
          localStorage.setItem('user', JSON.stringify(userData));
        }
        return userData;
      } else {
        console.error("No valid user data found in localStorage for bypass token");
        return null;
      }
    }
    
    // For regular tokens, make the API call
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      return handleApiError(error, 'getCurrentUser');
    }
  },

  checkAuth: async () => {
    try {
      // Check if we're using bypass tokens
      const { accessToken } = getAuthTokens();
      
      // Admin bypass
      if (accessToken && accessToken.startsWith('admin_access_token_')) {
        console.log('Using admin bypass token - returning mock auth check');
        // Get stored user data
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Make sure admin user has is_verified=true
        if (user && user.email && !user.is_verified) {
          user.is_verified = true;
          localStorage.setItem('user', JSON.stringify(user));
          console.log('Updated admin user data with is_verified flag');
        }
        
        return { isAuthenticated: true, user };
      }
      
      // Alumni bypass
      if (accessToken && accessToken.startsWith('alumni_access_token_')) {
        console.log('Using alumni bypass token - returning mock auth check');
        // Get stored user data
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Make sure alumni user has is_verified=true
        if (user && user.email && !user.is_verified) {
          user.is_verified = true;
          localStorage.setItem('user', JSON.stringify(user));
          console.log('Updated alumni user data with is_verified flag');
        }
        
        return { isAuthenticated: true, user };
      }
      
      // Regular auth check
      const response = await api.get('/auth/me');
      return { isAuthenticated: true, user: response.data };
    } catch (error) {
      if (error.status === 401) {
        // Clear tokens on unauthorized
        clearAuthTokens();
      }
      return { isAuthenticated: false, user: null };
    }
  },

  // MFA methods
  getMFAStatus: async () => {
    try {
      const response = await api.get('/auth/mfa/status');
      return response.data;
    } catch (error) {
      return handleApiError(error, 'getMFAStatus');
    }
  },
  
  setupMFA: async (type = 'email') => {
    try {
      const response = await api.post('/auth/mfa/setup', { type });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'setupMFA');
    }
  },
  
  enableMFA: async (verificationCode) => {
    try {
      const response = await api.post('/auth/mfa/enable', { verification_code: verificationCode });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'enableMFA');
    }
  },
  
  disableMFA: async () => {
    try {
      const response = await api.post('/auth/mfa/disable');
      return response.data;
    } catch (error) {
      return handleApiError(error, 'disableMFA');
    }
  },
  
  // Security questions
  setSecurityQuestions: async (questionsData) => {
    try {
      const response = await api.post('/auth/set-security-questions', questionsData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'setSecurityQuestions');
    }
  },
  
  getSecurityQuestions: async (email) => {
    try {
      const response = await api.get(`/auth/security-questions/${email}`);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'getSecurityQuestions');
    }
  },
  
  verifySecurityQuestions: async (data) => {
    try {
      const response = await api.post('/auth/verify-security-questions', data);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'verifySecurityQuestions');
    }
  },
};

// Alumni services
export const alumniService = {
  // Existing methods...
  
  // Reliable methods using simplified endpoints
  createProfileReliable: async (profileData) => {
    try {
      // Normalize profile data and attach user_id before saving
      const preparedData = await prepareProfileData(profileData);
      
      console.log('Creating alumni profile using reliable endpoint with data:', preparedData);
      const response = await api.post('/alumni/simple', preparedData);
      
      if (response.data.success) {
        console.log('Successfully created alumni profile with ID:', response.data.id);
        return response;
          } else {
        console.error('Server reported error in profile creation:', response.data.message);
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.error('Error creating alumni profile (reliable endpoint):', error.message);
      throw error;
    }
  },
  
  updateProfileReliable: async (profileData) => {
    try {
      // Define alumniId outside the try block so it's available in the catch block
      const alumniId = profileData.id;
      
      // Check if alumni ID is valid
      if (!alumniId || alumniId === 'undefined') {
        console.error('Invalid or missing alumni ID:', alumniId);
        throw new Error('Alumni ID is undefined or invalid. Cannot update profile.');
      }
      
      console.log(`Updating alumni profile using reliable endpoint ${alumniId}`, {
        data: profileData
      });
      
      const response = await api.put(`/alumni/${alumniId}/simple`, profileData);
      
      if (response.data.success) {
        console.log('Successfully updated alumni profile');
        return {
          data: {
            ...profileData,
            _id: alumniId
          }
        };
      } else {
        console.error('Server reported error in profile update:', response.data.message);
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.error('Error updating alumni profile (reliable endpoint):', error.message);
      throw error;
    }
  },
  
  createProfile: async (profileData) => {
    try {
      // Normalize profile data and attach user_id before saving
      const preparedData = await prepareProfileData(profileData);
      
      console.log('Creating alumni profile with data:', preparedData);
      
      // Check if profile already exists
      try {
        const existingProfile = await alumniService.getAlumniByUserId(preparedData.user_id);
        if (existingProfile && existingProfile.data && existingProfile.status !== 404) {
          console.warn('Alumni profile already exists for this user. Updating existing profile instead.');
          
          // Use the existing profile ID and update it instead
          return alumniService.updateProfile({
            ...preparedData,
            id: existingProfile.data._id
          });
        }
      } catch (existingProfileError) {
        // If there's an error checking for an existing profile, just continue with create
        console.log('Unable to check for existing profile:', existingProfileError.message);
      }
      
      // Try reliable endpoint first
      try {
        const reliableResponse = await alumniService.createProfileReliable(preparedData);
        console.log('Successfully created profile using reliable endpoint');
        return reliableResponse;
      } catch (reliableError) {
        // Check if the error is "profile already exists"
        if (reliableError.message && reliableError.message.includes('already exists')) {
          console.warn('Profile already exists error from reliable endpoint. Trying to get and update profile instead.');
          
          // Try to get the existing profile and update it
          try {
            const existingProfile = await alumniService.getAlumniByUserId(preparedData.user_id);
            if (existingProfile && existingProfile.data) {
              return alumniService.updateProfile({
                ...preparedData,
                id: existingProfile.data._id
              });
            }
          } catch (getProfileError) {
            console.error('Failed to get existing profile:', getProfileError.message);
          }
        }
        
        console.warn('Reliable endpoint failed, falling back to standard endpoint:', reliableError.message);
        // Fall back to standard endpoint
      }
      
      // Standard endpoint as fallback
      try {
        const response = await api.post('/alumni', preparedData);
        console.log('Profile created successfully using standard endpoint');
        return response;
      } catch (standardError) {
        // If standard endpoint fails with 405, try again with the simplified endpoint
        if (standardError.response && standardError.response.status === 405) {
          console.warn('Standard endpoint returned 405, trying simplified endpoint as last resort');
          return alumniService.createProfileReliable(preparedData);
        }
        throw standardError;
      }
    } catch (error) {
      console.error('Error creating alumni profile:', error.message);
      throw error;
    }
  },
  
  updateProfile: async (profileData) => {
    try {
      // Try reliable endpoint first
      try {
        const reliableResponse = await alumniService.updateProfileReliable(profileData);
        console.log('Successfully updated profile using reliable endpoint');
        return reliableResponse;
      } catch (reliableError) {
        console.warn('Reliable endpoint failed, falling back to standard endpoint:', reliableError.message);
        // Fall back to standard endpoint
      }
      
    // Define alumniId outside the try block so it's available in the catch block
    const alumniId = profileData.id;
    
      // Standard endpoint as fallback
      // Check if alumni ID is valid
      if (!alumniId || alumniId === 'undefined') {
        console.error('Invalid or missing alumni ID:', alumniId);
        throw new Error('Alumni ID is undefined or invalid. Cannot update profile.');
      }
      
      console.log(`Updating alumni profile ${alumniId}`, {
        data: profileData
      });
      
      // Standard endpoint
      const response = await api.put(`/alumni/${alumniId}`, profileData);
      console.log('Profile updated successfully using standard endpoint');
      return response;
    } catch (error) {
      console.error('Error updating alumni profile:', error.message);
      throw error;
    }
  },
  
  getProfile: async (alumniId) => {
    try {
      console.log(`Fetching alumni profile with ID: ${alumniId}`);
      return api.get(`/alumni/${alumniId}`);
    } catch (error) {
      console.error(`Error fetching alumni profile ${alumniId}:`, error);
      throw error;
    }
  },
  
  getAlumniByUserId: async (userId) => {
    try {
      console.log(`Fetching alumni profile for user ID: ${userId}`);
      
      // Try using withCORS method which has better CORS handling
      try {
        const response = await apiService.withCORS('get', `/alumni/user/${userId}`);
        return response;
      } catch (corsError) {
        console.warn('Error with CORS-enabled request:', corsError);
        
        // Fall back to direct API call
        try {
          return await api.get(`/alumni/user/${userId}`);
        } catch (directError) {
          console.error(`Error fetching alumni profile with direct call:`, directError);
          
          // If we get a 404, return a structured error that can be caught
          if (directError.response && directError.response.status === 404) {
            return {
              status: 404,
              statusText: 'Not Found',
              data: null
            };
          }
          
          throw directError;
        }
      }
    } catch (error) {
      console.error(`Error fetching alumni profile for user ${userId}:`, error);
      
      // Don't throw if we have a 404 - this is not unexpected when creating a new profile
      if (error.response && error.response.status === 404) {
        return {
          status: 404,
          statusText: 'Not Found',
          data: null
        };
      }
      
      throw error;
    }
  },
  
  uploadProfilePicture: async (alumniId, file) => {
    try {
      console.log(`Uploading profile picture for alumni ${alumniId}`);
      
      const formData = new FormData();
      formData.append('profile_picture', file);
      
      // Use direct axios instance for better debugging
      const response = await axios({
        method: 'post',
        url: `${API_URL}/alumni/${alumniId}/profile-picture`,
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        timeout: 30000 // 30 second timeout for file uploads
      });
      
      console.log('Profile picture upload response:', response.data);
      return response;
    } catch (error) {
      console.error(`Error uploading profile picture for ${alumniId}:`, error.message);
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      } else if (error.request) {
        console.error('No response received:', error.request);
      }
      throw error;
    }
  },
  
  getAllAlumni: async (params = {}) => {
    try {
      console.log('Fetching alumni list with params:', params);
      // Use the simplified endpoint by default since it's more reliable
      try {
        console.log('Using simplified alumni/list endpoint directly');
        const simplifiedResponse = await api.get('/alumni/list', { params });
        console.log('Simplified alumni endpoint succeeded');
        return simplifiedResponse;
      } catch (listError) {
        console.error('Simplified alumni endpoint failed:', listError);
        
        // Try the main endpoint as a fallback
        console.log('Trying main alumni endpoint as fallback');
        const mainResponse = await api.get('/alumni', { params });
        console.log('Main alumni endpoint succeeded');
        return mainResponse;
      }
    } catch (error) {
      console.error('Error fetching alumni list (all attempts failed):', error);
      
      // Return empty results if both endpoints fail
      return {
        data: {
          results: [],
          total: 0,
          limit: params.limit || 10,
          offset: params.offset || 0
        }
      };
    }
  },
};

// Document services
export const documentService = {
  uploadDocument: async (data) => {
    const formData = new FormData();
    formData.append('alumni_id', data.alumni_id);
    formData.append('document_type', data.document_type);
    formData.append('title', data.title);
    
    if (data.description) {
      formData.append('description', data.description);
    }
    
    formData.append('file', data.file);
    
    return api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  getAlumniDocuments: async (alumniId) => {
    return api.get(`/documents/alumni/${alumniId}`);
  },
  
  getDocument: async (documentId) => {
    return api.get(`/documents/${documentId}`);
  },
  
  deleteDocument: async (documentId) => {
    return api.delete(`/documents/${documentId}`);
  },
  
  getAllPendingDocuments: async () => {
    return api.get('/documents/pending/all');
  },
};

// Verification services
export const verificationService = {
  verifyDocument: async (documentId, hash) => {
    return api.post('/verification/blockchain/verify', {
      document_id: documentId,
      hash: hash
    });
  },
  
  storeDocument: async (documentId, hash, metadata = {}) => {
    return api.post('/verification/blockchain/store', {
      document_id: documentId,
      hash: hash,
      metadata: metadata
    });
  },
  
  rejectDocument: async (documentId, reason) => {
    // Note: This endpoint may need to be implemented in your backend
    return api.post(`/documents/${documentId}/reject`, { reason });
  },
  
  getDocumentHistory: async (documentId) => {
    return api.get(`/verification/blockchain/history/${documentId}`);
  },
  
  verifyByFile: async (documentId, file) => {
    const formData = new FormData();
    if (documentId) {
      formData.append('document_id', documentId);
    }
    formData.append('file', file);
    
    return api.post('/verification/blockchain/verify-file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
};

// Admin user management services
export const adminUserService = {
  getAllAdminUsers: async (page = 1, limit = 10, signal) => {
    try {
      return await api.get('/admin/users', { 
        params: { page, limit },
        timeout: 30000, // Increase timeout to 30 seconds
        signal
      });
    } catch (error) {
      // Don't log or throw error if request was intentionally aborted
      if (error.name === 'CanceledError' || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        console.log('Request was canceled or aborted');
        return { data: { items: [], meta: { total: 0, totalPages: 0 } } };
      }
      
      console.error('Error fetching admin users:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch admin users');
    }
  },

  getPendingVerificationUsers: async (signal, status = 'pending') => {
    try {
      return await api.get('/admin/users/pending-verification', {
        params: { status },
        timeout: 30000,
        signal
      });
    } catch (error) {
      if (error.name === 'CanceledError' || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return { data: [] };
      }

      console.error('Error fetching pending verification users:', error);
      throw new Error(error.response?.data?.detail || 'Failed to fetch pending verification users');
    }
  },

  verifyPendingUser: async (userId, adminNotes = '') => {
    try {
      return await api.post(`/admin/users/${userId}/verify`, {
        admin_notes: adminNotes || null
      }, { timeout: 10000 });
    } catch (error) {
      console.error(`Error verifying user ${userId}:`, error);
      throw new Error(error.response?.data?.detail || 'Failed to verify user');
    }
  },

  rejectPendingUser: async (userId, adminNotes = '') => {
    try {
      return await api.post(`/admin/users/${userId}/reject`, {
        admin_notes: adminNotes || null
      }, { timeout: 10000 });
    } catch (error) {
      console.error(`Error rejecting user ${userId}:`, error);
      throw new Error(error.response?.data?.detail || 'Failed to reject user');
    }
  },
  
  getAdminUser: async (userId) => {
    try {
      return await api.get(`/admin/users/${userId}`, { timeout: 10000 });
    } catch (error) {
      console.error(`Error fetching admin user ${userId}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to fetch admin user');
    }
  },
  
  createAdminUser: async (userData) => {
    try {
      return await api.post('/admin/users', userData, { timeout: 10000 });
    } catch (error) {
      console.error('Error creating admin user:', error);
      // Include response data in error for better error handling
      if (error.response) {
        console.error('Error response data:', error.response.data);
        
        // Ensure we're not passing complex objects as error messages
        if (error.response.data && typeof error.response.data.detail === 'object') {
          // Clone the error to avoid modifying the original axios error
          const enhancedError = new Error(
            error.response.status === 422 
              ? 'Validation failed. Please check the form fields.' 
              : 'Failed to create admin user'
          );
          enhancedError.response = error.response;
          enhancedError.status = error.response.status;
          enhancedError.responseData = error.response.data;
          throw enhancedError;
        }
      }
      throw error;
    }
  },
  
  updateAdminUser: async (userId, userData) => {
    try {
      return await api.put(`/admin/users/${userId}`, userData, { timeout: 10000 });
    } catch (error) {
      console.error(`Error updating admin user ${userId}:`, error);
      // Include response data in error for better error handling
      if (error.response) {
        console.error('Error response data:', error.response.data);
        
        // Ensure we're not passing complex objects as error messages
        if (error.response.data && typeof error.response.data.detail === 'object') {
          // Clone the error to avoid modifying the original axios error
          const enhancedError = new Error(
            error.response.status === 422 
              ? 'Validation failed. Please check the form fields.' 
              : `Failed to update admin user ${userId}`
          );
          enhancedError.response = error.response;
          enhancedError.status = error.response.status;
          enhancedError.responseData = error.response.data;
          throw enhancedError;
        }
      }
      throw error;
    }
  },
  
  deleteAdminUser: async (userId) => {
    try {
      return await api.delete(`/admin/users/${userId}`, { timeout: 10000 });
    } catch (error) {
      console.error(`Error deleting admin user ${userId}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to delete admin user');
    }
  },
  
  updateUserRole: async (userId, roleData) => {
    try {
      return await api.put(`/admin/users/${userId}/role`, roleData, { timeout: 10000 });
    } catch (error) {
      console.error(`Error updating role for user ${userId}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to update user role');
    }
  },
  
  getRoles: async () => {
    try {
      // Use the same API endpoint as roleService.getAllRoles with pagination
      const response = await api.get('/admin/roles', { 
        params: { page: 1, limit: 100 }, // Get a large number of roles
        timeout: 10000 
      });
      return response;
    } catch (error) {
      // Return empty array structure on error to prevent UI errors
      return { data: { items: [], meta: { total: 0, totalPages: 0 } } };
    }
  }
};

// Role management services
export const roleService = {
  getAllRoles: async (page = 1, limit = 10, signal, retryCount = 2) => {
    try {
      return await api.get('/admin/roles', { 
        params: { page, limit },
        timeout: 10000,
        signal
      });
    } catch (error) {
      // If we should retry and it's a network error (not abort)
      if (retryCount > 0 && error.name !== 'AbortError' && 
         (error.code === 'ECONNABORTED' || error.message.includes('Network Error'))) {
        console.log(`Retrying role fetch (${retryCount} attempts left)...`);
        // Wait a short time before retrying (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
        // Retry with one less retry attempt
        return roleService.getAllRoles(page, limit, signal, retryCount - 1);
      }
      
      // No more retries or not a retryable error
      throw error;
    }
  },
  
  getRole: async (roleId) => {
    try {
      return await api.get(`/admin/roles/${roleId}`, { timeout: 10000 });
    } catch (error) {
      console.error(`Error fetching role ${roleId}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to fetch role');
    }
  },
  
  createRole: async (roleData) => {
    try {
      return await api.post('/admin/roles', roleData, { timeout: 10000 });
    } catch (error) {
      console.error('Error creating role:', error);
      throw new Error(error.response?.data?.message || 'Failed to create role');
    }
  },
  
  updateRole: async (roleId, roleData) => {
    try {
      return await api.put(`/admin/roles/${roleId}`, roleData, { timeout: 10000 });
    } catch (error) {
      console.error(`Error updating role ${roleId}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to update role');
    }
  },
  
  deleteRole: async (roleId) => {
    try {
      return await api.delete(`/admin/roles/${roleId}`, { timeout: 10000 });
    } catch (error) {
      console.error(`Error deleting role ${roleId}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to delete role');
    }
  },
  
  getPermissions: async (signal) => {
    try {
      return await api.get('/admin/permissions', { 
        timeout: 10000,
        signal
      });
    } catch (error) {
      // Don't throw error if request was aborted
      if (error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED') {
        console.log('Request was aborted or timed out');
        return { data: [] };
      }
      console.error('Error fetching permissions:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch permissions');
    }
  },
  
  assignPermission: async (roleId, permissionData) => {
    try {
      return await api.post(`/admin/roles/${roleId}/permissions`, permissionData, { timeout: 10000 });
    } catch (error) {
      console.error(`Error assigning permission to role ${roleId}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to assign permission');
    }
  },
  
  removePermission: async (roleId, permissionId) => {
    try {
      return await api.delete(`/admin/roles/${roleId}/permissions/${permissionId}`, { timeout: 10000 });
    } catch (error) {
      console.error(`Error removing permission ${permissionId} from role ${roleId}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to remove permission');
    }
  }
};

// Admin verification services
export const adminVerificationService = {
  getVerificationRequests: async (status = 'pending') => {
    try {
      return await api.get(`/admin/verifications?status=${status}`, { timeout: 10000 });
    } catch (error) {
      console.error('Error fetching verification requests:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch verification requests');
    }
  },
  
  approveVerification: async (documentId, notes = 'Verified and approved.') => {
    try {
      return await api.post(`/admin/verifications/${documentId}/approve`, { 
        admin_notes: notes 
      }, { timeout: 10000 });
    } catch (error) {
      console.error(`Error approving verification ${documentId}:`, error);
      throw new Error(error.response?.data?.detail || error.response?.data?.message || 'Failed to approve verification');
    }
  },
  
  rejectVerification: async (documentId, notes) => {
    try {
      return await api.post(`/admin/verifications/${documentId}/reject`, { 
        admin_notes: notes || 'Document rejected due to verification issues.' 
      }, { timeout: 10000 });
    } catch (error) {
      console.error(`Error rejecting verification ${documentId}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to reject verification');
    }
  }
};

// Reference data services
export const referenceService = {
  getCVSUCourses: async () => {
    return api.get('/references/courses');
  }
};

// Get Auth Token
export const getUserToken = () => {
  const { accessToken } = getAuthTokens();
  return accessToken;
};

// Document Request services
export const documentRequestService = {
  getAvailableDocumentTypes: async () => {
    try {
      const response = await api.get('/document-requests/available-types');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching available document request types:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  },

  createDocumentRequest: async (documentType, purpose) => {
    try {
      const response = await api.post(`/document-requests/`, {
        document_type: documentType,
        purpose: purpose
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error creating document request:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  },
  
  getDocumentRequests: async (status = null) => {
    try {
      const url = status ? `/document-requests/?status=${status}` : '/document-requests/';
      const response = await api.get(url);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching document requests:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  },
  
  getDocumentRequest: async (requestId) => {
    try {
      const response = await api.get(`/document-requests/${requestId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`Error fetching document request ${requestId}:`, error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  },
  
  downloadGeneratedDocument: async (requestId, filename) => {
    try {
      const response = await api.get(`/document-requests/${requestId}/download`, {
        responseType: 'blob'
      });

      const contentDisposition = response.headers['content-disposition'] || '';
      const contentType = response.headers['content-type'] || response.data?.type || 'application/octet-stream';
      const headerFilenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
      const fallbackExtension = contentType.includes('pdf')
        ? '.pdf'
        : contentType.includes('wordprocessingml')
          ? '.docx'
          : contentType.includes('msword')
            ? '.doc'
            : '';
      const resolvedFilename = headerFilenameMatch
        ? decodeURIComponent(headerFilenameMatch[1].replace(/"/g, '').trim())
        : (filename || `document-${requestId}${fallbackExtension}`);

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', resolvedFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return {
        success: true
      };
    } catch (error) {
      let errorMessage = error.response?.data?.detail || error.message;
      if (error.response?.data instanceof Blob) {
        try {
          const rawText = await error.response.data.text();
          const parsed = JSON.parse(rawText);
          errorMessage = parsed.detail || parsed.message || rawText || errorMessage;
        } catch (_blobParseError) {
          // Keep the original message when the blob payload is not JSON.
        }
      }
      console.error(`Error downloading document for request ${requestId}:`, error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
};

// Admin Document Request services
export const adminDocumentRequestService = {
  getAllDocumentRequests: async (status = null) => {
    try {
      const url = status ? `/document-requests/admin?status=${status}` : '/document-requests/admin';
      const response = await api.get(url);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching all document requests:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  },
  
  updateDocumentRequestStatus: async (requestId, status, adminNotes = null, rejectionReason = null) => {
    try {
      const updateData = {
        status: status
      };
      
      if (adminNotes) {
        updateData.admin_notes = adminNotes;
      }
      
      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }
      
      const response = await api.put(`/document-requests/${requestId}/update`, updateData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`Error updating document request ${requestId}:`, error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  },
  
  generateDocument: async (requestId) => {
    try {
      const response = await api.post(`/document-requests/${requestId}/generate`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`Error generating document for request ${requestId}:`, error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }
};

// Admin Document services
export const adminDocumentService = {
  searchDocuments: async (statusFilter = 'all') => {
    try {
      let endpoint = `/documents/search`;
      if (statusFilter !== 'all') {
        endpoint += `?verification_status=${statusFilter}`;
      }
      
      const response = await api.get(endpoint);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error searching documents:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  },
  
  getDocument: async (documentId) => {
    try {
      const response = await api.get(`/documents/${documentId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`Error fetching document ${documentId}:`, error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }
};

export default api; 
