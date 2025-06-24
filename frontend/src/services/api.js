import axios from 'axios';

// Consistent API URL configuration - use relative paths for API proxy
const API_URL = '/api/v1';
export { API_URL };

// Debug log current configuration
console.log('API URL configured as:', API_URL);

// Flag to prevent multiple refresh token requests
let isRefreshing = false;
let failedQueue = [];

// Debug log for API requests
const debugApiRequests = true;

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
    }
    
    // Log all API requests when debug is enabled
    if (debugApiRequests) {
      console.log(`API Request: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
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
        // Clear any previous user type
        localStorage.removeItem('user_type');
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
  
  employerLogin: async (email, password) => {
    console.log('Employer login attempt for:', email);
    
    try {
      // Create URLSearchParams for form data
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);
      
      console.log('Sending employer login request to:', `${API_URL}/employers/login`);
      
      // Use direct axios instance without interceptors to bypass any potential issues
      const response = await axios({
        method: 'post',
        url: `${API_URL}/employers/login`,
        data: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000 // 30 second timeout
      });
      
      console.log('Employer login response:', response.data);
      if (response.data.access_token) {
        // Clear any previous auth data
        localStorage.removeItem('user');
        
        // Set new auth data
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);
        localStorage.setItem('user_type', 'employer'); // Mark as employer login
        
        console.log('Employer login successful, user_type set to employer');
      }
      
      return response.data;
    } catch (error) {
      console.error('Employer login request failed:', error.message);
      
      // Enhanced error logging
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
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
      
      console.log('Registration successful:', response.data);
      return response;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  },
  
  registerEmployer: async (employerData) => {
    try {
      console.log('Employer registration attempt with data:', employerData);
      console.log('Sending employer registration request to:', `${API_URL}/employers/register`);
      
      // Use direct axios instance to avoid interceptor issues
      const response = await axios({
        method: 'post',
        url: `${API_URL}/employers/register`,
        data: employerData,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log('Employer registration successful:', response.data);
      return response;
    } catch (error) {
      console.error('Employer registration failed:', error);
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
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      return axios.get(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  },

  checkAuth: async () => {
    try {
      const response = await api.get('/auth/me');
      return { isAuthenticated: true, user: response.data };
    } catch (error) {
      return { isAuthenticated: false, user: null };
    }
  },

  submitQuestionnaire: async (questionnaireData) => {
    try {
      const response = await api.post('/users/questionnaire', questionnaireData);
      return response;
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      throw error;
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
      
      // Ensure required fields have values
      const requiredFields = ['full_name', 'student_id', 'course', 'graduation_year', 'department', 'batch'];
      const missingFields = requiredFields.filter(field => !profileData[field]);
      
      if (missingFields.length > 0) {
        console.error('Missing required fields:', missingFields);
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      // REMOVE birthday field completely - we'll add it later when format is known
      delete profileData.birthday;
      console.log('Removed birthday field to avoid validation errors');
      
      // Ensure address doesn't exceed 200 characters
      if (profileData.address && profileData.address.length > 200) {
        console.warn('Address exceeds 200 characters, truncating...');
        profileData.address = profileData.address.substring(0, 200);
      }
      
      // Validate graduation_month - must be one of the allowed values
      if (profileData.graduation_month) {
        if (!["April", "September", "November"].includes(profileData.graduation_month)) {
          console.warn('Invalid graduation_month detected before API call:', profileData.graduation_month);
          delete profileData.graduation_month; // Remove invalid field entirely
        } else {
          console.log('Valid graduation_month:', profileData.graduation_month);
        }
      }
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        throw new Error('Authentication token missing. Please log in again.');
      }
      
      // Ensure achievements is properly formatted
      if (profileData.achievements) {
        if (!Array.isArray(profileData.achievements)) {
          profileData.achievements = [];
        } else {
          // Make sure all achievements have a title property
          profileData.achievements = profileData.achievements
            .filter(a => a && (typeof a === 'string' || a.title))
            .map(a => typeof a === 'string' ? { title: a } : a);
        }
      }
      
      // Use direct axios instance for better debugging
      const response = await axios({
        method: 'post',
        url: `${API_URL}/alumni/`, // Ensure trailing slash is present
        data: profileData,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
        
        // If profile already exists, try to fetch and return it instead of throwing error
        if (error.response.status === 400 && 
            error.response.data.detail === "Alumni profile already exists for this user" &&
            profileData.user_id) {
          console.log('Profile already exists, fetching existing profile instead');
          try {
            // Use direct API call to avoid recursion
            const existingProfile = await api.get(`/alumni/user/${profileData.user_id}`);
            console.log('Successfully fetched existing profile:', existingProfile.data);
            return existingProfile;
          } catch (fetchError) {
            console.error('Failed to fetch existing profile after "already exists" error:', fetchError);
            // Continue with original error if fetch fails
          }
        }
        
        // Enhanced logging for validation errors
        if (error.response.status === 422 && error.response.data.detail) {
          if (Array.isArray(error.response.data.detail)) {
            error.response.data.detail.forEach(validationError => {
              console.error('Validation error:', JSON.stringify(validationError));
              
              // Log specific details about common fields
              if (validationError.loc.includes('birthday')) {
                console.error(`Birthday validation error: ${validationError.msg}`);
              }
              
              if (validationError.loc.includes('graduation_month')) {
                console.error(`Graduation month validation error: ${validationError.msg}`);
              }
            });
          }
        }
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
  uploadDocument: async (documentData) => {
    const formData = new FormData();
    for (const key in documentData) {
      formData.append(key, documentData[key]);
    }
    
    console.log('Uploading document with data:', {
      alumni_id: documentData.alumni_id,
      document_type: documentData.document_type,
      title: documentData.title,
      description: documentData.description || 'None',
      file_name: documentData.file?.name || 'No file'
    });
    
    // Use the correct endpoint as defined in the backend
    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  },
  
  getUserDocuments: async () => {
    const response = await api.get('/documents');
    return response.data;
  },
  
  getDocumentById: async (id) => {
    const response = await api.get(`/documents/${id}`);
    return response.data;
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
  verifyDocument: async (documentIdOrCode, hash = null) => {
    try {
      // If hash is provided, use the blockchain verification endpoint
      if (hash) {
        const response = await api.post('/verification/blockchain/verify', {
          document_id: documentIdOrCode,
          hash: hash
        });
        return {
          success: true,
          data: response.data
        };
      } 
      // If only documentIdOrCode is provided, use the document check endpoint
      else {
        // First try the blockchain check endpoint
        try {
          const response = await api.get(`/verification/check/${documentIdOrCode}`);
          return {
            success: true,
            data: response.data
          };
        } catch (checkError) {
          // Fall back to the legacy verification endpoint if check fails
          const legacyResponse = await api.get(`/documents/verify/${documentIdOrCode}`);
          return {
            success: true,
            data: legacyResponse.data
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Document verification failed'
      };
    }
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

  // New function to get admin by ID (non-admin endpoint)
  getUserById: async (userId) => {
    try {
      return await api.get(`/users/${userId}/public`);
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return { data: null };
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

export default api; 