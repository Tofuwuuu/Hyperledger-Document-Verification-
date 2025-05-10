import { jwtDecode } from 'jwt-decode';

/**
 * Validates a JWT token
 * @param {string} token - JWT token to validate
 * @returns {Object} - Object with isValid and payload properties
 */
export const validateToken = (token) => {
  if (!token) {
    return { isValid: false, payload: null };
  }

  try {
    const payload = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    
    // Check if token is expired
    if (payload.exp < currentTime) {
      return { isValid: false, payload, isExpired: true };
    }
    
    return { isValid: true, payload };
  } catch (error) {
    console.error('Token validation error:', error);
    return { isValid: false, payload: null, error };
  }
};

/**
 * Checks if the current session is remembered
 * @returns {boolean} - Whether the session is remembered
 */
export const isRememberedSession = () => {
  return localStorage.getItem('remember_auth') === 'true';
};

/**
 * Checks if the current session is temporary
 * @returns {boolean} - Whether the session is temporary
 */
export const isTemporarySession = () => {
  return sessionStorage.getItem('temp_auth') === 'true';
};

/**
 * Gets authentication tokens from storage
 * @returns {Object} - Object with accessToken and refreshToken
 */
export const getAuthTokens = () => {
  return {
    accessToken: localStorage.getItem('token'),
    refreshToken: localStorage.getItem('refresh_token')
  };
};

/**
 * Stores authentication tokens in storage
 * @param {Object} tokens - Object with accessToken and refreshToken
 * @param {boolean} remember - Whether to remember the session
 */
export const storeAuthTokens = (tokens, remember = false) => {
  if (!tokens) return;

  const { accessToken, refreshToken } = tokens;
  
  if (accessToken) {
    localStorage.setItem('token', accessToken);
  }
  
  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken);
  }
  
  if (remember) {
    localStorage.setItem('remember_auth', 'true');
    sessionStorage.removeItem('temp_auth');
  } else {
    sessionStorage.setItem('temp_auth', 'true');
    localStorage.removeItem('remember_auth');
  }
};

/**
 * Clears all authentication tokens and session data
 */
export const clearAuthTokens = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('remember_auth');
  localStorage.removeItem('csrf_token');
  sessionStorage.removeItem('temp_auth');
  sessionStorage.removeItem('redirectAfterLogin');
};

/**
 * Determines if a user is an admin based on the token or user data
 * @param {Object} user - User object
 * @returns {boolean} - Whether the user is an admin
 */
export const isUserAdmin = (user) => {
  // Check token first
  const token = localStorage.getItem('token');
  if (token && token.startsWith('admin_access_token_')) {
    return true;
  }
  
  // Then check user data
  return user?.is_admin || false;
};

/**
 * Check token validity and decide if it needs refresh
 * @param {string} token - JWT token to check
 * @returns {boolean} - Whether the token needs refresh
 */
export const needsTokenRefresh = (token) => {
  if (!token) return false;
  
  try {
    const payload = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    
    // Consider refreshing if token expires in the next 5 minutes
    const refreshThreshold = 300; // 5 minutes in seconds
    return payload.exp < (currentTime + refreshThreshold);
  } catch (error) {
    console.error('Token refresh check error:', error);
    return true; // If we can't decode the token, better refresh it
  }
}; 