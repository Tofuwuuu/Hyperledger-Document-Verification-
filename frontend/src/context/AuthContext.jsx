import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
import { jwtDecode } from 'jwt-decode';

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

  // Load user data from API or localStorage for admin bypass
  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check if we're using the admin bypass
      const token = localStorage.getItem('token');
      if (token && token.startsWith('admin_access_token_')) {
        // This is a mock admin token from our bypass
        const adminUser = JSON.parse(localStorage.getItem('user'));
        if (adminUser && adminUser.is_admin) {
          console.log('Using admin bypass user data');
          setCurrentUser(adminUser);
          setIsAuthenticated(true);
          return adminUser;
        }
      }
      
      // Normal API flow for regular users
      const response = await authService.getCurrentUser();
      const userData = response.data;
      
      setCurrentUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (error) {
      console.error('Error loading user data:', error);
      setCurrentUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Memoized function to refresh token
  const refreshToken = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check if we're using admin bypass
      const token = localStorage.getItem('token');
      if (token && token.startsWith('admin_access_token_')) {
        console.log('Admin bypass token - no need to refresh');
        await loadUserData();
        return true;
      }
      
      // Normal token refresh for regular users
      await authService.refreshToken();
      await loadUserData();
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      logout();
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadUserData]);

  // Check authentication status on initial load
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      // Check if we're using admin bypass
      if (token && token.startsWith('admin_access_token_')) {
        console.log('Using admin bypass token - skipping JWT validation');
        // Skip validation for admin bypass tokens
        await loadUserData();
        setLoading(false);
        return;
      }
      
      try {
        // Check if token is expired
        const decodedToken = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        
        if (decodedToken.exp < currentTime) {
          // Token is expired, try to refresh
          const success = await refreshToken();
          if (!success) {
            setCurrentUser(null);
            setIsAuthenticated(false);
          }
        } else {
          // Token is valid, get user data
          await loadUserData();
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setCurrentUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, [loadUserData, refreshToken]);

  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      const data = await authService.login(email, password);
      const userData = await loadUserData();
      setIsAuthenticated(true);
      return { success: true, data, user: userData };
    } catch (error) {
      console.error('Login error:', error);
      
      // Enhanced error handling
      let errorMessage = 'An error occurred during login';
      
      // Check for response data
      if (error.response) {
        console.log('Error response status:', error.response.status);
        console.log('Error response data:', error.response.data);
        
        // Handle different error formats
        if (error.response.data) {
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.detail) {
            errorMessage = error.response.data.detail;
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          } else if (error.response.data.error) {
            errorMessage = error.response.data.error;
          } else if (error.response.data.non_field_errors) {
            // Django REST framework often returns errors this way
            errorMessage = error.response.data.non_field_errors[0];
          }
        }
        
        // Specific status code handling
        if (error.response.status === 401) {
          errorMessage = 'Invalid email or password';
        } else if (error.response.status === 403) {
          errorMessage = 'Account is inactive or blocked';
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'No response from server. Please check your connection.';
      } else if (error.message) {
        // Something else happened while setting up the request
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      // Rethrow with enhanced error object
      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      enhancedError.response = error.response;
      throw enhancedError;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      setLoading(true);
      const response = await authService.register(userData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Registration error:', error);
      
      // Enhanced error handling
      let errorMessage = 'An error occurred during registration';
      
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        
        // Handle FastAPI validation errors (array of objects with loc, msg, type)
        if (Array.isArray(detail)) {
          errorMessage = detail.map(err => err.msg).join(', ');
        } 
        // Handle string error
        else if (typeof detail === 'string') {
          errorMessage = detail;
        } 
        // Handle object error
        else if (typeof detail === 'object') {
          errorMessage = Object.values(detail).join(', ');
        }
      }
      
      setError(errorMessage);
      throw new Error(errorMessage); // Throw formatted error
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setCurrentUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  // Check if user has a specific role
  const hasRole = useCallback((role) => {
    if (!currentUser || !currentUser.roles) return false;
    return currentUser.roles.includes(role);
  }, [currentUser]);

  // Check if user is admin
  const isAdmin = useCallback(() => {
    if (!currentUser) return false;
    return currentUser.is_admin === true;
  }, [currentUser]);

  const value = {
    currentUser,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    refreshToken,
    hasRole,
    isAdmin,
    clearError: () => setError(null)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 