import axios from 'axios';
import { API_URL } from './api';  // Import API_URL from api.js instead of config
import { api, apiService } from './api';  // Import the pre-configured axios instance and API service

// Configure axios defaults
axios.defaults.withCredentials = true;
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

const getToken = () => {
  return localStorage.getItem('token');
};

const getAuthHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// No need to create a new axios instance since we're importing api
// Instead we'll use the imported api instance

// Add request interceptor (keeping these for backwards compatibility)
api.interceptors.request.use(
  (config) => {
    // Add auth header if token exists
    const token = getToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// We're removing the response interceptor here since it's already defined in api.js
// This prevents conflicts with the token refresh logic

export const register = async (userData) => {
  try {
    const response = await api.post(`/auth/register`, userData);
    return response.data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const login = async (credentials) => {
  try {
    const response = await api.post('/auth/login', {
      email: credentials.email,
      password: credentials.password,
      remember: credentials.remember ?? false,
    });
    
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    }
    
    return response.data;
  } catch (error) {
    // Extract the safe error message to avoid serialization issues
    const errorResponse = error.response?.data || {};
    let errorMessage = '';
    
    // Check for different types of validation errors
    if (error.response?.status === 422) {
      if (Array.isArray(errorResponse.detail)) {
        // Handle FastAPI validation error array format
        errorMessage = errorResponse.detail[0]?.msg || 'Validation error';
      } else if (typeof errorResponse.detail === 'string') {
        errorMessage = errorResponse.detail;
      } else if (errorResponse.detail && typeof errorResponse.detail === 'object') {
        // Convert object of errors to a string
        errorMessage = Object.values(errorResponse.detail).join(', ');
      } else {
        errorMessage = 'Validation error';
      }
    } else {
      // For other types of errors
      errorMessage = errorResponse.detail || error.message || 'Unknown error';
    }
    
    console.error('Login error:', errorMessage);
    
    // Create a simplified error object that's safe for serialization
    const safeError = new Error(errorMessage);
    safeError.status = error.response?.status;
    safeError.data = errorMessage;
    
    throw safeError;
  }
};

export const logout = () => {
  localStorage.removeItem('token');
};

export const getProfile = async () => {
  try {
    // Set up headers with auth
    const headers = getAuthHeader();
    
    const response = await axios.get(`${API_URL}/auth/me`, { headers });
    return response.data;
  } catch (error) {
    console.error('Get profile error:', error);
    throw error;
  }
};

export const changePassword = async (passwordData) => {
  try {
    const response = await axios.post(`${API_URL}/auth/change-password`, passwordData, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Change password error:', error);
    throw error;
  }
};

// New functions for user verification
export const getUnverifiedUsers = async (signal) => {
  try {
    console.log('=== DEBUG: getUnverifiedUsers called ===');
    
    // Get the token and check if it's a valid token
    const token = getToken();
    if (!token) {
      console.error('No authentication token found');
      return [];
    }
    
    // Set up headers with authentication
    const headers = getAuthHeader();
    
    // Add admin-specific headers
    headers['X-Admin-Access'] = 'true';
    
    // Use simplified approach with direct axios call instead of the service
    try {
      console.log('Making request to:', `${API_URL}/auth/unverified-users?limit=10`);
      
      const response = await axios({
        method: 'get',
        url: `${API_URL}/auth/unverified-users?limit=10`,
        headers: headers,
        withCredentials: true,
        timeout: 30000,
        signal: signal
      });
      
      console.log('Unverified users response status:', response.status);
      
      if (Array.isArray(response.data)) {
        return response.data;
      } else {
        console.error('Unexpected response format (not an array):', response.data);
        return []; 
      }
    } catch (apiError) {
      console.error('API Error fetching unverified users:', apiError);
      
      if (apiError.name === 'AbortError' || apiError.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Server took too long to respond.');
      }
      
      if (apiError.response) {
        // Handle specific HTTP errors
        if (apiError.response.status === 413) {
          throw new Error('Response too large. Please contact administrator.');
        } else if (apiError.response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (apiError.response.status === 403) {
          throw new Error('You do not have permission to access this resource.');
        }
      } 
      
      throw apiError;
    }
  } catch (error) {
    console.error('Get unverified users general error:', error);
    throw error;
  }
};

export const verifyUser = async (userId, notes = '') => {
  let attempts = 0;
  const maxAttempts = 3;
  const backoffMs = 1000; // Start with 1 second backoff
  
  while (attempts < maxAttempts) {
    try {
      console.log(`Sending verification request for userId: ${userId}, notes: ${notes} (Attempt ${attempts + 1}/${maxAttempts})`);
      
      // Try to get a CSRF token first
      try {
        console.log('Fetching CSRF token');
        await apiService.get('/auth/csrf-token');
        console.log('CSRF token obtained');
      } catch (csrfError) {
        console.warn('Error obtaining CSRF token:', csrfError);
        // Continue even if CSRF token fetch fails
      }
      
      // Set up headers with auth
      const headers = getAuthHeader();
      headers['X-Admin-Access'] = 'true';
      
      // Add CSRF token if available
      const csrfToken = localStorage.getItem('csrf_token');
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
        console.log('Added CSRF token to request');
      }
      
      // Use withCORS to handle CORS issues better
      const response = await apiService.withCORS(
        'post',
        `/auth/verify-user/${userId}?db=cvsu_alumni&collection=users`,
        { notes },
        { 
          headers,
          timeout: 20000 // 20s timeout
        }
      );
      
      console.log('Verification API response:', response.data);
      
      // Additional step to trigger the dashboard to refresh immediately
      try {
        // Force the dashboard to refetch recent activity
        await apiService.withCORS(
          'get',
          `/admin/dashboard/recent-activity?_force_refresh=true`,
          null,
          { headers }
        );
      } catch (refreshErr) {
        console.warn('Failed to refresh dashboard data:', refreshErr);
      }
      
      return response.data;
    } catch (error) {
      console.error(`Error verifying user (attempt ${attempts + 1}/${maxAttempts}):`, error);
      
      // Track the attempt
      attempts++;
      
      // Check if it's a CSRF error
      const isCsrfError = 
        error.message && error.message.includes('CSRF token missing or invalid');
      
      // If it's a CSRF error, try to get a new token before retrying
      if (isCsrfError && attempts < maxAttempts) {
        console.log('CSRF error detected, getting new token...');
        try {
          await apiService.get('/auth/csrf-token');
          console.log('New CSRF token obtained, retrying...');
          continue;
        } catch (csrfError) {
          console.error('Failed to get new CSRF token:', csrfError);
        }
      }
      
      // If it's a CORS or network error and we have retries left, wait and retry
      const isCorsOrNetworkError = 
        (error.message && error.message.includes('CORS')) || 
        (error.message && error.message.includes('Network Error')) ||
        (!error.response && error.request);
      
      if (isCorsOrNetworkError && attempts < maxAttempts) {
        // Calculate backoff with exponential increase
        const waitTime = backoffMs * Math.pow(2, attempts - 1);
        console.log(`CORS/Network error detected, retrying in ${waitTime}ms...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // If we've exhausted retries or it's not a CORS/network error, throw with helpful message
      if (error.message && error.message.includes('CSRF')) {
        throw new Error('CSRF error: Unable to verify user due to missing or invalid CSRF token. Please try refreshing the page.');
      } else if (error.message && error.message.includes('CORS')) {
        throw new Error('CORS error: Unable to verify user due to cross-origin restrictions. Please try again.');
      } else if (error.isTimeout || (error.message && error.message.includes('timeout'))) {
        throw new Error('Request timed out. The server took too long to respond.');
      } else if (error.response) {
        // Use the server's error message if available
        const errorMessage = error.response.data?.detail || 'Failed to verify user';
        throw new Error(errorMessage);
      } else {
        throw error;
      }
    }
  }
  
  throw new Error(`Failed to verify user after ${maxAttempts} attempts. Please try again later.`);
};

export const getUserById = async (userId) => {
  try {
    // Set up headers with auth
    const headers = getAuthHeader();
    
    const response = await axios.get(`${API_URL}/auth/user/${userId}`, { headers });
    return response.data;
  } catch (error) {
    console.error('Get user by ID error:', error);
    throw error;
  }
};

// Password reset functions
export const requestPasswordReset = async (email) => {
  try {
    const response = await axios.post(`${API_URL}/auth/reset-password`, { email });
    return response.data;
  } catch (error) {
    console.error('Password reset request error:', error);
    throw error;
  }
};

export const verifyResetToken = async (token) => {
  try {
    const response = await axios.post(`${API_URL}/auth/verify-reset-token`, { token });
    return response.data;
  } catch (error) {
    console.error('Token verification error:', error);
    throw error;
  }
};

export const resetPassword = async (token, password, confirm_password) => {
  try {
    const response = await axios.post(`${API_URL}/auth/reset-password-confirm`, {
      token,
      password,
      confirm_password
    });
    return response.data;
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

export const getCsrfToken = async () => {
  try {
    console.log('Getting CSRF token from server');
    const response = await axios.get(`${API_URL}/auth/csrf-token`, {
      withCredentials: true,
    });
    
    if (response.data && response.data.csrf_token) {
      // Store in localStorage for later use
      localStorage.setItem('csrf_token', response.data.csrf_token);
      console.log('CSRF token stored in localStorage');
      return response.data.csrf_token;
    } else {
      console.error('Invalid CSRF token response:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    throw error;
  }
}; 