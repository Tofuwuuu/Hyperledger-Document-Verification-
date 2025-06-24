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
  
  // Ensure required fields are never empty strings and meet minimum length requirements
  if (!cleanedData.department || cleanedData.department.trim() === '' || cleanedData.department.length < 2) {
    cleanedData.department = 'IT Department';
  }
  
  if (!cleanedData.course || cleanedData.course.trim() === '' || cleanedData.course.length < 2) {
    cleanedData.course = 'Bachelor of Science in Computer Science';
  }
  
  if (!cleanedData.batch || cleanedData.batch.trim() === '' || cleanedData.batch.length < 2) {
    cleanedData.batch = '2023';
  }

  if (!cleanedData.full_name || cleanedData.full_name.trim() === '' || cleanedData.full_name.length < 2) {
    throw new Error('Full name is required and must be at least 2 characters');
  }
  
  // Validate student_id format
  if (!cleanedData.student_id || cleanedData.student_id.length < 5) {
    // If student_id is missing or too short, create a default valid one
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    cleanedData.student_id = `S${randomDigits}`;
  } else {
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

  // Ensure graduation_year is within valid range (1948 to current year)
  if (cleanedData.graduation_year < 1948 || cleanedData.graduation_year > currentYear) {
    cleanedData.graduation_year = currentYear;
  }
  
  // Ensure graduation_month is valid if present
  if (cleanedData.graduation_month) {
    // Make sure it's one of the allowed values
    if (!["April", "September", "November"].includes(cleanedData.graduation_month)) {
      console.warn('Invalid graduation month:', cleanedData.graduation_month);
      cleanedData.graduation_month = null;
    } else {
      console.log('Valid graduation month:', cleanedData.graduation_month);
    }
  }
  
  // REMOVE birthday field completely to avoid validation errors
// We'll implement this in the future when the exact format is determined
delete cleanedData.birthday;
console.log('Removed birthday field from profile data');

// Ensure address doesn't exceed 200 characters (FastAPI validation limit)
if (cleanedData.address && cleanedData.address.length > 200) {
  console.warn('Address exceeds 200 characters limit, truncating to 200 characters');
  cleanedData.address = cleanedData.address.substring(0, 200);
}
  
  // Ensure social_media is an array
  if (!Array.isArray(cleanedData.social_media)) {
    cleanedData.social_media = [];
  }

  // Ensure phone number format is valid
  if (cleanedData.phone) {
    // Keep only digits and the + sign at the beginning
    const phoneDigits = cleanedData.phone.replace(/[^\d+]/g, '');
    if (phoneDigits.length < 8) {
      // Invalid phone number, remove it
      cleanedData.phone = null;
    } else {
      // Ensure it starts with a + if international format
      cleanedData.phone = phoneDigits;
    }
  }
  
  // Format achievements as array of objects with title property
  if (cleanedData.achievements) {
    if (typeof cleanedData.achievements === 'string') {
      if (cleanedData.achievements.trim()) {
        cleanedData.achievements = cleanedData.achievements
          .split(',')
          .map(item => ({ title: item.trim() }));
      } else {
        cleanedData.achievements = [];
      }
    } else if (Array.isArray(cleanedData.achievements)) {
      cleanedData.achievements = cleanedData.achievements
        .filter(item => item && (typeof item === 'string' || item.title))
        .map(item => typeof item === 'string' ? { title: item.trim() } : item);
    } else {
      cleanedData.achievements = [];
    }
  } else {
    cleanedData.achievements = [];
  }

  // Format work_awards properly
  if (cleanedData.work_awards) {
    if (typeof cleanedData.work_awards === 'string') {
      cleanedData.work_awards = cleanedData.work_awards.trim()
        ? [{ title: cleanedData.work_awards.trim() }]
        : [];
    } else if (Array.isArray(cleanedData.work_awards)) {
      cleanedData.work_awards = cleanedData.work_awards
        .filter(item => item && (typeof item === 'string' || item.title))
        .map(item => typeof item === 'string' ? { title: item.trim() } : item);
    } else {
      cleanedData.work_awards = [];
    }
  } else {
    cleanedData.work_awards = [];
  }

  // Ensure competencies_from_college is a properly formatted array
  if (cleanedData.competencies_from_college) {
    if (typeof cleanedData.competencies_from_college === 'string') {
      cleanedData.competencies_from_college = cleanedData.competencies_from_college.trim()
        ? [cleanedData.competencies_from_college.trim()]
        : [];
    } else if (Array.isArray(cleanedData.competencies_from_college)) {
      cleanedData.competencies_from_college = cleanedData.competencies_from_college
        .filter(item => item && typeof item === 'string')
        .map(item => item.trim());
    } else {
      cleanedData.competencies_from_college = [];
    }
  } else {
    cleanedData.competencies_from_college = [];
  }

  // Ensure degree_reasons is a properly formatted array
  if (cleanedData.degree_reasons) {
    if (typeof cleanedData.degree_reasons === 'string') {
      cleanedData.degree_reasons = cleanedData.degree_reasons.trim()
        ? [cleanedData.degree_reasons.trim()]
        : [];
    } else if (Array.isArray(cleanedData.degree_reasons)) {
      cleanedData.degree_reasons = cleanedData.degree_reasons
        .filter(item => item && typeof item === 'string')
        .map(item => item.trim());
    } else {
      cleanedData.degree_reasons = [];
    }
  } else {
    cleanedData.degree_reasons = [];
  }

  // Ensure csc_year is a proper integer or null
  if (cleanedData.csc_year) {
    const year = parseInt(cleanedData.csc_year, 10);
    cleanedData.csc_year = !isNaN(year) ? year : null;
    
    // Validate the year range
    if (cleanedData.csc_year !== null && 
        (cleanedData.csc_year < 1948 || cleanedData.csc_year > currentYear)) {
      cleanedData.csc_year = null;
    }
  } else {
    cleanedData.csc_year = null;
  }

  // Ensure employment-related fields are properly formatted
  if (typeof cleanedData.is_first_job !== 'boolean') {
    cleanedData.is_first_job = false;
  }

  if (typeof cleanedData.first_job_related !== 'boolean') {
    cleanedData.first_job_related = false;
  }

  if (typeof cleanedData.csc_passer !== 'boolean') {
    cleanedData.csc_passer = false;
  }

  // Ensure stay_reasons is an array
  if (cleanedData.stay_reasons) {
    if (typeof cleanedData.stay_reasons === 'string') {
      cleanedData.stay_reasons = cleanedData.stay_reasons.trim()
        ? [cleanedData.stay_reasons.trim()]
        : [];
    } else if (!Array.isArray(cleanedData.stay_reasons)) {
      cleanedData.stay_reasons = [];
    }
  } else {
    cleanedData.stay_reasons = [];
  }

  // Set optional fields to null if empty
  if (!cleanedData.sex) cleanedData.sex = null;
  if (!cleanedData.civil_status) cleanedData.civil_status = null;
  if (!cleanedData.region_of_origin) cleanedData.region_of_origin = null;
  
  // Update social media URLs to ensure they have http/https
  if (cleanedData.social_media && cleanedData.social_media.length > 0) {
    cleanedData.social_media = cleanedData.social_media.map(sm => {
      let url = sm.url;
      if (url && !url.startsWith('http')) {
        url = `https://${url}`;
      }
      return { ...sm, url };
    });
  }
  
  return cleanedData;
}; 