import axios from 'axios';
import { 
  validateToken, 
  getAuthTokens, 
  storeAuthTokens, 
  clearAuthTokens,
  isRememberedSession 
} from '../utils/authUtils';

// Get API URL from environment or use fallback
// First try to get from environment variable
let baseApiUrl = import.meta.env.VITE_API_URL || 'https://alumni-api-klrk.onrender.com';
// Remove trailing slash if present
baseApiUrl = baseApiUrl.endsWith('/') ? baseApiUrl.slice(0, -1) : baseApiUrl;
// Add /api/v1 only if it's not already included
const API_URL = baseApiUrl.includes('/api/v1') ? baseApiUrl : `${baseApiUrl}/api/v1`;
console.log('API URL configured as:', API_URL); // Debug API URL

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

// Create axios instance with default configuration
export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds
  withCredentials: true, // Important for cookies
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor to include auth tokens and CSRF token
api.interceptors.request.use(
  (config) => {
    // Get the stored CSRF token from localStorage and add it to the headers
    const csrfToken = localStorage.getItem('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    // Get auth tokens
    const { accessToken } = getAuthTokens();
    
    // If we have an auth token, include that too (backwards compatibility)
    if (accessToken && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
      
      // For admin bypass tokens, add a special header
      if (accessToken.startsWith('admin_access_token_')) {
        config.headers['X-Admin-Bypass'] = 'true';
        console.log('Added admin bypass header to request:', config.url);
      }
      
      // For alumni bypass tokens, add a special header
      if (accessToken.startsWith('alumni_access_token_')) {
        config.headers['X-Use-Local-User'] = 'true';
        console.log('Added alumni bypass header to request:', config.url);
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If there's no error response (network error), handle specially
    if (!error.response) {
      console.error('Network error detected in API call:', error.message || 'Unknown error');
      
      // Create a standardized network error
      const networkError = {
        isNetworkError: true,
        message: 'Unable to connect to the server. Please check your internet connection.',
        original: error
      };
      
      // Don't redirect to login for network errors
      // This allows the app to continue functioning offline
      return Promise.reject(networkError);
    }
    
    const originalRequest = error.config;
    
    // Get the token to check if it's a bypass token
    const { accessToken } = getAuthTokens();
    
    // If using admin, alumni, or test bypass token, don't try to refresh the token
    if (accessToken && (
      accessToken.startsWith('admin_access_token_') || 
      accessToken.startsWith('alumni_access_token_')
    )) {
      console.log('Bypass token detected - not attempting refresh for:', originalRequest.url);
      // For bypass tokens, we don't want to redirect to login on 401 either
      return Promise.reject(error);
    }
    
    // If the error is not 401 or the request was already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    
    // If we are already refreshing, queue the request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(token => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch(err => {
          return Promise.reject(err);
        });
    }
    
    originalRequest._retry = true;
    isRefreshing = true;
    
    try {
      // Try to refresh the token
      const { refreshToken } = getAuthTokens();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refresh_token: refreshToken
      });
      
      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid refresh response');
      }
      
      const { access_token, refresh_token } = response.data;
      
      // Store the new tokens
      storeAuthTokens(
        { accessToken: access_token, refreshToken: refresh_token },
        isRememberedSession()
      );
      
      // Update authorization header for originalRequest
      originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
      
      // Process queued requests
      processQueue(null, access_token);
      
      return api(originalRequest);
    } catch (refreshError) {
      // Failed to refresh token
      processQueue(refreshError, null);
      
      // Check if it's a network error
      if (!refreshError.response) {
        console.error('Network error during token refresh:', refreshError.message || 'Unknown error');
        
        // Instead of clearing auth and redirecting, just reject with network error
        const networkError = {
          isNetworkError: true,
          message: 'Unable to connect to the server during token refresh. Please check your internet connection.',
          original: refreshError
        };
        return Promise.reject(networkError);
      }
      
      // Only clear auth and redirect if it's not a network error
      clearAuthTokens();
      window.location.href = '/login';
      
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// Helper function to handle API errors consistently
const handleApiError = (error, context = '') => {
  // Log error for debugging
  console.error(`API Error ${context ? `in ${context}` : ''}:`, error);
  
  // Create a standardized error object
  const errorObj = {
    message: error.response?.data?.detail || error.message || 'Unknown error occurred',
    status: error.response?.status,
    data: error.response?.data || null,
    original: error
  };
  
  // Add context to error
  if (context) {
    errorObj.context = context;
  }
  
  // Special handling for network errors
  if (error.message?.includes('Network Error')) {
    errorObj.isNetworkError = true;
    errorObj.message = 'Unable to connect to the server. Please check your internet connection.';
  }
  
  // Special handling for timeout errors
  if (error.code === 'ECONNABORTED') {
    errorObj.isTimeoutError = true;
    errorObj.message = 'Request timed out. Please try again later.';
  }
  
  throw errorObj;
};

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
      // First get a CSRF token
      await authService.getCsrfToken();
      
      // Extract remember flag if present
      const { remember, ...loginCredentials } = credentials;
      
      // Now use the MFA check endpoint which may return direct login or MFA challenge
      const response = await api.post('/auth/login/mfa-check', loginCredentials);
      
      // If MFA is required, return the MFA challenge
      if (response.data.mfa_required) {
        // Pass along the remember flag for later use after MFA verification
        return {
          ...response.data,
          remember
        };
      }
      
      // No MFA required, process regular login
      // Use URLSearchParams instead of FormData for OAuth2 compatibility
      const params = new URLSearchParams();
      params.append('username', credentials.email);
      params.append('password', credentials.password);
      params.append('remember', remember !== undefined ? remember : false);
      
      // Make the login request with application/x-www-form-urlencoded format
      const loginResponse = await api.post('/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });
      
      if (loginResponse.data.access_token) {
        // Store tokens properly using our utility function
        storeAuthTokens(
          {
            accessToken: loginResponse.data.access_token,
            refreshToken: loginResponse.data.refresh_token
          },
          remember
        );
        
        // Store user data in localStorage
        if (loginResponse.data.user) {
          localStorage.setItem('user', JSON.stringify(loginResponse.data.user));
        }
        
        return loginResponse.data;
      } else {
        throw new Error('No access token received');
      }
    } catch (error) {
      // Preserve the original error details, including headers and response data
      const enhancedError = new Error(error.response?.data?.detail || error.message || 'Login failed');
      enhancedError.originalError = error;
      enhancedError.response = error.response;
      enhancedError.status = error.response?.status;
      enhancedError.headers = error.response?.headers;
      
      console.error('Login error:', enhancedError);
      throw enhancedError; // Throw the enhanced error to be caught by the LoginPage
    }
  },
  
  verifyMfa: async (email, code, remember = false) => {
    try {
      // Use URLSearchParams for MFA verification, more compatible with FastAPI
      const params = new URLSearchParams();
      params.append('email', email);
      params.append('verification_code', code);
      params.append('remember', remember);
      
      const response = await api.post('/auth/login/mfa-verify', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });
      
      if (response.data.access_token) {
        // Store tokens properly using our utility function
        storeAuthTokens(
          {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token
          },
          remember
        );
        
        // Fetch user data
        const userData = await authService.reloadUserWithFreshData();
        
        return {
          ...response.data,
          user: userData
        };
      } else {
        throw new Error('No access token received after MFA verification');
      }
    } catch (error) {
      return handleApiError(error, 'verifyMfa');
    }
  },
  
  register: async (userData) => {
    try {
      console.log('Registration attempt with data:', userData);
      
      // Removed CORS bypass for testing - all registrations now go to the backend
      console.log('Sending registration request to:', `${API_URL}/auth/register`);
      
      // Use direct axios instance to avoid interceptor issues
      const response = await axios({
        method: 'post',
        url: `${API_URL}/auth/register`,
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
      const response = await axios.post(`${API_URL}/auth/refresh`);
      
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

  // Simple direct login method as a last resort
  directLogin: async (email, password, remember = false) => {
    try {
      console.log('Attempting direct login with minimal processing');
      console.log('Login details:', { email, remember, password: '***HIDDEN***' });
      
      // Create URLSearchParams with EXACT field names expected by FastAPI OAuth2PasswordRequestForm
      const params = new URLSearchParams();
      // Must use 'username', not 'email' for OAuth2PasswordRequestForm
      params.append('username', email);
      params.append('password', password);
      // Convert boolean to string because FastAPI Form() expects string values
      params.append('remember', remember.toString());
      
      console.log('Login params:', params.toString().replace(/password=[^&]+/, 'password=***HIDDEN***'));
      
      // Make the direct request with no extra headers or processing
      const response = await axios.post(`${API_URL}/auth/login`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        withCredentials: true
      });
      
      console.log('Direct login response status:', response.status);
      console.log('Direct login response data:', response.data);
      
      if (response.data.access_token) {
        // Store tokens properly
        storeAuthTokens(
          {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token
          },
          remember
        );
        
        // Store user data
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        
        return response.data;
      } else {
        throw new Error('No access token received');
      }
    } catch (error) {
      console.error('Direct login error:', error);
      
      // Enhanced error logging
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        
        // Log validation errors in detail
        if (error.response.status === 422 && error.response.data?.detail) {
          console.error('Validation error details:', JSON.stringify(error.response.data.detail));
          
          // Log each field with issues
          if (Array.isArray(error.response.data.detail)) {
            error.response.data.detail.forEach(err => {
              console.error(`Field ${err.loc.join('.')}: ${err.msg}`);
            });
          }
        }
      }
      
      // Only return the raw error object for debugging
      throw error;
    }
  },
};

// Alumni services
export const alumniService = {
  createProfile: async (profileData) => {
    try {
      console.log('Creating alumni profile with data:', profileData);
      // Additional validation before sending
      if (!profileData.user_id) {
        console.error('Missing user_id in profileData:', profileData);
        throw new Error('User ID is required but missing');
      }
      
      // Use direct axios instance for better debugging
      const response = await axios({
        method: 'post',
        url: `${API_URL}/alumni`,
        data: profileData,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        timeout: 15000 // 15 second timeout
      });
      
      console.log('Profile creation response:', response.data);
      return response;
    } catch (error) {
      console.error('Profile creation failed:', error.message);
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      } else if (error.request) {
        console.error('No response received:', error.request);
      }
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
      return api.get(`/alumni/user/${userId}`);
    } catch (error) {
      console.error(`Error fetching alumni profile for user ${userId}:`, error);
      throw error;
    }
  },
  
  updateProfile: async (profileData) => {
    // Define alumniId outside the try block so it's available in the catch block
    const alumniId = profileData.id;
    
    try {
      // Check if alumni ID is valid
      if (!alumniId || alumniId === 'undefined') {
        console.error('Invalid or missing alumni ID:', alumniId);
        throw new Error('Alumni ID is undefined or invalid. Cannot update profile.');
      }
      
      // Log data before transformation
      console.log(`Updating alumni profile ${alumniId}`, {
        original: JSON.stringify(profileData)
      });
      
      // Special handling for date fields and integers
      if (profileData.birthday) {
        console.log('Birthday field before sending:', profileData.birthday);
        console.log('Birthday field type:', typeof profileData.birthday);
        
        // Try parsing the date to see if it's valid
        try {
          const testDate = new Date(profileData.birthday);
          console.log('Parsed date is valid:', !isNaN(testDate.getTime()));
          console.log('ISO string representation:', testDate.toISOString());
        } catch (e) {
          console.error('Error parsing birthday date:', e);
        }
      }
      
      if (profileData.csc_year) {
        console.log('CSC Year:', profileData.csc_year, 'Type:', typeof profileData.csc_year);
      }
      
      if (profileData.achievements) {
        console.log('Achievements:', profileData.achievements, 'Type:', Array.isArray(profileData.achievements) ? 'array' : typeof profileData.achievements);
      }
      
      // Use direct axios instance for better debugging
      const response = await axios({
        method: 'put',
        url: `${API_URL}/alumni/${alumniId}`,
        data: profileData,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        timeout: 15000 // 15 second timeout
      });
      
      console.log('Profile update response:', response.data);
      return response;
    } catch (error) {
      console.error(`Error updating alumni profile ${alumniId}:`, error.message);
      if (error.response) {
        // Improved error logging for validation errors
        console.error('Error response data:', error.response.data);
        if (error.response.data.detail) {
          // Try to extract more detailed error info
          if (Array.isArray(error.response.data.detail)) {
            // FastAPI validation errors format
            error.response.data.detail.forEach(item => {
              // Log the field name, type of error, and expected type
              console.error('Validation error detail:', JSON.stringify(item));
              if (item.type.includes('type_error')) {
                const fieldName = item.loc[item.loc.length - 1];
                console.error(`Field ${fieldName} has wrong type: expected ${item.type.split('.')[1]}`);
              }
            });
          } else if (typeof error.response.data.detail === 'object') {
            console.error('Validation error object:', JSON.stringify(error.response.data.detail));
            
            // Log each field error separately for better debugging
            Object.entries(error.response.data.detail).forEach(([field, message]) => {
              console.error(`Field ${field} error:`, message);
            });
          } else {
            console.error('Validation error message:', error.response.data.detail);
          }
        }
        console.error('Error response status:', error.response.status);
      } else if (error.request) {
        console.error('No response received:', error.request);
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
      return api.get('/alumni', { params });
    } catch (error) {
      console.error('Error fetching alumni list:', error);
      
      // Try using the simplified endpoint as a fallback
      if (error.isNetworkError || error.response?.status >= 500) {
        console.log('Primary alumni endpoint failed, trying simplified endpoint as fallback');
        try {
          // Use the simpler alumni/list endpoint
          const simplifiedResponse = await api.get('/alumni/list', { params });
          console.log('Simplified alumni endpoint succeeded');
          return simplifiedResponse;
        } catch (fallbackError) {
          console.error('Fallback endpoint also failed:', fallbackError);
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
      }
      
      throw error;
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
    formData.append('document_id', documentId);
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
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
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
      throw new Error(error.response?.data?.message || 'Failed to approve verification');
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
      
      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || 'document.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return {
        success: true
      };
    } catch (error) {
      console.error(`Error downloading document for request ${requestId}:`, error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
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