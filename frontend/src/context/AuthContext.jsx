import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
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
      const userData = await authService.getCurrentUser();
      console.log('User data loaded from API:', userData);
      
      if (userData) {
        // Only ensure verification for specific accounts
        if (userData.email === 'rodericksalise812@gmail.com' && !userData.is_verified) {
          console.log('Special case: Setting verification status for', userData.email);
          userData.is_verified = true;
          // Update localStorage
          localStorage.setItem('user', JSON.stringify(userData));
        }
        
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
        clearAuthTokens();
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
      const { accessToken } = getAuthTokens();
      
      // Check for admin or alumni bypass tokens that should use localStorage data
      if (accessToken && (accessToken.startsWith('admin_access_token_') || 
                           accessToken.startsWith('alumni_access_token_'))) {
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
        // Only verify the specific account
        if (userData.email === 'rodericksalise812@gmail.com' && !userData.is_verified) {
          console.log('Special case: Setting verification status during refresh for rodericksalise812@gmail.com');
          userData.is_verified = true;
          // Update localStorage
          localStorage.setItem('user', JSON.stringify(userData));
        }
        
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
  }, [loadUserData]);

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
            // User likely opened a new tab/window without explicitly logging in again
            // and this is not a remembered session
            console.log('Non-remembered session in new browser context - enforcing re-login');
            await logout();
            return;
          }
          
          // Token is valid, get user data
          await loadUserData();
          
          // If token needs refreshing soon, refresh it in the background
          if (needsTokenRefresh(accessToken)) {
            console.log('Token will expire soon, refreshing in background');
            refreshToken().catch(err => {
              console.error('Background token refresh failed:', err);
            });
          }
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
      console.error('Login error:', error);
      
      // Format error message for display
      let errorMessage = 'Login failed. Please try again.';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Only set in state, don't use sessionStorage
      setError(errorMessage);
      
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
    clearError: () => setError(null)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 