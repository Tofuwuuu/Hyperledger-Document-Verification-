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

  // Define loadUserData at component level with useCallback
  const loadUserData = useCallback(async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      setLoading(false);
      setCurrentUser(null);
      setIsAuthenticated(false);
      return null;
    }
    
    setLoading(true);
    try {
      console.log('Loading user data from API or local storage');
      
      // Check for admin or alumni bypass tokens that should use localStorage data instead of API calls
      if (token.startsWith('admin_access_token_') || token.startsWith('alumni_access_token_')) {
        console.log('Using bypass token - skipping API call and using localStorage data');
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (userData && userData.email) {
          console.log('User data loaded from localStorage:', userData);
          setCurrentUser(userData);
          setIsAuthenticated(true);
          return userData;
        } else {
          console.error('No valid user data found in localStorage for bypass token');
          setCurrentUser(null);
          setIsAuthenticated(false);
          return null;
        }
      }
      
      // For regular tokens, use API call
      const userData = await authService.getCurrentUser();
      console.log('User data loaded from API:', userData);
      
      if (userData) {
        setCurrentUser(userData);
        setIsAuthenticated(true);
        // Store user in local storage for persistence
        localStorage.setItem('user', JSON.stringify(userData));
        return userData;
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        return null;
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setCurrentUser(null);
      setIsAuthenticated(false);
      // Clean up storage on auth error
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // New function: Force refresh user data
  const forceRefreshUserData = useCallback(async () => {
    console.log('Force refreshing user data from API');
    try {
      const token = localStorage.getItem('token');
      
      // Check for admin or alumni bypass tokens that should use localStorage data
      if (token && (token.startsWith('admin_access_token_') || token.startsWith('alumni_access_token_'))) {
        console.log('Using bypass token - skipping API call for force refresh');
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (userData && userData.email) {
          console.log('Ensuring bypass user data has verified flag set to true');
          // Make sure is_verified is set to true for bypass tokens
          if (!userData.is_verified) {
            userData.is_verified = true;
            localStorage.setItem('user', JSON.stringify(userData));
          }
          
          setCurrentUser(userData);
          setIsAuthenticated(true);
          return userData;
        } else {
          console.error('No valid user data found in localStorage for bypass token');
          return null;
        }
      }
      
      // For regular tokens, use the aggressive reload
      const userData = await authService.reloadUserWithFreshData();
      
      if (userData) {
        setCurrentUser(userData);
        setIsAuthenticated(true);
        return userData;
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        return null;
      }
    } catch (error) {
      console.error('Error during force refresh:', error);
      return null;
    }
  }, []);

  // Load user data on initial render
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

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
    const token = localStorage.getItem('token');
    
    // Special case: If we're using admin bypass, always return true for admin check
    if (token && token.startsWith('admin_access_token_')) {
      return true;
    }
    
    // Normal check based on user data
    return currentUser?.is_admin || false;
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
    isAdmin: () => currentUser?.is_admin === true,
    refreshToken,
    loadUserData,
    forceRefreshUserData,
    hasRole,
    isAdmin,
    clearError: () => setError(null)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 