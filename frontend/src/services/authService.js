import axios from 'axios';
import { API_URL } from '../config';

const getToken = () => {
  return localStorage.getItem('token');
};

const getAuthHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const register = async (userData) => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, userData);
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
    
    const response = await axios.post(`${API_URL}/auth/login`, formData);
    
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    }
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
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