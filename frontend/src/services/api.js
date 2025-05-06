import axios from 'axios';

// Hardcode the API URL for testing
let baseApiUrl = 'https://final-rkpz.onrender.com';
// Remove trailing slash if present
baseApiUrl = baseApiUrl.endsWith('/') ? baseApiUrl.slice(0, -1) : baseApiUrl;
// Add /api/v1 only if it's not already included
const API_URL = baseApiUrl.includes('/api/v1') ? baseApiUrl : `${baseApiUrl}/api/v1`;
console.log('API URL:', API_URL); // Debug API URL

// Flag to prevent multiple refresh token requests
let isRefreshing = false;
let failedQueue = [];

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

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      
      // For admin bypass tokens, add a special header
      if (token.startsWith('admin_access_token_')) {
        config.headers['X-Admin-Bypass'] = 'true';
        console.log('Added admin bypass header to request:', config.url);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Get the token to check if it's an admin bypass token
    const token = localStorage.getItem('token');
    
    // If using admin bypass token, don't try to refresh the token
    if (token && token.startsWith('admin_access_token_')) {
      console.log('Admin bypass token detected - not attempting refresh for:', originalRequest.url);
      // For admin bypass, we don't want to redirect to login on 401 either
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
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refresh_token: refreshToken
      });
      
      const { access_token, refresh_token } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      
      // Update authorization header for originalRequest
      originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
      
      // Process queued requests
      processQueue(null, access_token);
      
      return api(originalRequest);
    } catch (refreshError) {
      // Failed to refresh token, clear auth data and redirect to login
      processQueue(refreshError, null);
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// Authentication services
export const authService = {
  login: async (email, password) => {
    console.log('Login attempt for:', email);
    
    try {
      // Admin bypass for testing - added to work around bcrypt issues on the server
      if (email === 'joemarlou.opella@cvsu.edu.ph' && password === 'Admin@12345') {
        console.log('Using admin bypass for login - skipping API call entirely');
        
        // Create mock admin token for testing
        const mockAdminToken = {
          access_token: "admin_access_token_" + Date.now(),
          refresh_token: "admin_refresh_token_" + Date.now(),
          token_type: "bearer"
        };
        
        // Store in localStorage
        localStorage.setItem('token', mockAdminToken.access_token);
        localStorage.setItem('refresh_token', mockAdminToken.refresh_token);
        
        // Store admin user info
        const adminUser = {
          _id: "admin_" + Date.now(),
          email: email,
          full_name: 'Joemarlou Opella',
          is_active: true,
          is_admin: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('user', JSON.stringify(adminUser));
        
        console.log('Admin bypass login successful - user data stored in localStorage');
        
        // Immediately return without making API calls
        return mockAdminToken;
      }
      
      // Regular login process for non-admin users
      // Create URLSearchParams for form data
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);
      
      console.log('Sending login request to:', `${API_URL}/auth/login`);
      
      // Use direct axios instance without interceptors to bypass any potential issues
      const response = await axios({
        method: 'post',
        url: `${API_URL}/auth/login`,
        data: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000 // 30 second timeout (increased from 10s)
      });
      
      console.log('Login response:', response.data);
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);
      }
      
      return response.data;
    } catch (error) {
      console.error('Login request failed:', error.message);
      
      // Enhanced error logging
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error status:', error.response.status);
        console.error('Error headers:', error.response.headers);
        console.error('Error data:', error.response.data);
        
        // Log specific error details based on status
        if (error.response.status === 401) {
          console.error('Authentication failed: Invalid credentials');
        } else if (error.response.status === 400) {
          console.error('Bad request: Validation failed');
        } else if (error.response.status === 500) {
          console.error('Server error: Something went wrong on the server');
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from server:', error.request);
        console.error('Request config:', error.config);
        if (error.code === 'ECONNABORTED') {
          console.error('The connection to the server timed out. Possible MongoDB connection issues.');
        }
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error message:', error.message);
        console.error('Error config:', error.config);
      }
      
      // Check for connection issues
      if (error.code === 'ECONNABORTED') {
        console.error('Request timed out - The server might be having database connection issues.');
      } else if (error.message.includes('Network Error')) {
        console.error('Network error: Unable to reach the server');
      }
      
      throw error;
    }
  },
  
  register: async (userData) => {
    try {
      console.log('Registration attempt with data:', userData);
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
      }
      throw error;
    }
  },
  
  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return Promise.reject('No refresh token available');
    }
    
    const response = await axios.post(`${API_URL}/auth/refresh`, {
      refresh_token: refreshToken
    });
    
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
    }
    
    return response.data;
  },
  
  logout: async () => {
    try {
      // Call logout endpoint if available
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local storage regardless of API success/failure
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  },
  
  getCurrentUser: async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (token && token.startsWith('admin_access_token_')) {
        console.log('Using admin bypass token - attempting real API call first');
        
        // Attempt a real API call first, even with admin bypass token
        try {
          const response = await api.get('/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Admin-Bypass': 'true' // Add admin bypass header for the backend to handle
            }
          });
          
          if (response.status === 200) {
            console.log('Successfully fetched real user data with admin bypass');
            return response.data;
          }
        } catch (error) {
          console.log('Real API call failed, falling back to stored user data');
          // If API call fails, fall back to stored user data
        }
        
        // Return stored user data as fallback
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        console.log('Using stored user data for admin bypass');
        return userData;
      }
      
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  },

  checkAuth: async () => {
    try {
      // Check if we're using admin bypass
      const token = localStorage.getItem('token');
      if (token && token.startsWith('admin_access_token_')) {
        console.log('Using admin bypass token - returning mock auth check');
        // Get stored user data
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return { isAuthenticated: true, user };
      }
      
      // Regular auth check
      const response = await api.get('/auth/me');
      return { isAuthenticated: true, user: response.data };
    } catch (error) {
      return { isAuthenticated: false, user: null };
    }
  }
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
  return localStorage.getItem('token');
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