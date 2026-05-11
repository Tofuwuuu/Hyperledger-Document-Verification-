import { useState, useEffect } from 'react';
import {
  AcademicCapIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardDocumentCheckIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  UserCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { alumniService, referenceService } from '../../services/api';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { buildDashboardProfileData } from '../../utils/dashboard-profile-schema';

// Utility function to get the correct image URL
const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  
  // Check if the image is already a complete URL (cloud storage or data URL)
  if (imagePath.startsWith('http://') || 
      imagePath.startsWith('https://') || 
      imagePath.startsWith('data:image/')) {
    console.log('Using direct image URL:', imagePath);
    return imagePath;
  }
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const timestamp = new Date().getTime();
  
  // Handle different path formats
  let formattedPath = imagePath;
  if (imagePath.startsWith('/')) {
    formattedPath = imagePath.substring(1);
  }
  
  // For database-only setups, the path might be a relative path to where files 
  // are stored in the deployed application or a different location
  
  // 1. Full API URL with path (traditional server setup)
  const fullUrl = `${apiUrl}/${formattedPath}?t=${timestamp}`;
  
  // 2. Relative to current origin (for same-origin deployments)
  const relativeUrl = `/${formattedPath}?t=${timestamp}`;
  
  // 3. Direct path to file (for serverless setups)
  const directUrl = formattedPath;
  
  console.log('Generated image URLs:', { 
    fullUrl, 
    relativeUrl,
    directUrl,
    originalPath: imagePath
  });
  
  // Try to determine the best URL based on the environment
  // If we're in a database-only setup, the relative URL might work better
  return relativeUrl;
};

// Utility functions for localStorage image handling
const storeImageInLocalStorage = (userId, imageFile) => {
  return new Promise((resolve, reject) => {
    if (!imageFile || !userId) {
      reject('Missing image file or user ID');
      return;
    }
    
    // Check file size before processing
    const fileSizeMB = imageFile.size / (1024 * 1024);
    console.log(`Image size: ${fileSizeMB.toFixed(2)}MB`);
    
    if (fileSizeMB > 4) {
      console.warn('Image is larger than 4MB, it may not store correctly in localStorage');
      // Consider resizing the image here in a production app
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        // The specific key used for localStorage
        const imageKey = `profile_picture_${userId}`;
        console.log(`Storing image with key: ${imageKey}, data length: ${reader.result.length}`);
        
        // Store the image with a fixed key pattern
        localStorage.setItem(imageKey, reader.result);
        
        // Verify storage worked
        const storedData = localStorage.getItem(imageKey);
        if (storedData && storedData.length > 0) {
          console.log('Image stored successfully in localStorage, length:', storedData.length);
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

const getImageFromLocalStorage = (userId) => {
  if (!userId) {
    console.error('Cannot get image from localStorage: No user ID provided');
    return null;
  }
  
  // Use the same key pattern as when storing
  const imageKey = `profile_picture_${userId}`;
  console.log(`Attempting to retrieve image with key: ${imageKey}`);
  
  try {
    const imageData = localStorage.getItem(imageKey);
    
    if (imageData) {
      console.log(`Image found in localStorage! Data length: ${imageData.length}`);
      
      // Verify it's a valid data URL
      if (imageData.startsWith('data:image/')) {
        return imageData;
      } else {
        console.error('Retrieved data is not a valid image data URL');
        return null;
      }
    }
    
    console.log('No image found in localStorage for this user');
    return null;
  } catch (error) {
    console.error('Error retrieving image from localStorage:', error);
    return null;
  }
};

const getProfileStorageKey = (userId) => `alumni_profile_${userId}`;

const storeProfileLocally = (userId, profileData) => {
  if (!userId) return;

  try {
    localStorage.setItem(getProfileStorageKey(userId), JSON.stringify(profileData));
  } catch (error) {
    console.error('Error storing alumni profile in localStorage:', error);
  }
};

const getStoredProfile = (userId) => {
  if (!userId) return null;

  try {
    const profileData = localStorage.getItem(getProfileStorageKey(userId));
    return profileData ? JSON.parse(profileData) : null;
  } catch (error) {
    console.error('Error reading alumni profile from localStorage:', error);
    return null;
  }
};

const normalizeProfileResponse = (responseData, fallbackData = {}) => {
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

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [initialProfile, setInitialProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [profile, setProfile] = useState(() => buildDashboardProfileData());
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [courses, setCourses] = useState([]);
  const [errors, setErrors] = useState({});
  const [, setCompletionPercentage] = useState(0);
  const [, setMissingFields] = useState(0);
  const [degreeReasons, setDegreeReasons] = useState([
    "High grades in the course or subject area(s) related to the course",
    "Good grades in high school",
    "Influence of parents and relatives",
    "Peer influence",
    "Inspired by a role model",
    "Strong passion for the profession",
    "Prospect for immediate employment",
    "Status or prestige of the profession",
    "Availability of course offering in chosen institution",
    "Prospect of career advancement",
    "Affordable for the family",
    "Prospect of attractive compensation",
    "Opportunity for employment abroad",
    "No particular choice or no better idea"
  ]);
  
  // Employment Data Options
  const employmentOptions = ["Yes", "No", "Never Employed"];
  
  const unemploymentReasons = [
    "Advance study",
    "Family concern and decided not to find a job",
    "Health-related reason(s)",
    "Lack of work experience",
    "No job opportunity",
    "Did not look for a job"
  ];
  
  const employmentStatusOptions = [
    "Regular or Permanent",
    "Temporary",
    "Casual",
    "Contractual",
    "Self-employed"
  ];
  
  const businessTypeOptions = [
    "Sole proprietorship",
    "Partnership",
    "Corporation",
    "Cooperative"
  ];
  
  const companySectorOptions = [
    "Government Institution",
    "Private Institution"
  ];
  
  const businessLineOptions = [
    "Agriculture, Hunting, and Forestry",
    "Fishing",
    "Mining and Quarrying",
    "Manufacturing",
    "Electricity, Gas, and Water Supply",
    "Construction",
    "Wholesale and retail trade, repair of motor vehicles, motorcycles and personal and household goods",
    "Hotels and Restaurants",
    "Transport, Storage, Information and Communication",
    "Financial Intermediation",
    "Real Estate, Renting, and Business Activities",
    "Public Administration and Defense",
    "Education",
    "Health and Social Work",
    "Other community, Social and Personal activities",
    "Private households with employed persons",
    "Extra-territorial Organizations and Bodies"
  ];
  
  const workLocationOptions = [
    "Within the country",
    "Abroad"
  ];
  
  const stayReasons = [
    "Salaries and benefits",
    "Career Challenge",
    "Related to special skill",
    "Related to course or program of study",
    "Proximity to residence",
    "Peer influence",
    "Family influence"
  ];
  
  const firstJobReasons = [
    "Salaries and benefits",
    "Career Challenge",
    "Related to special skills",
    "Proximity to residence",
    "For experience"
  ];
  
  const tenureDurations = [
    "Less than a month",
    "1 to 6 months",
    "7-11 months",
    "1 year to less than 2 years",
    "2 years to less than 3 years",
    "3 years to less than 4 years"
  ];
  
  const jobAcquisitionMethods = [
    "Response to an advertisement",
    "Recommended by someone",
    "Public employment (thru PESO or related agencies)",
    "As walk-in applicant",
    "Information from friends",
    "Arranged by school's job placement services office (School Job fair, job posting in school bulletin and school page)"
  ];
  
  const jobLevelOptions = [
    "Rank and File, Clerical",
    "Professional, Technical or Supervisory",
    "Managerial or Executive",
    "Self-Employed"
  ];
  
  const salaryRanges = [
    "Php 5,000.00 to less than Php 10,000.00",
    "Php 10,000.00 to less than Php 15,000.00",
    "Php 15,000.00 to less than Php 20,000.00",
    "Php 20,000.00 to less than Php 25,000.00",
    "Php 25,000.00 and above"
  ];
  
  const relevanceLevels = [
    "Very relevant",
    "Relevant",
    "Slightly relevant",
    "Not Relevant"
  ];

  // List of Philippine regions for dropdown
  const philippineRegions = [
    "National Capital Region (NCR)",
    "Cordillera Administrative Region (CAR)",
    "Region I (Ilocos Region)",
    "Region II (Cagayan Valley)",
    "Region III (Central Luzon)",
    "Region IV-A (CALABARZON)",
    "Region IV-B (MIMAROPA)",
    "Region V (Bicol Region)",
    "Region VI (Western Visayas)",
    "Region VII (Central Visayas)",
    "Region VIII (Eastern Visayas)",
    "Region IX (Zamboanga Peninsula)",
    "Region X (Northern Mindanao)",
    "Region XI (Davao Region)",
    "Region XII (SOCCSKSARGEN)",
    "Region XIII (Caraga)",
    "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)"
  ];

  // University Acquired Skills Options
  const collegeCompetencies = [
    "Communication skills",
    "Human Relation skills",
    "Problem-solving skills",
    "Critical thinking skills",
    "Career Management",
    "Time Management",
    "Computer Skills",
    "Team work/Collaboration",
    "Research skills",
    "Technical skills"
  ];

  useEffect(() => {
    fetchAlumniProfile();
    fetchCVSUCourses();
  }, [currentUser]);

  // Update the useEffect for the profile picture to also check localStorage
  useEffect(() => {
    // First check if we have the image in localStorage
    if (profile.user_id) {
      try {
        console.log(`Checking localStorage for user ${profile.user_id}`);
        const localStorageImage = getImageFromLocalStorage(profile.user_id);
        
        if (localStorageImage) {
          console.log('Found and using profile picture from localStorage');
          setPreviewUrl(localStorageImage);
          return;
        } else {
          console.log('No localStorage image found, falling back to profile_picture path');
        }
      } catch (error) {
        console.error('Error in localStorage image handling:', error);
      }
    } else {
      console.log('No user_id available to check localStorage');
    }
    
    // Fall back to the regular path-based approach
    if (profile.profile_picture) {
      const imageUrl = getImageUrl(profile.profile_picture);
      console.log('Setting profile picture URL from profile data:', imageUrl);
      setPreviewUrl(imageUrl);
    } else {
      console.log('No profile picture path available');
      setPreviewUrl('');
    }
  }, [profile.profile_picture, profile.user_id]);

  const fetchAlumniProfile = async () => {
    if (!currentUser) return;
    setErrorMessage('');
    
    // Debug user info
    console.log('Current user object:', currentUser);
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
      console.log('Using user ID for profile fetch:', userId);
      
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

        console.log('No alumni profile found - will create one when user submits form');
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
        console.log('Profile picture from API:', alumniData.profile_picture);
        const imageUrl = getImageUrl(alumniData.profile_picture);
        console.log('Constructed image URL:', imageUrl);
        setPreviewUrl(imageUrl);
      } else {
        console.log('No profile picture in alumni data');
        // Check if we have it in localStorage as fallback
        if (alumniData.user_id) {
          const localImage = getImageFromLocalStorage(alumniData.user_id);
          if (localImage) {
            console.log('Using image from localStorage');
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

      console.log('Falling back to empty alumni profile form for user_id:', userId);
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
    
    console.log(`Starting profile picture upload for user ${profile.user_id}`);
    
    setIsUploading(true);
    try {
      // First, store the image in localStorage
      console.log('Storing image in localStorage...');
      const base64Image = await storeImageInLocalStorage(profile.user_id, profilePicture);
      console.log('Image stored in localStorage, data length:', base64Image.length);
      
      // Use the Base64 data directly as the image source
      setPreviewUrl(base64Image);
      
      // Now try to also save it via the API if available
      try {
        console.log('Attempting to save image to backend API...');
        const response = await alumniService.uploadProfilePicture(alumniId, profilePicture);
        console.log('Profile picture also saved to backend API');
        
        // Update the profile state with the path from the API response
        if (response && response.data && response.data.profile_picture) {
          console.log('Received profile_picture path from API:', response.data.profile_picture);
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
        console.log("Creating new alumni profile");
        
        // First check if profile already exists for this user
        try {
          console.log(`Checking if profile exists for user: ${profileData.user_id}`);
          const checkResponse = await alumniService.getAlumniByUserId(profileData.user_id);
          
          if (checkResponse && checkResponse.data && checkResponse.status !== 404) {
            console.log('Existing profile found:', checkResponse.data);
            
            // Set profile ID and update instead of creating
            profileData.id = checkResponse.data._id || checkResponse.data.id;
            
            // Use the update endpoint instead
            response = await alumniService.updateProfile(profileData);
            console.log('Updated existing profile instead of creating new one');
          } else {
            // No existing profile found, proceed with creation
            try {
              // Try using the reliable endpoint first
              response = await alumniService.createProfileReliable(profileData);
              console.log('Profile created with reliable endpoint');
            } catch (reliableError) {
              console.error('Error with reliable endpoint:', reliableError);
              
              // If the error indicates profile already exists, try to fetch and update
              if (reliableError.message?.includes('already exists')) {
                try {
                  console.log('Profile already exists error. Attempting to fetch and update.');
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
                  console.log('Profile created with standard endpoint');
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
        console.log("Updating existing profile:", profileData.id);
        
        try {
          // Try direct API call first
          response = await api.put(`/alumni/${profileData.id}/simple`, profileData);
          console.log('Profile updated successfully with simple endpoint');
        } catch (directError) {
          console.error('Error with simple update endpoint:', directError);
          // Fall back to the service method
        response = await alumniService.updateProfile(profileData);
          console.log('Profile updated with fallback method');
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const formatDateForAPI = (dateString) => {
    if (!dateString) return null;
    
    try {
      // Parse the date string into a Date object
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return null;
      }
      
      // Format the date as ISO string which includes timezone info (Z for UTC)
      // Example: 2023-05-15T00:00:00.000Z
      return date.toISOString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return null;
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

  // Validate URL format
  const isValidURL = (url) => {
    if (!url) return false;
    
    // If URL doesn't have protocol, add https:// for validation
    const urlToCheck = url.startsWith('http') ? url : `https://${url}`;
    
    try {
      new URL(urlToCheck);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Add this error display component to the input fields
  const FieldError = ({ name }) => {
    return validationErrors[name] ? (
      <p className="mt-1 text-sm text-red-600">{validationErrors[name]}</p>
    ) : null;
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

  if (loading && !isEditing) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  // Tab navigation configuration
  const tabs = [
    { id: 'personal', name: 'Personal Information', shortName: 'Personal', icon: UserCircleIcon },
    { id: 'education', name: 'Educational Background', shortName: 'Education', icon: AcademicCapIcon },
    { id: 'eligibility', name: 'Eligibility & Licensure', shortName: 'Licensure', icon: ClipboardDocumentCheckIcon },
    { id: 'employment', name: 'Employment Data', shortName: 'Employment', icon: BriefcaseIcon },
    { id: 'skills', name: 'Skills & Abilities', shortName: 'Skills', icon: SparklesIcon },
  ];

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

  const handleOtherUnemploymentReason = (e) => {
    setProfile({ ...profile, other_unemployment_reason: e.target.value });
  };

  // Handle editing toggle
  const toggleEditing = () => {
    setIsEditing(!isEditing);
  };

  return (
    <div className="relative mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-cvsu-green shadow-sm">
                {previewUrl ? (
                  <img src={previewUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-white">
                    {profileInitials || 'A'}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-2xl font-semibold text-slate-950">
                    {profile.full_name || 'Alumni Profile'}
                  </h2>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${completionTone}`}>
                    {statusText}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {getDisplayValue(profile.course, 'Complete your profile details to keep alumni records current')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 ring-1 ring-slate-200">
                    <IdentificationIcon className="h-4 w-4 text-cvsu-green" />
                    {getDisplayValue(profile.student_id, 'Student ID pending')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 ring-1 ring-slate-200">
                    <CalendarDaysIcon className="h-4 w-4 text-cvsu-green" />
                    {getDisplayValue(profile.graduation_year || profile.batch, 'Batch pending')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 ring-1 ring-slate-200">
                    <BriefcaseIcon className="h-4 w-4 text-cvsu-green" />
                    {getDisplayValue(profile.is_employed, 'Employment pending')}
                  </span>
                </div>
              </div>
            </div>
            {!isEditing && (
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center justify-center rounded-lg bg-cvsu-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2"
              >
                <PencilIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {profileFacts.map((fact) => {
              const Icon = fact.icon;
              return (
                <div key={fact.label} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Icon className="h-4 w-4 text-cvsu-green" />
                    {fact.label}
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold text-slate-950">{fact.value}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Profile Completion</p>
                <p className="mt-1 text-xs text-slate-500">{completedRequired} of {requiredFields.length} required fields complete</p>
              </div>
              <span className="text-2xl font-semibold text-slate-950">{completionPercentage}%</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`${completionColor} h-full rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-slate-600">Status: {statusText}</span>
              {missingRequiredCount > 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  {missingRequiredCount} missing
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  Required complete
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-2 overflow-x-auto py-3" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? 'bg-cvsu-green text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                  <span className="sm:hidden">{tab.shortName}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3">
            <CheckIcon className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-3">
            <XMarkIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="text-sm font-medium text-red-800">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Profile content */}
      <div>
        <dl>
          {/* Personal Information Tab Content */}
          {activeTab === 'personal' && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Personal Information</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Your basic personal details</p>
              </div>
              
              <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
                {/* Profile Picture Section */}
                <div className="py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Profile Picture</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex-shrink-0">
                        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-slate-100 ring-4 ring-slate-50">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt="Profile"
                              className="h-full w-full object-cover"
                              key={previewUrl?.substring(0, 30)}
                              onError={(e) => {
                                e.target.onerror = null;
                                if (profile.user_id) {
                                  const localImage = getImageFromLocalStorage(profile.user_id);
                                  if (localImage && localImage !== previewUrl) {
                                    e.target.src = localImage;
                                    return;
                                  }
                                }
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-cvsu-green text-lg font-semibold text-white">
                              {profileInitials || 'A'}
                            </div>
                          )}
                        </div>
                      </div>
                      {isEditing && (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                          <div className="flex flex-wrap text-sm text-slate-600">
                            <label
                              htmlFor="profile-picture-upload"
                              className="relative cursor-pointer font-semibold text-cvsu-green hover:text-cvsu-green/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-cvsu-green focus-within:ring-offset-2"
                            >
                              <span>Upload a file</span>
                              <input id="profile-picture-upload" name="profile-picture-upload" type="file" accept="image/*" className="sr-only" onChange={handleProfilePictureChange} />
                            </label>
                            <p className="pl-1">to update your photo</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">PNG, JPG, GIF up to 10MB</p>
                          {profilePicture && (
                            <button
                              type="button"
                              disabled={isUploading}
                              onClick={uploadProfilePicture}
                              className="mt-3 inline-flex items-center rounded-md border border-transparent bg-cvsu-green/10 px-3 py-1.5 text-xs font-semibold text-cvsu-green hover:bg-cvsu-green/20 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2"
                            >
                              {isUploading ? 'Uploading...' : 'Upload Image'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </dd>
                </div>

                {/* Basic Personal Info Fields */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Full Name</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <input
                        type="text"
                        name="full_name"
                        id="full_name"
                        value={profile.full_name}
                        onChange={handleInputChange}
                        className={getInputClass('full_name')}
                      />
                    ) : (
                      profile.full_name
                    )}
                    <FieldError name="full_name" />
                  </dd>
                </div>

                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Student ID</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <input
                        type="text"
                        name="student_id"
                        id="student_id"
                        value={profile.student_id}
                        onChange={handleInputChange}
                        className={getInputClass('student_id')}
                      />
                    ) : (
                      profile.student_id
                    )}
                    <FieldError name="student_id" />
                  </dd>
                </div>

                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Email</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        id="email"
                        value={profile.email}
                        onChange={handleInputChange}
                        className={getInputClass('email')}
                      />
                    ) : (
                      profile.email
                    )}
                    <FieldError name="email" />
                  </dd>
                </div>

                {/* Sex/Gender */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Sex</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <select
                        name="sex"
                        id="sex"
                        value={profile.sex}
                        onChange={handleInputChange}
                        className={getInputClass('sex')}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    ) : (
                      profile.sex ? profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1) : ''
                    )}
                    <FieldError name="sex" />
                  </dd>
                </div>

                {/* Civil Status */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Civil Status</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <select
                        name="civil_status"
                        id="civil_status"
                        value={profile.civil_status}
                        onChange={handleInputChange}
                        className={getInputClass('civil_status')}
                      >
                        <option value="">Select civil status</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="separated">Separated</option>
                        <option value="widowed">Widow/er</option>
                      </select>
                    ) : (
                      profile.civil_status ? profile.civil_status.charAt(0).toUpperCase() + profile.civil_status.slice(1) : ''
                    )}
                    <FieldError name="civil_status" />
                  </dd>
                </div>

                {/* Birthday */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">
                    Birthday
                    <div className="mt-1 text-xs text-slate-400 font-normal">
                      Please enter your date of birth in YYYY-MM-DD format
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <input
                        type="date"
                        name="birthday"
                        id="birthday"
                        value={profile.birthday}
                        onChange={handleInputChange}
                        className={getInputClass('birthday')}
                      />
                    ) : (
                      profile.birthday ? new Date(profile.birthday).toLocaleDateString() : ''
                    )}
                    <FieldError name="birthday" />
                  </dd>
                </div>

                {/* Region of Origin */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Region of Origin</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <select
                        name="region_of_origin"
                        id="region_of_origin"
                        value={profile.region_of_origin}
                        onChange={handleInputChange}
                        className={getInputClass('region_of_origin')}
                      >
                        <option value="">Select region</option>
                        {philippineRegions.map((region, index) => (
                          <option key={index} value={region}>
                            {region}
                          </option>
                        ))}
                      </select>
                    ) : (
                      profile.region_of_origin
                    )}
                    <FieldError name="region_of_origin" />
                  </dd>
                </div>

                {/* Phone */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Phone</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <input
                        type="text"
                        name="phone"
                        id="phone"
                        value={profile.phone}
                        onChange={handleInputChange}
                        className={getInputClass('phone')}
                      />
                    ) : (
                      profile.phone
                    )}
                    <FieldError name="phone" />
                  </dd>
                </div>

                {/* Address */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Address</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <textarea
                        name="address"
                        id="address"
                        rows={3}
                        value={profile.address}
                        onChange={handleInputChange}
                        className={getInputClass('address')}
                      />
                    ) : (
                      profile.address
                    )}
                    <FieldError name="address" />
                  </dd>
                </div>

                {/* Bio */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Bio</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <textarea
                        name="bio"
                        id="bio"
                        rows={4}
                        value={profile.bio}
                        onChange={handleInputChange}
                        className={getInputClass('bio')}
                      />
                    ) : (
                      profile.bio
                    )}
                    <FieldError name="bio" />
                  </dd>
                </div>

                {/* Social Media */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">Social Media</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <div className="space-y-4">
                        {profile.social_media?.map((social, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <select
                              value={social.platform || ''}
                              onChange={(e) => handleSocialMediaChange(index, 'platform', e.target.value)}
                              className="max-w-lg block shadow-sm focus:ring-cvsu-green focus:border-cvsu-green sm:max-w-xs sm:text-sm border-gray-300 rounded-md"
                            >
                              <option value="">Select platform</option>
                              <option value="facebook">Facebook</option>
                              <option value="twitter">Twitter</option>
                              <option value="instagram">Instagram</option>
                              <option value="linkedin">LinkedIn</option>
                              <option value="github">GitHub</option>
                              <option value="youtube">YouTube</option>
                              <option value="tiktok">TikTok</option>
                              <option value="discord">Discord</option>
                              <option value="other">Other</option>
                            </select>
                            <input
                              type="text"
                              value={social.url || ''}
                              onChange={(e) => handleSocialMediaChange(index, 'url', e.target.value)}
                              placeholder="Enter URL"
                              className="max-w-lg flex-1 block shadow-sm focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm border-gray-300 rounded-md"
                            />
                            <button
                              type="button"
                              onClick={() => removeSocialMedia(index)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addSocialMedia}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                        >
                          <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                          Add Social Media
                        </button>
                      </div>
                    ) : (
                      <div>
                        {profile.social_media?.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {profile.social_media.map((social, index) => (
                              <a 
                                key={index} 
                                href={social.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                              >
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 text-white ${
                                  social.platform === 'facebook' ? 'bg-blue-600' :
                                  social.platform === 'twitter' ? 'bg-blue-400' :
                                  social.platform === 'instagram' ? 'bg-pink-500' :
                                  social.platform === 'linkedin' ? 'bg-blue-700' :
                                  social.platform === 'github' ? 'bg-gray-900' :
                                  social.platform === 'youtube' ? 'bg-red-600' :
                                  social.platform === 'tiktok' ? 'bg-black' :
                                  social.platform === 'discord' ? 'bg-indigo-600' :
                                  'bg-gray-500'
                                }`}>
                                  {social.platform.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium capitalize">{social.platform}</div>
                                  <div className="text-xs text-slate-500 truncate max-w-[200px]">{social.url}</div>
                                </div>
                              </a>
                            ))}
                          </div>
                        ) : 'No social media profiles added'}
                      </div>
                    )}
                  </dd>
                </div>
              </div>
            </div>
          )}

          {/* Educational Background Tab Content */}
          {activeTab === 'education' && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Educational Background</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Your academic history and achievements</p>
              </div>
              
              <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
                {/* Department, Batch, Course fields */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Department</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <input
                        type="text"
                        name="department"
                        id="department"
                        value={getFieldValue(profile.department)}
                        onChange={handleInputChange}
                        className={getInputClass('department')}
                      />
                    ) : (
                      profile.department
                    )}
                    <FieldError name="department" />
                  </dd>
                </div>
                
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Course</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <select
                        name="course"
                        id="course"
                        value={getFieldValue(profile.course)}
                        onChange={handleInputChange}
                        className={getInputClass('course')}
                      >
                        <option value="">Select course</option>
                        {courseOptions.map((course, index) => (
                          <option key={getCourseOptionValue(course) || index} value={getCourseOptionValue(course)}>
                            {getCourseOptionLabel(course)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      profile.course
                    )}
                    <FieldError name="course" />
                  </dd>
                </div>
                
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Batch</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <input
                        type="text"
                        name="batch"
                        id="batch"
                        value={getFieldValue(profile.batch)}
                        onChange={handleInputChange}
                        className={getInputClass('batch')}
                      />
                    ) : (
                      profile.batch
                    )}
                    <FieldError name="batch" />
                  </dd>
                </div>
                
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Graduation Year</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <input
                        type="number"
                        name="graduation_year"
                        id="graduation_year"
                        min="1948"
                        max={new Date().getFullYear()}
                        value={getFieldValue(profile.graduation_year)}
                        onChange={handleInputChange}
                        className={getInputClass('graduation_year')}
                      />
                    ) : (
                      profile.graduation_year
                    )}
                    <FieldError name="graduation_year" />
                  </dd>
                </div>
                
                {/* Graduation Month */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Graduation Period</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <select
                        name="graduation_month"
                        id="graduation_month"
                        value={profile.graduation_month || ''}
                        onChange={handleInputChange}
                        className={getInputClass('graduation_month')}
                      >
                        <option value="">Select graduation period</option>
                        <option value="April">April</option>
                        <option value="September">September</option>
                        <option value="November">November</option>
                      </select>
                    ) : (
                      profile.graduation_month ? `${profile.graduation_month} ${profile.graduation_year}` : profile.graduation_year
                    )}
                    <FieldError name="graduation_month" />
                  </dd>
                </div>

                {/* Honors and Awards */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">
                    Honors/Awards Received
                    <div className="mt-1 text-xs text-slate-400 font-normal">
                      List any academic honors, dean's list awards, or scholarships you received
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <textarea
                        name="honors_awards"
                        id="honors_awards"
                        rows={3}
                        value={profile.honors_awards || ''}
                        onChange={handleInputChange}
                        placeholder="List any honors or awards received during college (or enter N/A)"
                        className={getInputClass('honors_awards')}
                      />
                    ) : (
                      profile.honors_awards || 'N/A'
                    )}
                    <FieldError name="honors_awards" />
                  </dd>
                </div>

                {/* Reasons for pursuing degree */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Reasons for Pursuing Degree</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        {degreeReasons.map((reason, index) => (
                          <div key={index} className="flex items-start">
                            <input
                              type="checkbox"
                              id={`reason-${index}`}
                              checked={profile.degree_reasons?.includes(reason) || false}
                              onChange={(e) => {
                                const updatedReasons = e.target.checked
                                  ? [...(profile.degree_reasons || []), reason]
                                  : (profile.degree_reasons || []).filter(r => r !== reason);
                                setProfile({...profile, degree_reasons: updatedReasons});
                              }}
                              className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded mt-1"
                            />
                            <label htmlFor={`reason-${index}`} className="ml-2 block text-sm text-slate-700">
                              {reason}
                            </label>
                          </div>
                        ))}
                        <div>
                          <label htmlFor="reason-other" className="block text-sm text-slate-700 mb-1">
                            Other reason:
                          </label>
                          <input
                            type="text"
                            id="reason-other"
                            name="degree_reasons_other"
                            value={profile.degree_reasons_other || ''}
                            onChange={handleInputChange}
                            className={getInputClass('degree_reasons_other')}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        {profile.degree_reasons?.length > 0 ? (
                          <ul className="list-disc pl-5">
                            {profile.degree_reasons.map((reason, index) => (
                              <li key={index}>{reason}</li>
                            ))}
                            {profile.degree_reasons_other && <li>{profile.degree_reasons_other}</li>}
                          </ul>
                        ) : 'Not specified'}
                      </div>
                    )}
                  </dd>
                </div>

                {/* Advanced Studies */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-slate-600">Advanced Studies</dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <div className="space-y-3">
                        <select
                          name="advanced_studies_level"
                          id="advanced_studies_level"
                          value={profile.advanced_studies?.level || 'None'}
                          onChange={(e) => setProfile({
                            ...profile,
                            advanced_studies: {
                              ...(profile.advanced_studies || {}),
                              level: e.target.value
                            }
                          })}
                          className={getInputClass('advanced_studies_level')}
                        >
                          <option value="None">None</option>
                          <option value="MA Units">MA Units</option>
                          <option value="MA Graduate">MA Graduate</option>
                          <option value="PhD Units">PhD Units</option>
                        </select>
                        
                        {profile.advanced_studies?.level && profile.advanced_studies.level !== 'None' && (
                          <>
                            <div>
                              <label className="block text-sm text-slate-700 mb-1">
                                Institution
                              </label>
                              <input
                                type="text"
                                name="advanced_studies_institution"
                                value={profile.advanced_studies?.institution || ''}
                                onChange={(e) => setProfile({
                                  ...profile,
                                  advanced_studies: {
                                    ...(profile.advanced_studies || {}),
                                    institution: e.target.value
                                  }
                                })}
                                className={getInputClass('advanced_studies_institution')}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm text-slate-700 mb-1">
                                Field of Study
                              </label>
                              <input
                                type="text"
                                name="advanced_studies_field"
                                value={profile.advanced_studies?.field || ''}
                                onChange={(e) => setProfile({
                                  ...profile,
                                  advanced_studies: {
                                    ...(profile.advanced_studies || {}),
                                    field: e.target.value
                                  }
                                })}
                                className={getInputClass('advanced_studies_field')}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm text-slate-700 mb-1">
                                Motivation
                              </label>
                              <textarea
                                name="advanced_studies_motivation"
                                rows={3}
                                value={profile.advanced_studies?.motivation || ''}
                                onChange={(e) => setProfile({
                                  ...profile,
                                  advanced_studies: {
                                    ...(profile.advanced_studies || {}),
                                    motivation: e.target.value
                                  }
                                })}
                                placeholder="Explain what made you pursue advanced studies (e.g., professional growth, promotion)"
                                className={getInputClass('advanced_studies_motivation')}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div>
                        {profile.advanced_studies?.level && profile.advanced_studies.level !== 'None' ? (
                          <div className="space-y-2">
                            <p><strong>Level:</strong> {profile.advanced_studies.level}</p>
                            {profile.advanced_studies.institution && <p><strong>Institution:</strong> {profile.advanced_studies.institution}</p>}
                            {profile.advanced_studies.field && <p><strong>Field:</strong> {profile.advanced_studies.field}</p>}
                            {profile.advanced_studies.motivation && <p><strong>Motivation:</strong> {profile.advanced_studies.motivation}</p>}
                          </div>
                        ) : 'None'}
                      </div>
                    )}
                  </dd>
                </div>
              </div>
            </div>
          )}
          
          {/* Add placeholder sections for other tabs */}
          {activeTab === 'eligibility' && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Eligibility & Licensure</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Information about your professional credentials and certifications</p>
              </div>
              
              <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
                {/* Civil Service Eligibility */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">
                    Civil Service Professional (CSC) Passer
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="csc_passer" className="block text-sm font-medium text-gray-700 mb-1">
                            Are you a Civil Service Professional (CSC) Passer?
                          </label>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <input
                                id="csc_passer_yes"
                                name="csc_passer"
                                type="radio"
                                checked={profile.csc_passer === true}
                                onChange={() => handleInputChange({ target: { name: 'csc_passer', value: true } })}
                                className="focus:ring-cvsu-green h-4 w-4 text-cvsu-green border-gray-300"
                              />
                              <label htmlFor="csc_passer_yes" className="ml-2 block text-sm text-slate-700">
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                id="csc_passer_no"
                                name="csc_passer"
                                type="radio"
                                checked={profile.csc_passer === false}
                                onChange={() => handleInputChange({ target: { name: 'csc_passer', value: false } })}
                                className="focus:ring-cvsu-green h-4 w-4 text-cvsu-green border-gray-300"
                              />
                              <label htmlFor="csc_passer_no" className="ml-2 block text-sm text-slate-700">
                                No
                              </label>
                            </div>
                          </div>
                        </div>
                        
                        {profile.csc_passer && (
                          <div>
                            <label htmlFor="csc_year" className="block text-sm font-medium text-gray-700 mb-1">
                              If YES (CSC), what year?
                            </label>
                            <input
                              type="number"
                              name="csc_year"
                              id="csc_year"
                              min="1948"
                              max={new Date().getFullYear()}
                              value={profile.csc_year || ''}
                              onChange={handleInputChange}
                              placeholder="[Your answer]"
                              className={getInputClass('csc_year')}
                            />
                          </div>
                        )}
                      </div>
                      </>
                    ) : (
                      <div>
                        {profile.csc_passer ? (
                          <div className="space-y-2">
                            <p>Yes</p>
                            <p><span className="font-medium">Year:</span> {profile.csc_year || 'Not specified'}</p>
                          </div>
                        ) : (
                          <p>No</p>
                        )}
                      </div>
                    )}
                    <FieldError name="csc_passer" />
                    <FieldError name="csc_year" />
                  </dd>
                </div>
                
                {/* Professional Examinations */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">
                    Professional Examination(s) Passed
                    <div className="mt-1 text-xs text-slate-400 font-normal">
                      PRC Licensure Examinations and the like
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <textarea
                        name="professional_exams"
                        id="professional_exams"
                        rows={3}
                        value={profile.professional_exams || ''}
                        onChange={handleInputChange}
                        placeholder="List any professional examinations passed (e.g., PRC Licensure Examinations)"
                        className={getInputClass('professional_exams')}
                      />
                    ) : (
                      profile.professional_exams || 'N/A'
                    )}
                    <FieldError name="professional_exams" />
                  </dd>
                </div>
                
                {/* Certifications */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">
                    Certification
                    <div className="mt-1 text-xs text-slate-400 font-normal">
                      NC Level, Microsoft Certificates, CISCO Certificates, etc. (Be Specific)
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <textarea
                        name="certifications"
                        id="certifications"
                        rows={3}
                        value={profile.certifications || ''}
                        onChange={handleInputChange}
                        placeholder="List your certifications with specific details (e.g., Microsoft Certified: Azure Administrator Associate, CCNA, etc.)"
                        className={getInputClass('certifications')}
                      />
                    ) : (
                      profile.certifications || 'N/A'
                    )}
                    <FieldError name="certifications" />
                  </dd>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'employment' && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Employment Data</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Information about your current employment status</p>
              </div>
              
              <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
                {/* Employment Status */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">
                    Are you presently employed? (Self-employed considered "employed")
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Are you presently employed?
                        </label>
                        <div className="flex space-x-6">
                          {employmentOptions.map((option) => (
                            <div key={option} className="flex items-center">
                              <input
                                type="radio"
                                id={`employed_${option.toLowerCase().replace(' ', '_')}`}
                                name="is_employed"
                                value={option}
                                checked={profile.is_employed === option}
                                onChange={() => setProfile({ ...profile, is_employed: option })}
                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                              />
                              <label htmlFor={`employed_${option.toLowerCase().replace(' ', '_')}`} className="ml-2 block text-sm text-slate-700">
                                {option}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        {profile.is_employed === "Yes" ? (
                          <div className="space-y-2">
                            <p>Yes</p>
                            <p><span className="font-medium">Employment Status:</span> {profile.employment_status || 'N/A'}</p>
                            <p><span className="font-medium">Occupation:</span> {profile.occupation || 'N/A'}</p>
                            <p><span className="font-medium">Company Name:</span> {profile.company_name || 'N/A'}</p>
                            <p><span className="font-medium">Company Address:</span> {profile.company_address || 'N/A'}</p>
                            <p><span className="font-medium">Company Sector:</span> {profile.company_sector || 'N/A'}</p>
                            <p><span className="font-medium">Business Line:</span> {profile.business_line || 'N/A'}</p>
                            <p><span className="font-medium">Work Location:</span> {profile.work_location || 'N/A'}</p>
                            <p><span className="font-medium">First Job:</span> {profile.is_first_job ? 'Yes' : 'No'}</p>
                            <p><span className="font-medium">Stay Reasons:</span> {profile.stay_reasons?.join(', ') || 'N/A'}</p>
                            <p><span className="font-medium">First Job Related:</span> {profile.first_job_related ? 'Yes' : 'No'}</p>
                            <p><span className="font-medium">First Job Reasons:</span> {profile.first_job_reasons?.join(', ') || 'N/A'}</p>
                            <p><span className="font-medium">First Job Tenure:</span> {profile.first_job_tenure || 'N/A'}</p>
                            <p><span className="font-medium">First Job Acquisition:</span> {profile.first_job_acquisition || 'N/A'}</p>
                            <p><span className="font-medium">Time to First Job:</span> {profile.time_to_first_job || 'N/A'}</p>
                            <p><span className="font-medium">First Job Level:</span> {profile.first_job_level || 'N/A'}</p>
                            <p><span className="font-medium">Current Job Level:</span> {profile.current_job_level || 'N/A'}</p>
                            <p><span className="font-medium">Initial Salary:</span> {profile.initial_salary || 'N/A'}</p>
                            <p><span className="font-medium">Curriculum Relevance First:</span> {profile.curriculum_relevance_first || 'N/A'}</p>
                            <p><span className="font-medium">Curriculum Relevance Current:</span> {profile.curriculum_relevance_current || 'N/A'}</p>
                            <p><span className="font-medium">Skills:</span> {profile.skills || 'N/A'}</p>
                            <p><span className="font-medium">Achievements:</span> {profile.achievements || 'N/A'}</p>
                            <p><span className="font-medium">Special Projects:</span> {profile.special_projects || 'N/A'}</p>
                            <p><span className="font-medium">Professional Organizations:</span> {profile.professional_organizations || 'N/A'}</p>
                          </div>
                        ) : (
                          <div>
                            <p>{profile.is_employed}</p>
                            <p><span className="font-medium">Reason(s) why you are not yet employed:</span> {profile.unemployment_reason?.join(', ') || 'N/A'}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <FieldError name="is_employed" />
                  </dd>
                </div>
                
                {/* Unemployment Reason - Only show if not employed */}
                {(profile.is_employed === "No" || profile.is_employed === "Never Employed") && isEditing && (
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6 border-t border-gray-200">
                    <dt className="text-sm font-semibold text-slate-600">
                      Reason(s) why you are not yet employed
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input
                            id="reason-advanced-studies"
                            name="unemployment_reason"
                            type="checkbox"
                            checked={profile.unemployment_reason?.includes("Advanced Studies")}
                            onChange={(e) => handleUnemploymentReasonChange("Advanced Studies", e.target.checked)}
                            className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                          />
                          <label htmlFor="reason-advanced-studies" className="ml-2 block text-sm text-slate-700">
                            Advanced studies
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            id="reason-family"
                            name="unemployment_reason"
                            type="checkbox"
                            checked={profile.unemployment_reason?.includes("Family Concern")}
                            onChange={(e) => handleUnemploymentReasonChange("Family Concern", e.target.checked)}
                            className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                          />
                          <label htmlFor="reason-family" className="ml-2 block text-sm text-slate-700">
                            Family concern and decided not to find a job
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            id="reason-no-job"
                            name="unemployment_reason"
                            type="checkbox"
                            checked={profile.unemployment_reason?.includes("No Job Opportunity")}
                            onChange={(e) => handleUnemploymentReasonChange("No Job Opportunity", e.target.checked)}
                            className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                          />
                          <label htmlFor="reason-no-job" className="ml-2 block text-sm text-slate-700">
                            No job opportunity
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            id="reason-no-match"
                            name="unemployment_reason"
                            type="checkbox"
                            checked={profile.unemployment_reason?.includes("Skills Mismatch")}
                            onChange={(e) => handleUnemploymentReasonChange("Skills Mismatch", e.target.checked)}
                            className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                          />
                          <label htmlFor="reason-no-match" className="ml-2 block text-sm text-slate-700">
                            Did not match qualifications for available job opportunity
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            id="reason-salary"
                            name="unemployment_reason"
                            type="checkbox"
                            checked={profile.unemployment_reason?.includes("Salary Issue")}
                            onChange={(e) => handleUnemploymentReasonChange("Salary Issue", e.target.checked)}
                            className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                          />
                          <label htmlFor="reason-salary" className="ml-2 block text-sm text-slate-700">
                            Salary/compensation issue
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            id="reason-health"
                            name="unemployment_reason"
                            type="checkbox"
                            checked={profile.unemployment_reason?.includes("Health Issue")}
                            onChange={(e) => handleUnemploymentReasonChange("Health Issue", e.target.checked)}
                            className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                          />
                          <label htmlFor="reason-health" className="ml-2 block text-sm text-slate-700">
                            Health-related reason
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            id="reason-employment-strain"
                            name="unemployment_reason"
                            type="checkbox"
                            checked={profile.unemployment_reason?.includes("Employment Strain")}
                            onChange={(e) => handleUnemploymentReasonChange("Employment Strain", e.target.checked)}
                            className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                          />
                          <label htmlFor="reason-employment-strain" className="ml-2 block text-sm text-slate-700">
                            Strain and demand of employment
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            id="reason-other"
                            name="unemployment_reason"
                            type="checkbox"
                            checked={profile.unemployment_reason?.some(reason => reason.startsWith("Other:"))}
                            onChange={(e) => {
                              if (!e.target.checked) {
                                setProfile({
                                  ...profile,
                                  unemployment_reason: profile.unemployment_reason?.filter(reason => !reason.startsWith("Other:")) || []
                                });
                              } else {
                                setProfile({
                                  ...profile,
                                  unemployment_reason: [...(profile.unemployment_reason || []), "Other: "]
                                });
                              }
                            }}
                            className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                          />
                          <label htmlFor="reason-other" className="ml-2 block text-sm text-slate-700">
                            Other
                          </label>
                        </div>
                        
                        {profile.unemployment_reason?.some(reason => reason.startsWith("Other:")) && (
                          <div className="mt-1">
                            <input
                              type="text"
                              value={profile.unemployment_reason.find(reason => reason.startsWith("Other:"))?.substr(7) || ""}
                              onChange={(e) => {
                                const otherReasons = profile.unemployment_reason?.filter(reason => !reason.startsWith("Other:")) || [];
                                setProfile({
                                  ...profile,
                                  unemployment_reason: [...otherReasons, `Other: ${e.target.value}`]
                                });
                              }}
                              placeholder="Please specify"
                              className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>
                        )}
                      </div>
                      <FieldError name="unemployment_reason" />
                    </dd>
                  </div>
                )}

                {/* Display unemployment reason if not editing and value exists */}
                {(profile.is_employed === "No" || profile.is_employed === "Never Employed") && !isEditing && profile.unemployment_reason && (
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6 border-t border-gray-200">
                    <dt className="text-sm font-semibold text-slate-600">
                      Reason(s) why you are not yet employed
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                      {typeof profile.unemployment_reason === 'string' 
                        ? profile.unemployment_reason 
                        : (Array.isArray(profile.unemployment_reason) 
                            ? profile.unemployment_reason.join(', ') 
                            : 'N/A')}
                    </dd>
                  </div>
                )}
                
                {/* Employment Fields - Only show if employed */}
                {profile.is_employed === "Yes" && (
                  <>
                    {/* Employment Type */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Employment Type
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <select
                            id="employment_status"
                            name="employment_status"
                            value={profile.employment_status || ''}
                            onChange={handleInputChange}
                            className={getInputClass('employment_status')}
                          >
                            <option value="">Select type</option>
                            <option value="REGULAR">Regular/Permanent</option>
                            <option value="TEMPORARY">Temporary</option>
                            <option value="CASUAL">Casual</option>
                            <option value="CONTRACTUAL">Contractual</option>
                            <option value="SELF_EMPLOYED">Self-employed</option>
                          </select>
                        ) : (
                          profile.employment_status === 'REGULAR' ? 'Regular/Permanent' :
                          profile.employment_status === 'TEMPORARY' ? 'Temporary' :
                          profile.employment_status === 'CASUAL' ? 'Casual' :
                          profile.employment_status === 'CONTRACTUAL' ? 'Contractual' :
                          profile.employment_status === 'SELF_EMPLOYED' ? 'Self-employed' : 'N/A'
                        )}
                        <FieldError name="employment_status" />
                      </dd>
                    </div>
                    
                    {/* Occupation/Position */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Present Occupation
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <input
                            type="text"
                            name="occupation"
                            id="occupation"
                            value={profile.occupation || ''}
                            onChange={handleInputChange}
                            placeholder="[Your answer]"
                            className={getInputClass('occupation')}
                          />
                        ) : (
                          profile.occupation || 'N/A'
                        )}
                        <FieldError name="occupation" />
                      </dd>
                    </div>
                    
                    {/* Company Name */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Name of Your Company or Organization?
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <input
                            type="text"
                            name="company_name"
                            id="company_name"
                            value={profile.company_name || ''}
                            onChange={handleInputChange}
                            placeholder="[Your answer]"
                            className={getInputClass('company_name')}
                          />
                        ) : (
                          profile.company_name || 'N/A'
                        )}
                        <FieldError name="company_name" />
                      </dd>
                    </div>
                    
                    {/* Company Address */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Complete address of your organization or institution?
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <textarea
                            name="company_address"
                            id="company_address"
                            rows={3}
                            value={profile.company_address || ''}
                            onChange={handleInputChange}
                            className={getInputClass('company_address')}
                          />
                        ) : (
                          profile.company_address || 'N/A'
                        )}
                        <FieldError name="company_address" />
                      </dd>
                    </div>
                    
                    {/* Company Sector */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Company Sector
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <select
                            id="company_sector"
                            name="company_sector"
                            value={profile.company_sector || ''}
                            onChange={handleInputChange}
                            className={getInputClass('company_sector')}
                          >
                            <option value="">Select sector</option>
                            {companySectorOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          profile.company_sector || 'N/A'
                        )}
                        <FieldError name="company_sector" />
                      </dd>
                    </div>
                    
                    {/* Business Line */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Business Line
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <select
                            id="business_line"
                            name="business_line"
                            value={profile.business_line || ''}
                            onChange={handleInputChange}
                            className={getInputClass('business_line')}
                          >
                            <option value="">Select business line</option>
                            {businessLineOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          profile.business_line || 'N/A'
                        )}
                        <FieldError name="business_line" />
                      </dd>
                    </div>
                    
                    {/* Work Location */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Work Location
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <select
                            id="work_location"
                            name="work_location"
                            value={profile.work_location || ''}
                            onChange={handleInputChange}
                            className={getInputClass('work_location')}
                          >
                            <option value="">Select location</option>
                            {workLocationOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          profile.work_location || 'N/A'
                        )}
                        <FieldError name="work_location" />
                      </dd>
                    </div>
                    
                    {/* Is First Job */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Is this your first job?
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <div className="flex space-x-4">
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="is_first_job_yes"
                                name="is_first_job"
                                checked={profile.is_first_job === true}
                                onChange={() => setProfile({ ...profile, is_first_job: true })}
                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                              />
                              <label htmlFor="is_first_job_yes" className="ml-2 block text-sm text-slate-700">
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="is_first_job_no"
                                name="is_first_job"
                                checked={profile.is_first_job === false}
                                onChange={() => setProfile({ ...profile, is_first_job: false })}
                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                              />
                              <label htmlFor="is_first_job_no" className="ml-2 block text-sm text-slate-700">
                                No
                              </label>
                            </div>
                          </div>
                        ) : (
                          profile.is_first_job ? 'Yes' : 'No'
                        )}
                        <FieldError name="is_first_job" />
                      </dd>
                    </div>
                    
                    {/* Stay Reasons */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Reasons for staying on the job
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <div className="space-y-2">
                            {stayReasons.map((reason) => (
                              <div key={reason} className="flex items-start">
                                <input
                                  type="checkbox"
                                  id={`stay_reason_${reason.toLowerCase().replace(/\s+/g, '_')}`}
                                  checked={profile.stay_reasons?.includes(reason) || false}
                                  onChange={(e) => {
                                    const updatedReasons = e.target.checked 
                                      ? [...(profile.stay_reasons || []), reason]
                                      : (profile.stay_reasons || []).filter(r => r !== reason);
                                    setProfile({ ...profile, stay_reasons: updatedReasons });
                                  }}
                                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-1"
                                />
                                <label 
                                  htmlFor={`stay_reason_${reason.toLowerCase().replace(/\s+/g, '_')}`} 
                                  className="ml-2 block text-sm text-slate-700"
                                >
                                  {reason}
                                </label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          profile.stay_reasons?.join(', ') || 'N/A'
                        )}
                        <FieldError name="stay_reasons" />
                      </dd>
                    </div>
                    
                    {/* First Job Related */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Is your first job related to your course?
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <div className="flex space-x-4">
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="first_job_related_yes"
                                name="first_job_related"
                                checked={profile.first_job_related === true}
                                onChange={() => setProfile({ ...profile, first_job_related: true })}
                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                              />
                              <label htmlFor="first_job_related_yes" className="ml-2 block text-sm text-slate-700">
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="first_job_related_no"
                                name="first_job_related"
                                checked={profile.first_job_related === false}
                                onChange={() => setProfile({ ...profile, first_job_related: false })}
                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                              />
                              <label htmlFor="first_job_related_no" className="ml-2 block text-sm text-slate-700">
                                No
                              </label>
                            </div>
                          </div>
                        ) : (
                          profile.first_job_related ? 'Yes' : 'No'
                        )}
                        <FieldError name="first_job_related" />
                      </dd>
                    </div>
                    
                    {/* First Job Reasons */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Reasons for accepting first job
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <div className="space-y-2">
                            {firstJobReasons.map((reason) => (
                              <div key={reason} className="flex items-start">
                                <input
                                  type="checkbox"
                                  id={`first_job_reason_${reason.toLowerCase().replace(/\s+/g, '_')}`}
                                  checked={profile.first_job_reasons?.includes(reason) || false}
                                  onChange={(e) => {
                                    const updatedReasons = e.target.checked 
                                      ? [...(profile.first_job_reasons || []), reason]
                                      : (profile.first_job_reasons || []).filter(r => r !== reason);
                                    setProfile({ ...profile, first_job_reasons: updatedReasons });
                                  }}
                                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-1"
                                />
                                <label 
                                  htmlFor={`first_job_reason_${reason.toLowerCase().replace(/\s+/g, '_')}`} 
                                  className="ml-2 block text-sm text-slate-700"
                                >
                                  {reason}
                                </label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          profile.first_job_reasons?.join(', ') || 'N/A'
                        )}
                        <FieldError name="first_job_reasons" />
                      </dd>
                    </div>
                    
                    {/* First Job Tenure */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        How long did you stay in your first job?
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <select
                            id="first_job_tenure"
                            name="first_job_tenure"
                            value={profile.first_job_tenure || ''}
                            onChange={handleInputChange}
                            className={getInputClass('first_job_tenure')}
                          >
                            <option value="">Select tenure</option>
                            {tenureDurations.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          profile.first_job_tenure || 'N/A'
                        )}
                        <FieldError name="first_job_tenure" />
                      </dd>
                    </div>
                    
                    {/* First Job Acquisition */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        How did you find your first job?
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <select
                            id="first_job_acquisition"
                            name="first_job_acquisition"
                            value={profile.first_job_acquisition || ''}
                            onChange={handleInputChange}
                            className={getInputClass('first_job_acquisition')}
                          >
                            <option value="">Select method</option>
                            {jobAcquisitionMethods.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          profile.first_job_acquisition || 'N/A'
                        )}
                        <FieldError name="first_job_acquisition" />
                      </dd>
                    </div>
                    
                    {/* Time to First Job */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        How long did it take to find your first job?
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <input
                            type="text"
                            name="time_to_first_job"
                            id="time_to_first_job"
                            value={profile.time_to_first_job || ''}
                            onChange={handleInputChange}
                            className={getInputClass('time_to_first_job')}
                            placeholder="e.g., 3 months after graduation"
                          />
                        ) : (
                          profile.time_to_first_job || 'N/A'
                        )}
                        <FieldError name="time_to_first_job" />
                      </dd>
                    </div>
                    
                    {/* First Job Level */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Level of your first job
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <select
                            id="first_job_level"
                            name="first_job_level"
                            value={profile.first_job_level || ''}
                            onChange={handleInputChange}
                            className={getInputClass('first_job_level')}
                          >
                            <option value="">Select level</option>
                            {jobLevelOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          profile.first_job_level || 'N/A'
                        )}
                        <FieldError name="first_job_level" />
                      </dd>
                    </div>
                    
                    {/* Current Job Level */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Level of your current job
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <select
                            id="current_job_level"
                            name="current_job_level"
                            value={profile.current_job_level || ''}
                            onChange={handleInputChange}
                            className={getInputClass('current_job_level')}
                          >
                            <option value="">Select level</option>
                            {jobLevelOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          profile.current_job_level || 'N/A'
                        )}
                        <FieldError name="current_job_level" />
                      </dd>
                    </div>
                    
                    {/* Initial Salary */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Initial Salary (First Job)
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <input
                            type="text"
                            name="initial_salary"
                            id="initial_salary"
                            value={profile.initial_salary || ''}
                            onChange={handleInputChange}
                            className={getInputClass('initial_salary')}
                            placeholder="e.g., ₱25,000/month"
                          />
                        ) : (
                          profile.initial_salary || 'N/A'
                        )}
                        <FieldError name="initial_salary" />
                      </dd>
                    </div>
                    
                    {/* Curriculum Relevance First */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Relevance of curriculum to first job
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <input
                            type="number"
                            name="curriculum_relevance_first"
                            id="curriculum_relevance_first"
                            min="1"
                            max="5"
                            value={profile.curriculum_relevance_first || ''}
                            onChange={handleInputChange}
                            className={getInputClass('curriculum_relevance_first')}
                            placeholder="Scale of 1-5 (5 being most relevant)"
                          />
                        ) : (
                          profile.curriculum_relevance_first || 'N/A'
                        )}
                        <FieldError name="curriculum_relevance_first" />
                      </dd>
                    </div>
                    
                    {/* Curriculum Relevance Current */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Relevance of curriculum to current job
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <input
                            type="number"
                            name="curriculum_relevance_current"
                            id="curriculum_relevance_current"
                            min="1"
                            max="5"
                            value={profile.curriculum_relevance_current || ''}
                            onChange={handleInputChange}
                            className={getInputClass('curriculum_relevance_current')}
                            placeholder="Scale of 1-5 (5 being most relevant)"
                          />
                        ) : (
                          profile.curriculum_relevance_current || 'N/A'
                        )}
                        <FieldError name="curriculum_relevance_current" />
                      </dd>
                    </div>
                    
                    {/* Date Employed */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Date Employed
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <input
                            type="date"
                            name="date_employed"
                            id="date_employed"
                            value={profile.date_employed || ''}
                            onChange={handleInputChange}
                            className={getInputClass('date_employed')}
                          />
                        ) : (
                          profile.date_employed || 'N/A'
                        )}
                        <FieldError name="date_employed" />
                      </dd>
                    </div>
                    
                    {/* Monthly Salary Range */}
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-slate-600">
                        Monthly Salary Range
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                        {isEditing ? (
                          <select
                            id="monthly_salary"
                            name="monthly_salary"
                            value={profile.monthly_salary || ''}
                            onChange={handleInputChange}
                            className={getInputClass('monthly_salary')}
                          >
                            <option value="">Select range</option>
                            <option value="BELOW_10K">Below ₱10,000</option>
                            <option value="10K_15K">₱10,000 - ₱15,000</option>
                            <option value="15K_20K">₱15,001 - ₱20,000</option>
                            <option value="20K_25K">₱20,001 - ₱25,000</option>
                            <option value="25K_30K">₱25,001 - ₱30,000</option>
                            <option value="30K_35K">₱30,001 - ₱35,000</option>
                            <option value="35K_40K">₱35,001 - ₱40,000</option>
                            <option value="40K_50K">₱40,001 - ₱50,000</option>
                            <option value="50K_60K">₱50,001 - ₱60,000</option>
                            <option value="ABOVE_60K">Above ₱60,000</option>
                          </select>
                        ) : (
                          profile.monthly_salary === 'BELOW_10K' ? 'Below ₱10,000' :
                          profile.monthly_salary === '10K_15K' ? '₱10,000 - ₱15,000' :
                          profile.monthly_salary === '15K_20K' ? '₱15,001 - ₱20,000' :
                          profile.monthly_salary === '20K_25K' ? '₱20,001 - ₱25,000' :
                          profile.monthly_salary === '25K_30K' ? '₱25,001 - ₱30,000' :
                          profile.monthly_salary === '30K_35K' ? '₱30,001 - ₱35,000' :
                          profile.monthly_salary === '35K_40K' ? '₱35,001 - ₱40,000' :
                          profile.monthly_salary === '40K_50K' ? '₱40,001 - ₱50,000' :
                          profile.monthly_salary === '50K_60K' ? '₱50,001 - ₱60,000' :
                          profile.monthly_salary === 'ABOVE_60K' ? 'Above ₱60,000' : 'N/A'
                        )}
                        <FieldError name="monthly_salary" />
                      </dd>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'skills' && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Skills & Abilities</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Share your professional skills and achievements</p>
              </div>
              
              <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
                {/* Professional Skills */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">
                    Professional Skills
                    <div className="mt-1 text-xs text-slate-400 font-normal">
                      List your key professional skills
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <textarea
                        name="skills"
                        id="skills"
                        rows={4}
                        value={profile.skills || ''}
                        onChange={handleInputChange}
                        placeholder="List your technical skills, soft skills, and industry-specific competencies (e.g., Programming Languages, Project Management, Communication, etc.)"
                        className={getInputClass('skills')}
                      />
                    ) : (
                      <div className="whitespace-pre-line">
                        {profile.skills || 'No skills listed'}
                      </div>
                    )}
                    <FieldError name="skills" />
                  </dd>
                </div>
                
                {/* Achievements */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">
                    Achievements
                    <div className="mt-1 text-xs text-slate-400 font-normal">
                      List your notable achievements and awards
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <textarea
                        name="achievements"
                        id="achievements"
                        rows={4}
                        value={profile.achievements || ''}
                        onChange={handleInputChange}
                        placeholder="List awards, recognition, or significant accomplishments in your career or academic life"
                        className={getInputClass('achievements')}
                      />
                    ) : (
                      <div className="whitespace-pre-line">
                        {profile.achievements || 'No achievements listed'}
                      </div>
                    )}
                    <FieldError name="achievements" />
                  </dd>
                </div>
                
                {/* Special Projects */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">
                    Special Projects
                    <div className="mt-1 text-xs text-slate-400 font-normal">
                      Describe any significant projects you've worked on
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <textarea
                        name="special_projects"
                        id="special_projects"
                        rows={4}
                        value={profile.special_projects || ''}
                        onChange={handleInputChange}
                        placeholder="Describe special projects, research, or initiatives you've led or been part of"
                        className={getInputClass('special_projects')}
                      />
                    ) : (
                      <div className="whitespace-pre-line">
                        {profile.special_projects || 'No special projects listed'}
                      </div>
                    )}
                    <FieldError name="special_projects" />
                  </dd>
                </div>
                
                {/* Professional Organizations */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-semibold text-slate-600">
                    Professional Organizations
                    <div className="mt-1 text-xs text-slate-400 font-normal">
                      List any professional groups or associations you belong to
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                    {isEditing ? (
                      <textarea
                        name="professional_organizations"
                        id="professional_organizations"
                        rows={3}
                        value={profile.professional_organizations || ''}
                        onChange={handleInputChange}
                        placeholder="List organizations, associations, or professional groups you're affiliated with"
                        className={getInputClass('professional_organizations')}
                      />
                    ) : (
                      <div className="whitespace-pre-line">
                        {profile.professional_organizations || 'No professional organizations listed'}
                      </div>
                    )}
                    <FieldError name="professional_organizations" />
                  </dd>
                </div>
              </div>
            </div>
          )}
        </dl>
      </div>

      {/* Add sticky action bar at the bottom */}
      {isEditing && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            {errorMessage && (
              <p className="text-sm font-medium text-red-600 truncate max-w-sm md:max-w-md">
                {errorMessage}
              </p>
            )}
            {!errorMessage && (
              <p className="text-sm text-gray-500">
                Make changes to your profile and save when done
              </p>
            )}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
              >
                <XMarkIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-cvsu-green hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
              >
                {loading ? (
                  <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <CheckIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add padding at the bottom when editing to prevent content from being hidden behind the action bar */}
      {isEditing && <div className="pb-16"></div>}
    </div>
  );
} 
