import axios from 'axios';
import { API_URL } from '../config';
import { api } from './api';  // Import the pre-configured axios instance

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
    const formData = new FormData();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);
    
    const response = await api.post('/auth/login', formData);
    
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
    // Get the token and check if it's an admin bypass token
    const token = getToken();
    const isAdminBypass = token && token.startsWith('admin_access_token_');
    
    // Set up headers with auth and admin bypass if needed
    const headers = getAuthHeader();
    if (isAdminBypass) {
      headers['X-Admin-Bypass'] = 'true';
      console.log('Adding admin bypass header for profile request');
    }
    
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
export const getUnverifiedUsers = async () => {
  try {
    // Get the token and check if it's an admin bypass token
    const token = getToken();
    const isAdminBypass = token && token.startsWith('admin_access_token_');
    
    // Set up headers with auth and admin bypass if needed
    const headers = getAuthHeader();
    if (isAdminBypass) {
      headers['X-Admin-Bypass'] = 'true';
      console.log('Adding admin bypass header for unverified users request');
    }
    
    console.log('Making request to unverified-users with headers:', headers);
    const response = await axios.get(`${API_URL}/auth/unverified-users`, { headers });
    return response.data;
  } catch (error) {
    console.error('Get unverified users error:', error);
    throw error;
  }
};

export const verifyUser = async (userId, notes = '') => {
  try {
    console.log(`Sending verification request for userId: ${userId}, notes: ${notes}`);
    
    // Get the token and check if it's an admin bypass token
    const token = getToken();
    const isAdminBypass = token && token.startsWith('admin_access_token_');
    
    // Set up headers with auth and admin bypass if needed
    const headers = getAuthHeader();
    if (isAdminBypass) {
      headers['X-Admin-Bypass'] = 'true';
      console.log('Adding admin bypass header for verify user request');
    }
    
    const response = await axios.post(
      `${API_URL}/auth/verify-user/${userId}`, 
      { notes },
      { headers }
    );
    
    console.log('Verification API response:', response.data);
    
    // Additional step to trigger the dashboard to refresh immediately
    try {
      // Force the dashboard to refetch recent activity with admin bypass if needed
      await axios.get(
        `${API_URL}/admin/dashboard/recent-activity?_force_refresh=true`, 
        { headers }
      );
    } catch (refreshErr) {
      console.warn('Failed to refresh dashboard data:', refreshErr);
    }
    
    return response.data;
  } catch (error) {
    console.error('Verify user error:', error);
    throw error;
  }
};

export const getUserById = async (userId) => {
  try {
    // Get the token and check if it's an admin bypass token
    const token = getToken();
    const isAdminBypass = token && token.startsWith('admin_access_token_');
    
    // Set up headers with auth and admin bypass if needed
    const headers = getAuthHeader();
    if (isAdminBypass) {
      headers['X-Admin-Bypass'] = 'true';
      console.log('Adding admin bypass header for get user request');
    }
    
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