import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { toast } from 'react-toastify';

// Import API_URL for loading employer data
import { API_URL } from '../services/api';

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

  // Memoized function to fetch user data
  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      
      const userType = localStorage.getItem('user_type');
      let response;
      
      if (userType === 'employer') {
        // Load employer data
        response = await axios.get(`${API_URL}/employers/me`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        console.log('Loaded employer data:', response.data);
        
        // Add employer flag to user data
        const userData = {
          ...response.data,
          is_employer: true,
          roles: ['employer']
        };
        
        // Store in localStorage for later use
        localStorage.setItem('user', JSON.stringify(userData));
        setCurrentUser(userData);
        setIsAuthenticated(true);
        return userData;
      } else {
        // Regular user authentication
        response = await authService.getCurrentUser();
        
        // Process user data
        let userData = response.data;
        console.log('Loaded user data:', userData);
        
        // Store roles and admin status for easy access
        if (userData && !userData.roles) {
          userData.roles = [];
          
          if (userData.is_admin) {
            userData.roles.push('admin');
          }
          
          if (userData.is_alumni) {
            userData.roles.push('alumni');
          }
          
          if (userData.is_staff) {
            userData.roles.push('staff');
          }
          
          console.log('Set user roles:', userData.roles);
        }
        
        // Store in localStorage for later use
        localStorage.setItem('user', JSON.stringify(userData));
        setCurrentUser(userData);
        setIsAuthenticated(true);
        return userData;
      }
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

  // Function to set current user data
  const setCurrentUserData = (userData, userType = 'alumni') => {
    console.log('Setting current user data:', userData);
    console.log('User type:', userType);

    // Make sure the current user object includes the user type
    const userWithType = {
      ...userData,
      type: userType // Ensure the type property is always set
    };

    setCurrentUser(userWithType);
    setIsAuthenticated(true);
  };

  // Function to fetch user profile after successful login
  const fetchUserProfile = async (token, accountType) => {
    try {
      // Create proper auth header configuration
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      let userData;
      
      if (accountType === 'employer') {
        // Fetch employer profile
        const response = await axios.get(`${API_URL}/employers/me`, config);
        userData = {
          ...response.data,
          is_employer: true,
          roles: ['employer']
        };
      } else {
        // Fetch regular user profile using config with token
        const response = await axios.get(`${API_URL}/auth/me`, config);
        userData = response.data;
        
        // Add roles if they don't exist
        if (userData && !userData.roles) {
          userData.roles = [];
          
          if (userData.is_admin) {
            userData.roles.push('admin');
          }
          
          if (userData.is_alumni) {
            userData.roles.push('alumni');
          }
          
          if (userData.is_staff) {
            userData.roles.push('staff');
          }
        }
      }
      
      // Save user data to localStorage and state
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('user_type', accountType);
      setCurrentUserData(userData, accountType);
      return userData;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  };

  // Login function
  const login = async (email, password, isEmployer) => {
    try {
      setLoading(true);
      console.log('Login attempt with:', { email, password, isEmployer });

      // Use URLSearchParams for form-urlencoded data (OAuth2 compatible)
      const params = new URLSearchParams();
      
      // Check if email is an object (old way) or a string (new way)
      if (typeof email === 'object' && email !== null) {
        // Handle the case where first parameter is an object containing credentials
        params.append('username', email.email);
        params.append('password', email.password);
        console.log('Using object credentials:', { username: email.email });
      } else {
        // Handle the case where email and password are passed separately
        params.append('username', email);
        params.append('password', password);
        console.log('Using string credentials:', { username: email });
      }

      // Login endpoint based on account type
      const accountType = isEmployer ? 'employer' : 'alumni';
      const endpoint = accountType === 'employer' 
        ? `${API_URL}/employers/login` 
        : `${API_URL}/auth/login`;

      console.log(`Sending login request to: ${endpoint}`);
      
      // Use direct axios instance without interceptors
      const response = await axios({
        method: 'post',
        url: endpoint,
        data: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000 // 30 second timeout
      });
      
      const data = response.data;

      if (data.access_token) {
        console.log('Login successful, received token');
        
        // Store token in localStorage
        localStorage.setItem('token', data.access_token);
        
        // Store refresh token if available
        if (data.refresh_token) {
          localStorage.setItem('refreshToken', data.refresh_token);
        }
        
        // Store user type - get from response or use the account type
        const userType = data.user_type || accountType;
        localStorage.setItem('user_type', userType);
        
        // Get the user profile
        await fetchUserProfile(data.access_token, userType);
        
        // Notify success
        toast.success('Login successful!');
        return true;
      }
      
      // If we get here, something went wrong
      toast.error('Login failed: Invalid response from server');
      return false;
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle error response
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        
        // Check if this is a wrong account type error
        const errorDetail = error.response.data?.detail || '';
        
        if (errorDetail.includes('ALUMNI/STUDENT account')) {
          toast.error('This email is registered as a student/alumni account. Please select the correct account type.');
        } else if (errorDetail.includes('EMPLOYER account')) {
          toast.error('This email is registered as an employer account. Please select the correct account type.');
        } else {
          toast.error(`Login failed: ${errorDetail || 'Invalid credentials'}`);
        }
      } else {
        toast.error('Login failed: Network error or server unavailable');
      }
      
      return false;
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

  const registerEmployer = async (employerData) => {
    try {
      setError(null);
      setLoading(true);
      const response = await authService.registerEmployer(employerData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Employer registration error:', error);
      
      // Preserve the original error message from the backend
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
        throw error; // Pass the original error object with response intact
      } else {
        const errorMessage = 'An error occurred during employer registration';
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

  // Check if user is admin
  const isAdmin = useCallback(() => {
    if (!currentUser) return false;
    
    // Check if user has admin role from token roles claim
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      return currentUser.roles.includes('admin');
    }
    
    // Old method - check isAdmin flag directly
    return currentUser.isAdmin === true;
  }, [currentUser]);

  // Check if user has a specific role
  const hasRole = useCallback((role) => {
    if (!currentUser) return false;
    
    // Check from roles array
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      return currentUser.roles.includes(role);
    }
    
    // Check specific flags for known roles
    if (role === 'admin') return currentUser.isAdmin === true;
    if (role === 'employer') return currentUser.is_employer === true;
    
    return false;
  }, [currentUser]);

  const value = {
    currentUser,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    registerEmployer,
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