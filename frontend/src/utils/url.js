/**
 * URL utility functions for handling document paths and other URLs
 */

/**
 * Gets the base server URL without the API path
 * @returns {string} The base server URL
 */
export const getBaseServerUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return apiUrl.split('/api/v1')[0];
};

/**
 * Creates a proper URL for accessing document files
 * @param {string} filePath - The file path stored in the database
 * @returns {string} The complete URL to access the file
 */
export const getDocumentUrl = (filePath) => {
  if (!filePath) return '';
  
  const baseUrl = getBaseServerUrl();
  
  // Direct access for document paths
  if (filePath.startsWith('documents/')) {
    return `${baseUrl}/${filePath}`;
  }
  
  // For legacy uploaded files in 'uploads/'
  if (filePath.startsWith('uploads/')) {
    // Remove the uploads prefix and add it back properly
    const path = filePath.replace('uploads/', '');
    return `${baseUrl}/uploads/${path}`;
  }
  
  // For any other path format
  return `${baseUrl}/${filePath}`;
};

/**
 * Fixes any URL that might have /api/v1 in it for static file access
 * @param {string} url - The original URL that might contain /api/v1
 * @returns {string} The fixed URL with /api/v1 removed
 */
export const fixStaticFileUrl = (url) => {
  if (!url) return '';
  return url.includes('/api/v1') ? url.replace('/api/v1', '') : url;
}; 