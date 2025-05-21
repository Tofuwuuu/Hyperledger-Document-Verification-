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
 * Formats a date string to show both date and time in Philippine time
 * @param {string} dateString - The UTC date string to format
 * @returns {string} - Formatted date and time string in Philippine time
 */
export const formatDateTimePhilippines = (dateString) => {
  return formatDatePhilippines(dateString);
}; 