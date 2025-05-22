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

  // Memoized function to load user data
  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authService.getCurrentUser();
      
      // Normalize user data to ensure consistent ID field
      const userData = response.data;
      
      // Debug log to see what we're getting from the backend
      console.log('Raw user data from backend:', userData);
      
      if (userData) {
        // Ensure we always have both _id and id available and they're the same
        if (userData._id && !userData.id) {
          userData.id = userData._id;
        } else if (userData.id && !userData._id) {
          userData._id = userData.id;
        }
        
        // Ensure field name consistency between backend and frontend
        // The backend uses snake_case (has_completed_questionnaire)
        // The frontend uses camelCase (hasCompletedQuestionnaire)
        if ('has_completed_questionnaire' in userData) {
          userData.hasCompletedQuestionnaire = userData.has_completed_questionnaire;
          console.log('Set hasCompletedQuestionnaire to:', userData.hasCompletedQuestionnaire);
        }
        
        console.log('Normalized user data:', userData);
      }
      
      setCurrentUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (error) {
      console.error('Error loading user data:', error);
      setCurrentUser(null);
      setIsAuthenticated(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Memoized function to refresh token
  const refreshToken = useCallback(async () => {
    try {
      setLoading(true);
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
      
      // Preserve the original error message from the backend
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
        throw error; // Pass the original error object with response intact
      } else {
        const errorMessage = 'An error occurred during registration';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
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

  // Update current user data
  const updateCurrentUser = useCallback(async (updatedUserData) => {
    if (!currentUser) return;
    
    // First update local state
    setCurrentUser(prevUser => ({
      ...prevUser,
      ...updatedUserData
    }));
    
    // If this is a questionnaire completion update, reload user data from server
    if (updatedUserData.hasCompletedQuestionnaire === true) {
      console.log("Questionnaire completed, reloading user data from server");
      // Reload user data from server to ensure we have the latest state
      try {
        await loadUserData();
      } catch (error) {
        console.error("Failed to reload user data after questionnaire completion:", error);
      }
    }
  }, [currentUser, loadUserData]);

  // Function to save questionnaire responses
  const submitQuestionnaire = useCallback(async (questionnaireData) => {
    try {
      setLoading(true);
      const response = await authService.submitQuestionnaire(questionnaireData);
      
      if (response.status === 200) {
        // Update the current user to reflect that they've completed the questionnaire
        await updateCurrentUser({ hasCompletedQuestionnaire: true });
        console.log("Updated user data after questionnaire submission");
      }
      
      return response;
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [updateCurrentUser]);

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
    updateCurrentUser,
    submitQuestionnaire,
    clearError: () => setError(null)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 