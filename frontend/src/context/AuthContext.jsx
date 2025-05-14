import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  validateToken, 
  getAuthTokens, 
  storeAuthTokens, 
  clearAuthTokens,
  isRememberedSession,
  isTemporarySession,
  isUserAdmin,
  needsTokenRefresh
} from '../utils/authUtils';
import { API_URL } from '../config';

// Create direct service functions instead of importing (to avoid circular dependencies)
const authService = {
  async getCurrentUser() {
    try {
      const { accessToken } = getAuthTokens();
      if (!accessToken) return null;
      
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw error;
    }
  },
  
  async reloadUserWithFreshData() {
    try {
      const { accessToken } = getAuthTokens();
      if (!accessToken) return null;
      
      const response = await axios.get(`${API_URL}/auth/me?_force_refresh=true`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error reloading user data:', error);
      throw error;
    }
  },
  
  async refreshToken() {
    try {
      const { refreshToken } = getAuthTokens();
      if (!refreshToken) throw new Error('No refresh token available');
      
      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refresh_token: refreshToken
      });
      return response.data;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  },
  
  async login(credentials) {
    try {
      // First, check for MFA if needed
      if (!credentials.mfa_code && !credentials.bypass_mfa) {
        try {
          console.log('Making MFA check request to:', `${API_URL}/auth/login/mfa-check`);
          const mfaCheck = await axios.post(
            `${API_URL}/auth/login/mfa-check`,
            {
              email: credentials.email,
              password: credentials.password
            },
            {
              withCredentials: false  // Don't send credentials for the MFA check
            }
          );
          
          // If MFA is required, return that info
          if (mfaCheck.data && mfaCheck.data.mfa_required) {
            return mfaCheck.data;
          }
        } catch (error) {
          // Properly handle the error object to avoid React serialization issues
          const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
          console.error('MFA check error:', errorMessage);
          
          // If we get a 422 validation error, handle it properly
          if (error.response?.status === 422) {
            throw error; // Re-throw to be caught by the main login error handler
          }
          // Continue with normal login if MFA check fails with other errors
        }
      }
      
      // Proceed with normal login
      const response = await axios.post(`${API_URL}/auth/login`, credentials);
      return response.data;
    } catch (error) {
      // Properly handle the error object to avoid React serialization issues
      const errorResponse = error.response?.data || {};
      const errorMessage = errorResponse.detail || error.message || 'Unknown error';
      console.error('Login service error:', errorMessage);
      throw error;
    }
  },
  
  async register(userData) {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, userData);
      return response.data;
    } catch (error) {
      console.error('Registration service error:', error);
      throw error;
    }
  },
  
  async logout() {
    try {
      const { accessToken } = getAuthTokens();
      if (!accessToken) return;
      
      // Try to call the logout endpoint
      await axios.post(`${API_URL}/auth/logout`, {}, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
    } catch (error) {
      // Continue even if the API call fails
      console.error('Error calling logout API:', error);
    }
  },

  async directLogin(credentials) {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, credentials);
      return response.data;
    } catch (error) {
      console.error('Direct login error:', error);
      throw error;
    }
  }
};

// Create the auth context
const AuthContext = createContext();

// Hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Clear any auth errors when component mounts
  useEffect(() => {
    setError(null);
  }, []);

  // Function to forcefully fetch the latest user data from the server
  const forceRefreshUserData = useCallback(async () => {
    try {
      const { accessToken } = getAuthTokens();
      if (!accessToken) return null;
      
      // Check if we have a cached refresh timestamp to avoid refresh loops
      const lastRefreshTime = sessionStorage.getItem('last_user_refresh');
      const currentTime = new Date().getTime();
      
      // If we've refreshed in the last 10 seconds, use cached data
      if (lastRefreshTime && (currentTime - parseInt(lastRefreshTime)) < 10000) {
        console.log('Using cached user data (refreshed in last 10 seconds)');
        return currentUser;
      }
      
      // Add a cache-busting parameter 
      const timestamp = currentTime;
      
      // Force fetch the latest user data from server
      const response = await axios.get(`${API_URL}/auth/me?_t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.data) {
        // Get current stored data
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Check and update verification status consistently across storage locations
        if (response.data.is_verified === true) {
          sessionStorage.setItem('user_verified', 'true');
          
          // Make sure localStorage is updated too
          if (!storedUser.is_verified) {
            storedUser.is_verified = true;
            localStorage.setItem('user', JSON.stringify(storedUser));
          }
        }
        
        // Update current user and localStorage
        setCurrentUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
        console.log('User data forcefully refreshed:', response.data);
        
        // Record refresh timestamp
        sessionStorage.setItem('last_user_refresh', currentTime.toString());
        
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error forcefully refreshing user data:', error);
      return null;
    }
  }, [currentUser]);

  // Define loadUserData at component level with useCallback
  const loadUserData = useCallback(async () => {
    const { accessToken } = getAuthTokens();
    
    if (!accessToken) {
      setLoading(false);
      setCurrentUser(null);
      setIsAuthenticated(false);
      return null;
    }
    
    setLoading(true);
    try {
      console.log('Loading user data from API or local storage');
      
      // Check for admin or alumni bypass tokens that should use localStorage data instead of API calls
      if (accessToken.startsWith('admin_access_token_') || 
          accessToken.startsWith('alumni_access_token_')) {
        console.log("Using bypass token - skipping API call and using localStorage data");
        
        // For bypass tokens, just return the stored user data
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData && userData.email) {
          console.log('User data loaded from localStorage:', userData);
          
          // Ensure verification is always set for bypass tokens
          if (!userData.is_verified) {
            userData.is_verified = true;
            localStorage.setItem('user', JSON.stringify(userData));
            console.log('Updated is_verified flag to true for bypass token user');
          }
          
          setCurrentUser(userData);
          setIsAuthenticated(true);
          return userData;
        } else {
          console.error("No valid user data found in localStorage for bypass token");
          setCurrentUser(null);
          setIsAuthenticated(false);
          return null;
        }
      }
      
      // For regular tokens, use API call
      try {
        // Check if we're in a recent refresh cycle to avoid API thrashing
        const lastRefreshTime = sessionStorage.getItem('last_user_refresh');
        const currentTime = new Date().getTime();
        
        // If we've refreshed in the last 5 seconds, use cached data
        if (lastRefreshTime && (currentTime - parseInt(lastRefreshTime)) < 5000) {
          console.log('Using cached user data (refreshed in last 5 seconds)');
          const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
          if (cachedUser && cachedUser.email) {
            // Still need to update state
            setCurrentUser(cachedUser);
            setIsAuthenticated(true);
            return cachedUser;
          }
        }
        
        const userData = await authService.getCurrentUser();
        console.log('User data loaded from API:', userData);
        
        if (userData) {
          // Store user data
          setCurrentUser(userData);
          setIsAuthenticated(true);
          
          // Apply verification status from server consistently
          if (userData.is_verified === true) {
            // Ensure verification status is stored in both locations
            sessionStorage.setItem('user_verified', 'true');
          }
          
          // Store user in local storage for persistence
          localStorage.setItem('user', JSON.stringify(userData));
          
          // Record this refresh
          sessionStorage.setItem('last_user_refresh', currentTime.toString());
          
          return userData;
        }
      } catch (error) {
        console.warn('API call failed, trying localStorage fallback:', error);
        
        // Fallback to localStorage if API fails
        const localUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (localUser && localUser.email) {
          console.log('User data loaded from localStorage fallback:', localUser);
          setCurrentUser(localUser);
          setIsAuthenticated(true);
          return localUser;
        }
        
        throw error; // Re-throw if fallback also fails
      }
      
      // If we get here, no valid user was found
      setCurrentUser(null);
      setIsAuthenticated(false);
      return null;
    } catch (error) {
      console.error('Error loading user:', error);
      setCurrentUser(null);
      setIsAuthenticated(false);
      // Clean up storage on auth error
      if (error.response?.status === 401) {
        clearAuthTokens();
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Define the logout function before it's used
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear all auth data using utility function
      clearAuthTokens();
      
      setCurrentUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  // Memoized function to refresh token
  const refreshToken = useCallback(async () => {
    try {
      setLoading(true);
      
      const { accessToken } = getAuthTokens();
      
      // Check if we're using admin bypass
      if (accessToken && accessToken.startsWith('admin_access_token_')) {
        console.log('Admin bypass token - no need to refresh');
        await loadUserData();
        return true;
      }
      
      // Normal token refresh for regular users
      const response = await authService.refreshToken();
      
      if (response && response.access_token) {
        // Store new tokens with the same "remember" setting
        storeAuthTokens({
          accessToken: response.access_token,
          refreshToken: response.refresh_token
        }, isRememberedSession());
        
        await loadUserData();
        return true;
      } else {
        throw new Error('Invalid refresh response');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      logout();
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadUserData, logout]);

  // Check authentication status on initial load
  useEffect(() => {
    const checkAuthStatus = async () => {
      const { accessToken } = getAuthTokens();
      
      if (!accessToken) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      // Check if we're using admin bypass
      if (accessToken && accessToken.startsWith('admin_access_token_')) {
        console.log('Using admin bypass token - skipping JWT validation');
        // Skip validation for admin bypass tokens
        await loadUserData();
        setLoading(false);
        return;
      }
      
      try {
        const { isValid, isExpired } = validateToken(accessToken);
        
        if (!isValid) {
          if (isExpired) {
            // Token is expired, try to refresh
            const success = await refreshToken();
            if (!success) {
              setCurrentUser(null);
              setIsAuthenticated(false);
            }
          } else {
            // Token is invalid, logout
            await logout();
          }
        } else {
          // For temporary sessions (not remembered), verify the session is still in this browser tab
          if (!isRememberedSession() && !isTemporarySession()) {
            // For temporary sessions, we require the session marker
            console.log('Temporary session not found, logging out');
            await logout();
            return;
          }
          
          try {
            // Try to load user data from API
            await loadUserData();
          } catch (error) {
            console.error('Error loading user data from API:', error);
            
            // If network error, try to use cached user data instead of logging out
            if (error.isNetworkError || error.message?.includes('Network Error') || 
                error.original?.message?.includes('Network Error')) {
              console.log('Network error detected, using cached user data from localStorage');
              
              // Try to get user data from localStorage
              try {
                const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
                if (cachedUser && cachedUser.email) {
                  console.log('Using cached user data:', cachedUser);
                  setCurrentUser(cachedUser);
                  setIsAuthenticated(true);
                  // Don't clear loading here since we're using cached data
                } else {
                  console.log('No valid cached user data found');
                  // Keep the user logged in but with minimal data
                  setCurrentUser({ email: 'User', is_authenticated: true });
                  setIsAuthenticated(true);
                }
              } catch (e) {
                console.error('Error parsing cached user data:', e);
                // Still keep user logged in with minimal info
                setCurrentUser({ email: 'User', is_authenticated: true });
                setIsAuthenticated(true);
              }
            } else {
              // For other errors, proceed with logout
              console.log('Non-network error, logging out:', error);
              await logout();
            }
          }
        }
      } catch (error) {
        console.error('Error in checkAuthStatus:', error);
        // For any validation error, try to use cached data first
        try {
          const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
          if (cachedUser && cachedUser.email) {
            console.log('Using cached user data due to validation error:', cachedUser);
            setCurrentUser(cachedUser);
            setIsAuthenticated(true);
          } else {
            await logout();
          }
        } catch (e) {
          await logout();
        }
      } finally {
        setLoading(false);
      }
    };
    
    checkAuthStatus();
  }, [loadUserData, logout, refreshToken]);

  // Login a user
  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authService.login(credentials);
      
      // If MFA is required, return the MFA data
      if (response.mfa_required) {
        return response;
      }
      
      // Store tokens with remember flag
      if (response.access_token) {
        storeAuthTokens({
          accessToken: response.access_token,
          refreshToken: response.refresh_token
        }, credentials.remember);
      }
      
      // Check if we have user data in the response
      if (response.user) {
        setCurrentUser(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
        setIsAuthenticated(true);
      } else {
        // If not, load user data separately
        await loadUserData();
      }
      
      return response;
    } catch (error) {
      // The error should now be a safe error object from authService
      console.error('Login error:', error.message || 'Unknown error');
      
      // Set the error message directly from the error object 
      // This avoids any serialization issues
      setError(error.message || 'Login failed. Please try again.');
      
      // Rethrow the simplified error
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadUserData]);

  const register = async (userData) => {
    try {
      setError(null);
      setLoading(true);
      
      console.log('Registering user with data:', { 
        ...userData, 
        password: '***REDACTED***', 
        confirm_password: '***REDACTED***' 
      });
      
      const response = await authService.register(userData);
      return { success: true, data: response.data || response };
    } catch (error) {
      console.error('Registration error:', error);
      
      // Enhanced error handling
      let errorMessage = 'An error occurred during registration';
      const fieldErrors = {};
      
      // Remove error message references to specific email domains
      if (error.corsError || error.message?.includes('Network Error') || error.message?.includes('CORS')) {
        errorMessage = "Cannot connect to the server. This may be due to CORS restrictions or network issues.";
      }
      // Handle validation errors
      else if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        
        // Handle FastAPI validation errors (array of objects with loc, msg, type)
        if (Array.isArray(detail)) {
          // Get the location of validation errors (which fields)
          const fieldErrorMsgs = [];
          
          detail.forEach(err => {
            const fieldPath = err.loc && err.loc.length > 0 ? err.loc : [];
            // Get field name (last part of the location path)
            let fieldName = 'unknown';
            
            if (fieldPath.length > 0) {
              fieldName = fieldPath[fieldPath.length - 1];
              
              // Map backend field names to frontend field names if needed
              if (fieldName === 'confirm_password') fieldName = 'confirmPassword';
              
              // Store field-specific error
              fieldErrors[fieldName] = err.msg;
            }
            
            fieldErrorMsgs.push(`${fieldName}: ${err.msg}`);
          });
          
          errorMessage = fieldErrorMsgs.join(', ');
        } 
        // Handle string error
        else if (typeof detail === 'string') {
          errorMessage = detail;
          
          // Try to extract field information from common error messages
          if (detail.includes('Email already registered')) {
            fieldErrors.email = 'Email already registered';
          } else if (detail.includes('Student ID already registered')) {
            fieldErrors.student_id = 'Student ID already registered';
          } else if (detail.includes('password')) {
            fieldErrors.password = detail;
          }
        } 
        // Handle object error
        else if (typeof detail === 'object') {
          const errorMsgs = [];
          
          // Extract field-specific errors from object
          Object.entries(detail).forEach(([key, value]) => {
            // Map backend field names to frontend field names if needed
            let fieldName = key;
            if (fieldName === 'confirm_password') fieldName = 'confirmPassword';
            
            // Handle array of errors or single string
            if (Array.isArray(value)) {
              fieldErrors[fieldName] = value[0];
              errorMsgs.push(`${fieldName}: ${value[0]}`);
            } else if (typeof value === 'string') {
              fieldErrors[fieldName] = value;
              errorMsgs.push(`${fieldName}: ${value}`);
            }
          });
          
          errorMessage = errorMsgs.join(', ');
        }
      }
      
      setError(errorMessage);
      
      // Create enhanced error with field-specific details
      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      enhancedError.response = error.response;
      enhancedError.fieldErrors = fieldErrors;
      
      throw enhancedError;
    } finally {
      setLoading(false);
    }
  };

  // Check if user has a specific role
  const hasRole = useCallback((role) => {
    if (!currentUser || !currentUser.roles) return false;
    return currentUser.roles.includes(role);
  }, [currentUser]);

  // Check if user is admin using utility function
  const admin = useCallback(() => {
    return isUserAdmin(currentUser);
  }, [currentUser]);

  // Expose the provider value
  const value = {
    currentUser,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    refreshToken,
    loadUserData,
    forceRefreshUserData,
    hasRole,
    isAdmin: admin,
    authService,
    directLogin: authService.directLogin,
    clearError: () => setError(null)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 