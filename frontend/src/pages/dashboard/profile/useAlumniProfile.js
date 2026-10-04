import { useState, useEffect } from 'react';
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import api, { alumniService, referenceService } from '../../../services/api';
import { buildDashboardProfileData } from '../../../utils/dashboard-profile-schema';
import {
  getImageUrl,
  storeImageInLocalStorage,
  getImageFromLocalStorage,
  storeProfileLocally,
  getStoredProfile,
  normalizeProfileResponse,
} from './profileStorage';

// State, loading, saving, and picture upload for the signed-in alumni profile page.
export default function useAlumniProfile() {
  const { currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [initialProfile, setInitialProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [profile, setProfile] = useState(() => buildDashboardProfileData());
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [, setInfoMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  // Never filled in, so FieldError renders nothing (kept as-is: no behavior change).
  const [validationErrors] = useState({});
  const [courses, setCourses] = useState([]);
  const [, setErrors] = useState({});
  const [, setCompletionPercentage] = useState(0);
  const [, setMissingFields] = useState(0);

  useEffect(() => {
    fetchAlumniProfile();
    fetchCVSUCourses();
  }, [currentUser]);

  // Update the useEffect for the profile picture to also check localStorage
  useEffect(() => {
    // First check if we have the image in localStorage
    if (profile.user_id) {
      try {
        const localStorageImage = getImageFromLocalStorage(profile.user_id);
        
        if (localStorageImage) {
          setPreviewUrl(localStorageImage);
          return;
        }
      } catch (error) {
        console.error('Error in localStorage image handling:', error);
      }
    }
    
    // Fall back to the regular path-based approach
    if (profile.profile_picture) {
      const imageUrl = getImageUrl(profile.profile_picture);
      setPreviewUrl(imageUrl);
    } else {
      setPreviewUrl('');
    }
  }, [profile.profile_picture, profile.user_id]);

  const fetchAlumniProfile = async () => {
    if (!currentUser) return;
    setErrorMessage('');
    
    // Debug user info
    if (!currentUser.id && !currentUser._id) {
      console.error('User ID is undefined in current user object:', currentUser);
      setErrorMessage('User ID not found. Please try logging out and logging in again.');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Use _id as fallback if id is not present
      const userId = currentUser.id || currentUser._id;
      const localProfile = getStoredProfile(userId);
      
      // Check if user has a profile
      const response = await alumniService.getAlumniByUserId(userId);
      
      // Check if this is a 404 response (no profile exists)
      if (response.status === 404 || !response.data) {
        if (localProfile) {
          const normalizedLocalProfile = buildDashboardProfileData(localProfile);
          setProfile(normalizedLocalProfile);
          setInitialProfile(normalizedLocalProfile);
          calculateCompletionPercentage(normalizedLocalProfile);
          setLoading(false);
          return;
        }

        createEmptyProfile(userId);
        return;
      }
      
      const alumniData = response.data;
      
      // Update profile state with fetched data
      setProfile(buildDashboardProfileData({
        ...alumniData,
        id: alumniData._id,
        graduation_year: alumniData.graduation_year ? String(alumniData.graduation_year) : ''
      }));
      
      // Also update initialProfile state
      setInitialProfile(buildDashboardProfileData({
        ...alumniData,
        id: alumniData._id,
        graduation_year: alumniData.graduation_year ? String(alumniData.graduation_year) : ''
      }));
      
      // Handle profile picture
      if (alumniData.profile_picture) {
        const imageUrl = getImageUrl(alumniData.profile_picture);
        setPreviewUrl(imageUrl);
      } else {
        // Check if we have it in localStorage as fallback
        if (alumniData.user_id) {
          const localImage = getImageFromLocalStorage(alumniData.user_id);
          if (localImage) {
            setPreviewUrl(localImage);
          } else {
            setPreviewUrl('');
          }
        } else {
          setPreviewUrl('');
        }
      }
      
      // Update completion percentage
      calculateCompletionPercentage(alumniData);
      // Ensure loading state is cleared after successful fetch
      setLoading(false);
      
    } catch (error) {
      console.error('Error fetching alumni profile:', error);
      
      const userId = currentUser.id || currentUser._id;
      const localProfile = getStoredProfile(userId);

      if (localProfile) {
        const normalizedLocalProfile = buildDashboardProfileData(localProfile);
        setProfile(normalizedLocalProfile);
        setInitialProfile(normalizedLocalProfile);
        calculateCompletionPercentage(normalizedLocalProfile);
        setLoading(false);
        return;
      }

      createEmptyProfile(userId);
    }
  };
  
  // Helper function to create an empty profile with user data
  const createEmptyProfile = (userId) => {
        // Make sure we have a valid user ID before proceeding
        if (!userId) {
          console.error('Cannot create profile without user_id');
          setErrorMessage('User ID is missing. Please try logging out and logging in again.');
          setLoading(false);
          return;
        }

        const localProfile = getStoredProfile(userId);
        if (localProfile) {
          const normalizedLocalProfile = buildDashboardProfileData(localProfile);
          setProfile(normalizedLocalProfile);
          setInitialProfile(normalizedLocalProfile);
          setIsEditing(true);
          setLoading(false);
          return;
        }
        
        // Create a new profile with the current user data and empty fields
    const newProfile = buildDashboardProfileData({
          user_id: userId, // Set the user_id explicitly
          full_name: currentUser.full_name || '',
          student_id: currentUser.student_id || '',
          email: currentUser.email || '',
          department: '',
      graduation_year: currentUser.graduation_year ? String(currentUser.graduation_year) : '',
    });
    
    setProfile(newProfile);
    setInitialProfile(newProfile);
    setIsEditing(true); // Start in edit mode for new profiles
      setLoading(false);
    
    // Show helpful message
    setInfoMessage('Please complete your alumni profile information.');
  };

  // Fetch CVSU courses
  const fetchCVSUCourses = async () => {
    try {
      const response = await referenceService.getCVSUCourses();
      const courseItems = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.items)
          ? response.data.items
          : [];
      setCourses(courseItems);
    } catch (error) {
      console.error('Error fetching CVSU courses:', error);
      // Fallback to hardcoded courses if API fails
      setCourses([
        "Bachelor of Science in Information Technology",
        "Bachelor of Science in Computer Science",
        "Bachelor of Science in Accountancy",
        "Bachelor of Science in Accounting Information System",
        "Bachelor of Science in Management Accounting",
        "Bachelor of Science in Business Administration",
        "Bachelor of Science in Entrepreneurship",
        "Bachelor of Secondary Education",
        "Bachelor of Science in Hospitality Management",
        "Bachelor of Science in Tourism Management",
        "Bachelor of Science in Psychology",
        "Bachelor of Arts in Communication",
        "Bachelor of Industrial Technology",
        "Bachelor of Technical-Vocational Teacher Education"
      ]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile({ ...profile, [name]: value });
  };

  const getFieldValue = (value) => value ?? '';

  const handleSocialMediaChange = (index, field, value) => {
    const updatedSocialMedia = [...profile.social_media];
    
    if (!updatedSocialMedia[index]) {
      updatedSocialMedia[index] = { platform: '', url: '' };
    }
    
    updatedSocialMedia[index][field] = value;
    
    setProfile(prevProfile => ({
      ...prevProfile,
      social_media: updatedSocialMedia
    }));
  };

  const addSocialMedia = () => {
    setProfile(prevProfile => ({
      ...prevProfile,
      social_media: [...(prevProfile.social_media || []), { platform: '', url: '' }]
    }));
  };

  const removeSocialMedia = (index) => {
    setProfile(prevProfile => ({
      ...prevProfile,
      social_media: prevProfile.social_media.filter((_, i) => i !== index)
    }));
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setProfilePicture(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Now update the uploadProfilePicture function to store in localStorage
  const uploadProfilePicture = async (alumniId = profile.id) => {
    if (!profilePicture || !alumniId) {
      console.error('Cannot upload: missing profile picture or profile ID');
      return;
    }
    
    if (!profile.user_id) {
      console.error('Cannot upload: missing user_id for localStorage');
      setErrorMessage('Missing user ID for storage. Please try again.');
      return;
    }
    
    
    setIsUploading(true);
    try {
      // First, store the image in localStorage
      const base64Image = await storeImageInLocalStorage(profile.user_id, profilePicture);
      
      // Use the Base64 data directly as the image source
      setPreviewUrl(base64Image);
      
      // Now try to also save it via the API if available
      try {
        const response = await alumniService.uploadProfilePicture(alumniId, profilePicture);
        
        // Update the profile state with the path from the API response
        if (response && response.data && response.data.profile_picture) {
          setProfile(prevProfile => ({
            ...prevProfile,
            profile_picture: response.data.profile_picture
          }));
          
          if (initialProfile) {
            setInitialProfile(prevInitialProfile => ({
              ...prevInitialProfile,
              profile_picture: response.data.profile_picture
            }));
          }
        }
      } catch (apiError) {
        console.error('Could not save to API, but image is saved in localStorage:', apiError);
        // It's okay if this fails as we already have the image in localStorage
      }
      
      setSuccessMessage('Profile picture updated successfully!');
      // Reset the file input
      setProfilePicture(null);
    } catch (error) {
      console.error('Error processing profile picture:', error);
      setErrorMessage('Failed to save profile picture. Image may be too large (max ~5MB). Please try a smaller image file.');
    } finally {
      setIsUploading(false);
    }
  };

  const startEditing = () => {
    setIsEditing(true);
    setSuccessMessage('');
    setErrorMessage('');
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSuccessMessage('');
    setErrorMessage('');
    
    // Reset form to original data
    if (initialProfile) {
      setProfile(initialProfile);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    
    // Validate only fields that were actually filled in or changed.
    if (!validateForm()) {
      toast.error('Please fix the invalid fields and try again.');
      setLoading(false);
      return;
    }
      
    try {
      // Create a copy of profile data for the API call
      const profileData = { ...profile };
      
      if (profileData.graduation_year) {
        profileData.graduation_year = String(profileData.graduation_year).trim();
      }
      
      // Format birthday correctly to prevent timezone issues
      if (profileData.birthday) {
        // Just use the date portion (YYYY-MM-DD)
        profileData.birthday = profileData.birthday.split('T')[0];
      }
      
      // Remove empty values to prevent validation issues
      Object.keys(profileData).forEach(key => {
        if (profileData[key] === '' || profileData[key] === null || profileData[key] === undefined) {
          delete profileData[key];
        }
      });

      const userId = profileData.user_id || currentUser?.id || currentUser?._id;
      const isSimpleAuth = localStorage.getItem('simple_auth') === 'true';
      
      let response;
      
      // If there's no ID, this is a new profile that needs to be created
      if (!profileData.id) {
        
        // First check if profile already exists for this user
        try {
          const checkResponse = await alumniService.getAlumniByUserId(profileData.user_id);
          
          if (checkResponse && checkResponse.data && checkResponse.status !== 404) {
            
            // Set profile ID and update instead of creating
            profileData.id = checkResponse.data._id || checkResponse.data.id;
            
            // Use the update endpoint instead
            response = await alumniService.updateProfile(profileData);
          } else {
            // No existing profile found, proceed with creation
            try {
              // Try using the reliable endpoint first
              response = await alumniService.createProfileReliable(profileData);
            } catch (reliableError) {
              console.error('Error with reliable endpoint:', reliableError);
              
              // If the error indicates profile already exists, try to fetch and update
              if (reliableError.message?.includes('already exists')) {
                try {
                  const existingProfile = await alumniService.getAlumniByUserId(profileData.user_id);
                  
                  if (existingProfile && existingProfile.data) {
                    // Update the existing profile
                    profileData.id = existingProfile.data._id || existingProfile.data.id;
                    response = await alumniService.updateProfile(profileData);
                    toast.info('Updated your existing profile');
                  } else {
                    throw new Error('Could not find your existing profile');
                  }
                } catch (fetchError) {
                  console.error('Error fetching existing profile:', fetchError);
                  throw new Error('Profile may already exist, but could not access it');
                }
              } else {
                // Try standard endpoint with error handling for 405
                try {
                  response = await api.post('/alumni', profileData);
                } catch (standardError) {
                  if (standardError.response?.status === 405) {
                    console.warn('Received 405 from standard endpoint, falling back to reliable endpoint again');
                    // Final attempt with reliable endpoint
                    response = await alumniService.createProfileReliable(profileData);
                  } else {
                    // Re-throw if it's not a 405 error
                    throw standardError;
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error creating profile:', error);
          console.error('Error details:', error.response?.data);

          if (error.response?.status === 401 && isSimpleAuth) {
            const localProfile = buildDashboardProfileData({
              ...initialProfile,
              ...profileData,
              user_id: userId
            });
            storeProfileLocally(userId, localProfile);
            setProfile(localProfile);
            setInitialProfile(localProfile);
            calculateCompletionPercentage(localProfile);
            setIsEditing(false);
            toast.success('Profile saved on this device');
            setLoading(false);
            return;
          }
          
          // Special handling for network errors
          if (error.message?.includes('Network Error')) {
            toast.error('Network error: Please check your internet connection and try again.');
          } else if (error.response?.status === 405) {
            toast.error('API configuration error: Please contact support.');
          } else {
            toast.error(`Failed to create profile: ${error.message || 'Unknown error'}`);
          }
          
          setLoading(false);
          return;
        }
      } else {
        // This is an existing profile that needs to be updated
        
        try {
          // Try direct API call first
          response = await api.put(`/alumni/${profileData.id}/simple`, profileData);
        } catch (directError) {
          console.error('Error with simple update endpoint:', directError);
          // Fall back to the service method
        response = await alumniService.updateProfile(profileData);
        }
      }

      // Update the local profile state with the response data
      if (response && response.data) {
        const updatedProfile = normalizeProfileResponse(response.data, profileData);

        if (response.data.profile || !response.data.success) {
          setProfile(updatedProfile);
          setInitialProfile(updatedProfile);
          calculateCompletionPercentage(updatedProfile);

          if (userId) {
            storeProfileLocally(userId, updatedProfile);
          }
        } else if (response.data.success && response.data.id) {
          // If it's just a success status without profile data, fetch the profile.
          try {
            const fetchResponse = await alumniService.getProfile(response.data.id);
            const fetchedProfile = normalizeProfileResponse(fetchResponse.data, {
              ...profileData,
              id: response.data.id
            });

            setProfile(fetchedProfile);
            setInitialProfile(fetchedProfile);
            
            // Calculate and update completion percentage
            calculateCompletionPercentage(fetchedProfile);

            if (userId) {
              storeProfileLocally(userId, fetchedProfile);
            }
          } catch (fetchError) {
            console.error('Error fetching updated profile:', fetchError);
            // Still update with what we have
            const fallbackProfile = normalizeProfileResponse(
              { success: true, id: response.data.id },
              profileData
            );

            setProfile(fallbackProfile);
            setInitialProfile(fallbackProfile);
            calculateCompletionPercentage(fallbackProfile);

            if (userId) {
              storeProfileLocally(userId, fallbackProfile);
            }
          }
        }
      }
      
      setIsEditing(false);
      toast.success(profileData.id ? 'Profile updated successfully' : 'Profile created successfully');
      
      // Upload profile picture if needed
      if (profilePicture) {
        // Check if we have an alumni ID now
        const alumniId = response?.data?.id || response?.data?._id || profileData.id;
        if (alumniId) {
          try {
            await uploadProfilePicture(alumniId);
          } catch (uploadError) {
            console.error('Error uploading profile picture:', uploadError);
            toast.warning('Profile saved but picture upload failed. You can try uploading it again.');
          }
        } else {
          console.error('Cannot upload profile picture without alumni ID');
          toast.warning('Profile saved but picture upload failed (missing ID).');
        }
      }
      
    } catch (error) {
      console.error('Error updating profile:', error);
      console.error('Error details:', error.response?.data);

      if (error.response?.status === 401 && localStorage.getItem('simple_auth') === 'true') {
        const userId = profile.user_id || currentUser?.id || currentUser?._id;
        const localProfile = buildDashboardProfileData({
          ...initialProfile,
          ...profile,
          user_id: userId
        });
        storeProfileLocally(userId, localProfile);
        setProfile(localProfile);
        setInitialProfile(localProfile);
        calculateCompletionPercentage(localProfile);
        setIsEditing(false);
        toast.success('Profile saved on this device');
        return;
      }
      
      if (error.response?.data?.detail) {
        // Handle structured validation errors from backend
        if (typeof error.response.data.detail === 'object') {
          const fieldErrors = {};
          Object.entries(error.response.data.detail).forEach(([field, message]) => {
            fieldErrors[field] = Array.isArray(message) ? message[0] : message;
          });
          setErrors(fieldErrors);
          toast.error('Validation failed. Please check the form fields.');
        } else if (Array.isArray(error.response.data.detail)) {
          // Handle FastAPI validation errors which come as an array
          const fieldErrors = {};
          error.response.data.detail.forEach(item => {
            const field = item.loc[item.loc.length - 1];
            fieldErrors[field] = item.msg;
          });
          setErrors(fieldErrors);
          toast.error('Validation failed. Please check the form fields.');
        } else {
          toast.error(`Error: ${error.response.data.detail}`);
        }
      } else if (error.message && error.message.includes('CORS')) {
        toast.error('Network error: CORS policy blocked the request. Please try again later.');
      } else if (error.message && error.message.includes('Network Error')) {
        toast.error('Network error: Unable to connect to the server. Please check your connection.');
      } else {
        toast.error('Failed to update profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Validate only the values currently present in the form.
  const validateForm = () => {
    const errors = {};

    if (profile.email && !/\S+@\S+\.\S+/.test(profile.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (profile.student_id && !/^[A-Za-z0-9-]+$/.test(profile.student_id)) {
      errors.student_id = 'Student ID can only contain letters, numbers, and hyphens';
    }

    if (profile.graduation_year) {
      const year = parseInt(profile.graduation_year);
      const currentYear = new Date().getFullYear();
      if (isNaN(year)) {
        errors.graduation_year = 'Graduation year must be a valid number';
      } else if (year < 1948) {
        errors.graduation_year = 'Graduation year cannot be before 1948';
      } else if (year > currentYear) {
        errors.graduation_year = 'Graduation year cannot be in the future';
      }
    }
    
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Calculate profile completion percentage
  const calculateCompletionPercentage = (data) => {
    const requiredFields = ['full_name', 'student_id', 'email'];
    
    // Count how many required fields are completed
    let completedFields = 0;
    requiredFields.forEach(field => {
      if (data[field] && data[field].toString().trim() !== '') {
        completedFields++;
      }
    });
    
    // Calculate percentage
    const percentage = Math.floor((completedFields / requiredFields.length) * 100);
    setCompletionPercentage(percentage);
    
    // Set missing fields count
    setMissingFields(requiredFields.length - completedFields);
    
    return percentage;
  };

  // Helper function to determine input class based on validation state
  const getInputClass = (fieldName) => {
    const baseClass = "block w-full rounded-lg border-gray-300 bg-white shadow-sm transition focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm";
    return validationErrors[fieldName] 
      ? `${baseClass} border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500` 
      : baseClass;
  };

  const getDisplayValue = (value, fallback = 'Not provided') => {
    if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value && value.toString().trim() !== '' ? value : fallback;
  };

  const requiredFields = ['full_name', 'student_id', 'email'];
  const recommendedFields = [
    'department', 'course', 'batch', 'graduation_year', 'phone', 'address', 'bio',
    'sex', 'civil_status', 'birthday', 'region_of_origin', 'is_employed',
    'csc_passer', 'honors_awards', 'degree_reasons'
  ];

  const completedRequired = requiredFields.filter(field =>
    profile[field] && profile[field].toString().trim() !== ''
  ).length;

  const completedRecommended = recommendedFields.filter(field => {
    if (Array.isArray(profile[field])) return profile[field].length > 0;
    if (typeof profile[field] === 'boolean') return true;
    return profile[field] && profile[field].toString().trim() !== '';
  }).length;

  const completionPercentage = Math.round(
    ((completedRequired / requiredFields.length) * 0.7 + (completedRecommended / recommendedFields.length) * 0.3) * 100
  );
  const missingRequiredCount = requiredFields.length - completedRequired;
  const statusText = completionPercentage >= 85
    ? 'Excellent'
    : completionPercentage >= 60
      ? 'Good Progress'
      : completionPercentage >= 30
        ? 'Getting Started'
        : 'Needs Attention';
  const completionColor = completionPercentage >= 85
    ? 'bg-emerald-500'
    : completionPercentage >= 60
      ? 'bg-amber-500'
      : completionPercentage >= 30
        ? 'bg-orange-500'
        : 'bg-red-500';
  const completionTone = completionPercentage >= 85
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : completionPercentage >= 60
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : completionPercentage >= 30
        ? 'text-orange-700 bg-orange-50 border-orange-200'
        : 'text-red-700 bg-red-50 border-red-200';

  const profileInitials = (profile.full_name || currentUser?.name || currentUser?.email || 'Alumni')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const profileFacts = [
    { label: 'Student ID', value: getDisplayValue(profile.student_id), icon: IdentificationIcon },
    { label: 'Email', value: getDisplayValue(profile.email), icon: EnvelopeIcon },
    { label: 'Course', value: getDisplayValue(profile.course), icon: AcademicCapIcon },
    { label: 'Batch', value: getDisplayValue(profile.batch || profile.graduation_year), icon: CalendarDaysIcon },
  ];
  const courseOptions = Array.isArray(courses) ? courses : [];
  const getCourseOptionValue = (course) => {
    if (course && typeof course === 'object') {
      return course.code || course.name || course.id || '';
    }
    return course || '';
  };
  const getCourseOptionLabel = (course) => {
    if (course && typeof course === 'object') {
      return course.name || course.code || course.id || 'Unnamed course';
    }
    return course || 'Unnamed course';
  };

  const handleUnemploymentReasonChange = (reason, isChecked) => {
    let updatedReasons = [...(profile.unemployment_reason || [])];
    
    if (isChecked) {
      // Add reason if checked and not already in the array
      if (!updatedReasons.includes(reason)) {
        updatedReasons.push(reason);
      }
    } else {
      // Remove reason if unchecked
      updatedReasons = updatedReasons.filter(item => item !== reason);
      
      // If "Other" is unchecked, also clear other_unemployment_reason
      if (reason === "Other") {
        setProfile({
          ...profile,
          unemployment_reason: updatedReasons,
          other_unemployment_reason: null
        });
        return;
      }
    }
    
    setProfile({ ...profile, unemployment_reason: updatedReasons });
  };

  return {
    activeTab,
    addSocialMedia,
    cancelEditing,
    completedRequired,
    completionColor,
    completionPercentage,
    completionTone,
    courseOptions,
    errorMessage,
    getCourseOptionLabel,
    getCourseOptionValue,
    getDisplayValue,
    getFieldValue,
    getInputClass,
    handleInputChange,
    handleProfilePictureChange,
    handleSocialMediaChange,
    handleUnemploymentReasonChange,
    isEditing,
    isUploading,
    loading,
    missingRequiredCount,
    previewUrl,
    profile,
    profileFacts,
    profileInitials,
    profilePicture,
    removeSocialMedia,
    requiredFields,
    saveProfile,
    setActiveTab,
    setProfile,
    startEditing,
    statusText,
    successMessage,
    uploadProfilePicture,
    validationErrors,
  };
}
