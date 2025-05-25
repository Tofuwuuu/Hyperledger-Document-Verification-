// Date utility functions

/**
 * Converts a UTC date string to Philippine time (UTC+8)
 * @param {string} dateString - The UTC date string to convert
 * @returns {Date} - A Date object in Philippine time
 */
export const toPhilippineTime = (dateString) => {
  if (!dateString) return new Date();
  
  const date = new Date(dateString);
  
  // Convert to Philippine time (UTC+8)
  return new Date(date.getTime() + (8 * 60 * 60 * 1000));
};

/**
 * Formats a date string to Philippine time display format
 * @param {string} dateString - The UTC date string to format
 * @param {object} options - Date formatting options
 * @returns {string} - Formatted date string in Philippine time
 */
export const formatDatePhilippines = (dateString, options = {}) => {
  if (!dateString) return '';
  
  const phtDate = toPhilippineTime(dateString);
  
  const defaultOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Manila'
  };
  
  return phtDate.toLocaleString('en-PH', { ...defaultOptions, ...options });
};

/**
 * Formats a date string to only show the date part in Philippine time
 * @param {string} dateString - The UTC date string to format
 * @returns {string} - Formatted date string (date only) in Philippine time
 */
export const formatDateOnlyPhilippines = (dateString) => {
  return formatDatePhilippines(dateString, { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: undefined,
    minute: undefined
  });
};

/**
 * Formats a date string to the Philippines date/time format
 * @param {string} dateString - The ISO date string to format
 * @returns {string} Formatted date string
 */
export const formatDateTimePhilippines = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Error formatting date';
  }
};

/**
 * Formats a date string to a simpler date format
 * @param {string} dateString - The ISO date string to format
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Error formatting date';
  }
}; 