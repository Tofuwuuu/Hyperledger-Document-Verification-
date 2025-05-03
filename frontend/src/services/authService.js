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
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: getAuthHeader()
    });
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
    const response = await axios.get(`${API_URL}/auth/unverified-users`, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Get unverified users error:', error);
    throw error;
  }
};

export const verifyUser = async (userId, notes = '') => {
  try {
    console.log(`Sending verification request for userId: ${userId}, notes: ${notes}`);
    
    const response = await axios.post(
      `${API_URL}/auth/verify-user/${userId}`, 
      { notes },
      { headers: getAuthHeader() }
    );
    
    console.log('Verification API response:', response.data);
    
    // Additional step to trigger the dashboard to refresh immediately
    try {
      // Force the dashboard to refetch recent activity
      await axios.get(
        `${API_URL}/admin/dashboard/recent-activity?_force_refresh=true`, 
        { headers: getAuthHeader() }
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
    const response = await axios.get(`${API_URL}/auth/user/${userId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Get user by ID error:', error);
    throw error;
  }
}; 