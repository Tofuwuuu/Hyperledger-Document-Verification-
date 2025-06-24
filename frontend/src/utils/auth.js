/**
 * Authentication utilities for working with JWT tokens
 */

/**
 * Get the current authentication token from localStorage
 * @returns {string|null} The JWT token or null if not available
 */
export const getAuthToken = () => {
  return localStorage.getItem('token');
};

/**
 * Check if the user is currently authenticated
 * @returns {boolean} True if the user is authenticated
 */
export const isAuthenticated = () => {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    // Basic check for token expiration
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    const currentTime = Date.now() / 1000;
    
    return payload.exp > currentTime;
  } catch (error) {
    console.error('Error parsing token:', error);
    return false;
  }
};

/**
 * Get the current user's roles from localStorage
 * @returns {Array} Array of role names
 */
export const getUserRoles = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    return user?.roles || [];
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
};

/**
 * Check if the current user has a specific role
 * @param {string} role The role to check
 * @returns {boolean} True if the user has the role
 */
export const hasRole = (role) => {
  const roles = getUserRoles();
  return roles.includes(role);
}; 