// Profile picture and profile caching helpers (localStorage), plus API response normalizing.
import { buildDashboardProfileData } from '../../../utils/dashboard-profile-schema';

// Utility function to get the correct image URL
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  
  // Check if the image is already a complete URL (cloud storage or data URL)
  if (imagePath.startsWith('http://') || 
      imagePath.startsWith('https://') || 
      imagePath.startsWith('data:image/')) {
    return imagePath;
  }
  
  const timestamp = new Date().getTime();
  
  // Handle different path formats
  let formattedPath = imagePath;
  if (imagePath.startsWith('/')) {
    formattedPath = imagePath.substring(1);
  }
  
  // Relative to the current origin (same-origin deployments).
  const relativeUrl = `/${formattedPath}?t=${timestamp}`;
  return relativeUrl;
};

// Utility functions for localStorage image handling
export const storeImageInLocalStorage = (userId, imageFile) => {
  return new Promise((resolve, reject) => {
    if (!imageFile || !userId) {
      reject('Missing image file or user ID');
      return;
    }
    
    // Check file size before processing
    const fileSizeMB = imageFile.size / (1024 * 1024);
    
    if (fileSizeMB > 4) {
      console.warn('Image is larger than 4MB, it may not store correctly in localStorage');
      // Consider resizing the image here in a production app
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        // The specific key used for localStorage
        const imageKey = `profile_picture_${userId}`;
        
        // Store the image with a fixed key pattern
        localStorage.setItem(imageKey, reader.result);
        
        // Verify storage worked
        const storedData = localStorage.getItem(imageKey);
        if (storedData && storedData.length > 0) {
          resolve(reader.result);
        } else {
          console.error('Failed to verify localStorage data after storing');
          reject('Storage verification failed');
        }
      } catch (error) {
        console.error('Error storing image in localStorage:', error);
        // This likely means the image is too large for localStorage
        if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
          console.error('localStorage quota exceeded - image too large');
        }
        reject(error);
      }
    };
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      reject(error);
    };
    
    // Read the image file as a data URL (Base64)
    reader.readAsDataURL(imageFile);
  });
};

export const getImageFromLocalStorage = (userId) => {
  if (!userId) {
    console.error('Cannot get image from localStorage: No user ID provided');
    return null;
  }
  
  // Use the same key pattern as when storing
  const imageKey = `profile_picture_${userId}`;
  
  try {
    const imageData = localStorage.getItem(imageKey);
    
    if (imageData) {
      
      // Verify it's a valid data URL
      if (imageData.startsWith('data:image/')) {
        return imageData;
      } else {
        console.error('Retrieved data is not a valid image data URL');
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving image from localStorage:', error);
    return null;
  }
};

const getProfileStorageKey = (userId) => `alumni_profile_${userId}`;

export const storeProfileLocally = (userId, profileData) => {
  if (!userId) return;

  try {
    localStorage.setItem(getProfileStorageKey(userId), JSON.stringify(profileData));
  } catch (error) {
    console.error('Error storing alumni profile in localStorage:', error);
  }
};

export const getStoredProfile = (userId) => {
  if (!userId) return null;

  try {
    const profileData = localStorage.getItem(getProfileStorageKey(userId));
    return profileData ? JSON.parse(profileData) : null;
  } catch (error) {
    console.error('Error reading alumni profile from localStorage:', error);
    return null;
  }
};

export const normalizeProfileResponse = (responseData, fallbackData = {}) => {
  const responseProfile = responseData?.profile || (!responseData?.success ? responseData : {});
  const profileId = responseProfile?.id || responseProfile?._id || responseData?.id || fallbackData?.id;

  return buildDashboardProfileData({
    ...fallbackData,
    ...responseProfile,
    id: profileId,
    graduation_year: (responseProfile?.graduation_year || fallbackData?.graduation_year)
      ? String(responseProfile?.graduation_year || fallbackData?.graduation_year)
      : ''
  });
};
