import { authService } from '../services/api';
import { buildDashboardProfileData } from './dashboard-profile-schema';

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
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUser = await authService.getCurrentUser().catch(() => null);
    const resolvedUser = currentUser?.data || currentUser || storedUser;
    const resolvedUserId = resolvedUser?._id || resolvedUser?.id;

    if (!resolvedUserId) {
      console.error('Cannot get current user ID');
      throw new Error('User ID not available. Please log in again.');
    }

    return {
      ...profileData,
      user_id: resolvedUserId
    };
  } catch (error) {
    console.error('Error ensuring user ID in profile data:', error);
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
  
  return buildDashboardProfileData({
    ...withUserId,
    // Note: name and email are handled separately from the alumni profile schema
    full_name: withUserId.full_name || withUserId.name || '',
    email: withUserId.email || '',
    student_id: withUserId.student_id || withUserId.studentId || '',
    graduation_year: withUserId.graduation_year ? String(withUserId.graduation_year) : ''
  });
}; 
