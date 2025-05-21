import { authService } from '../services/api';

/**
 * Add current user ID to profile data if not present
 * @param {Object} profileData - The profile data object
 * @returns {Promise<Object>} - Updated profile data with user ID
 */
export const ensureUserIdInProfile = async (profileData) => {
  // Return if user_id is already set
  if (profileData.user_id) {
    return profileData;
  }

  try {
    // Get current user data
    const currentUser = await authService.getCurrentUser();
    
    if (!currentUser || !currentUser.data || !currentUser.data._id) {
      throw new Error('User ID not available');
    }
    
    // Add user_id to profile data
    return {
      ...profileData,
      user_id: currentUser.data._id
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Prepare profile data for creation/update by ensuring required fields
 * @param {Object} profileData - The profile data to prepare
 * @returns {Promise<Object>} - Prepared profile data
 */
export const prepareProfileData = async (profileData) => {
  const withUserId = await ensureUserIdInProfile(profileData);
  
  // Current year for validation
  const currentYear = new Date().getFullYear();
  
  // Clean and validate specific fields
  let cleanedData = {
    ...withUserId,
    
    // Required basic fields with fallbacks
    full_name: withUserId.full_name || withUserId.name || '',
    email: withUserId.email || '',
    department: withUserId.department || 'IT Department',
    course: withUserId.course || 'Bachelor of Science in Computer Science',
    batch: withUserId.batch || '2023',
    student_id: withUserId.student_id || withUserId.studentId || '',
    
    // Ensure graduation_year is a valid integer within range
    graduation_year: typeof withUserId.graduation_year === 'string' 
      ? parseInt(withUserId.graduation_year, 10) || currentYear
      : withUserId.graduation_year || currentYear,
  };
  
  // Ensure required fields are never empty strings
  if (!cleanedData.department || cleanedData.department.trim() === '') {
    cleanedData.department = 'IT Department';
  }
  
  if (!cleanedData.course || cleanedData.course.trim() === '') {
    cleanedData.course = 'Bachelor of Science in Computer Science';
  }
  
  if (!cleanedData.batch || cleanedData.batch.trim() === '') {
    cleanedData.batch = '2023';
  }
  
  // Ensure graduation_month is valid if present
  if (cleanedData.graduation_month && 
      !["April", "September", "November"].includes(cleanedData.graduation_month)) {
    cleanedData.graduation_month = null;
  }
  
  // Format birthday properly if present
  if (cleanedData.birthday) {
    try {
      // Only extract the date part if it's not already just a date
      if (cleanedData.birthday.includes('T')) {
        cleanedData.birthday = cleanedData.birthday.split('T')[0];
      }
    } catch (e) {
      // If there's any issue, remove the field
      delete cleanedData.birthday;
    }
  }
  
  // Ensure social_media is an array
  if (!Array.isArray(cleanedData.social_media)) {
    cleanedData.social_media = [];
  }
  
  // Validate student_id format
  if (cleanedData.student_id) {
    // Remove any invalid characters
    cleanedData.student_id = cleanedData.student_id.replace(/[^A-Za-z0-9\-]/g, '');
    
    // Ensure minimum length of 5
    if (cleanedData.student_id.length < 5) {
      cleanedData.student_id = cleanedData.student_id.padEnd(5, '0');
    }
    
    // Ensure maximum length of 20
    if (cleanedData.student_id.length > 20) {
      cleanedData.student_id = cleanedData.student_id.substring(0, 20);
    }
  }
  
  return cleanedData;
}; 