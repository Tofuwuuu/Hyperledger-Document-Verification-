import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../../context/useAuth';
import { saveProfileDraft, readProfileDraft, clearProfileDraft, discardOtherProfileDrafts } from '../../../utils/profileDraft';
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
import {
  FORM_MESSAGES,
  firstErroredField,
  isValidatedField,
  mapServerErrors,
  photoErrorForStatus,
  tabForField,
  validateField,
  validatePhoto,
  validateProfile,
} from './profileValidation';

const SUCCESS_VISIBLE_MS = 2500;
const SUCCESS_FADE_MS = 500;

// State, loading, saving, and picture upload for the signed-in alumni profile page.
export default function useAlumniProfile() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
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
  const [validationErrors, setValidationErrors] = useState({});
  // One line above the Save button: { tone: 'error' | 'success' | 'info', text, action?, fading? }
  const [formStatus, setFormStatus] = useState(null);
  const [pendingFocusField, setPendingFocusField] = useState(null);
  const [focusRestoredChange, setFocusRestoredChange] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const statusTimersRef = useRef([]);
  // Values the server rejected, so leaving an unchanged field keeps its server error.
  const serverRejectedRef = useRef({});
  const [courses, setCourses] = useState([]);
  const [, setCompletionPercentage] = useState(0);
  const [, setMissingFields] = useState(0);

  const clearStatusTimers = useCallback(() => {
    statusTimersRef.current.forEach((timer) => clearTimeout(timer));
    statusTimersRef.current = [];
  }, []);

  const showStatus = useCallback((status) => {
    clearStatusTimers();
    setFormStatus(status);
    if (status?.tone === 'success') {
      statusTimersRef.current = [
        setTimeout(() => setFormStatus((current) => (current === status ? { ...status, fading: true } : current)), SUCCESS_VISIBLE_MS),
        setTimeout(() => setFormStatus((current) => (current?.text === status.text && current.fading ? null : current)), SUCCESS_VISIBLE_MS + SUCCESS_FADE_MS),
      ];
    }
  }, [clearStatusTimers]);

  useEffect(() => clearStatusTimers, [clearStatusTimers]);

  // After a failed Save: show the first errored field's tab, then scroll to it and focus it.
  useEffect(() => {
    if (!pendingFocusField) return;
    const tab = tabForField(pendingFocusField);
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
      return;
    }
    const field = document.querySelector(`[name="${pendingFocusField}"]`);
    if (field) {
      field.scrollIntoView({ block: 'center', behavior: 'smooth' });
      field.focus({ preventScroll: true });
    }
    setPendingFocusField(null);
  }, [pendingFocusField, activeTab]);

  // After a draft is restored, bring the first kept change on this tab into view.
  useEffect(() => {
    if (!focusRestoredChange || !initialProfile) return;
    const fields = Array.from(document.querySelectorAll('input[name], select[name], textarea[name]'));
    const changed = fields.find((field) => (
      String(profile[field.name] ?? '') !== String(initialProfile[field.name] ?? '')
    ));
    if (changed) {
      changed.scrollIntoView({ block: 'center' });
      changed.focus({ preventScroll: true });
    }
    setFocusRestoredChange(false);
  }, [focusRestoredChange, initialProfile, profile]);

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

  // Calculate profile completion percentage
  const calculateCompletionPercentage = useCallback((data) => {
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
  }, []);

  // Helper function to create an empty profile with user data
  const createEmptyProfile = useCallback((userId) => {
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
  }, [currentUser]);

  // Fetch CVSU courses
  const fetchCVSUCourses = useCallback(async () => {
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
  }, []);

  const fetchAlumniProfile = useCallback(async () => {
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
  }, [currentUser, createEmptyProfile, calculateCompletionPercentage]);

  // Unsaved edits kept from a session-expiry sign-in come back in edit mode.
  const restoreDraft = useCallback(() => {
    const userId = currentUser?.id || currentUser?._id;
    if (!userId) return;
    discardOtherProfileDrafts(userId);
    const draft = readProfileDraft(userId);
    if (!draft) return;
    setActiveTab('personal');
    setProfile(buildDashboardProfileData(draft));
    setIsEditing(true);
    setFormStatus({ tone: 'info', text: FORM_MESSAGES.welcomeBack });
    setFocusRestoredChange(true);
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;
    fetchAlumniProfile().then(() => {
      if (!cancelled) restoreDraft();
    });
    fetchCVSUCourses();
    return () => {
      cancelled = true;
    };
  }, [fetchAlumniProfile, fetchCVSUCourses, restoreDraft]);
  


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile({ ...profile, [name]: value });
  };

  // Validate a field when the user leaves it (not on every keystroke).
  const handleFieldBlur = (e) => {
    const { name, value } = e.target;
    if (!isValidatedField(name)) return;
    const serverRejected = Object.prototype.hasOwnProperty.call(serverRejectedRef.current, name)
      && serverRejectedRef.current[name] === value;
    if (!serverRejected) delete serverRejectedRef.current[name];
    const message = validateField(name, value) || (serverRejected ? validationErrors[name] : '');
    const nextErrors = { ...validationErrors };
    if (message) nextErrors[name] = message;
    else delete nextErrors[name];
    setValidationErrors(nextErrors);
    if (!message && Object.keys(nextErrors).length === 0 && formStatus?.text === FORM_MESSAGES.fixFields) {
      showStatus(null);
    }
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

    const problem = validatePhoto(file);
    setPhotoError(problem);
    if (problem) {
      setProfilePicture(null);
      e.target.value = '';
      return;
    }
    
    setProfilePicture(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Upload the chosen photo; errors show under the upload box.
  const uploadProfilePicture = async (alumniId = profile.id) => {
    if (!profilePicture) return;
    if (!alumniId) {
      setPhotoError(photoErrorForStatus());
      return;
    }

    setIsUploading(true);
    setPhotoError('');
    try {
      const response = await alumniService.uploadProfilePicture(alumniId, profilePicture);
      const picturePath = response?.data?.profile_picture || response?.data?.path;
      if (picturePath) {
        setProfile(prevProfile => ({ ...prevProfile, profile_picture: picturePath }));
        if (initialProfile) {
          setInitialProfile(prevInitialProfile => ({ ...prevInitialProfile, profile_picture: picturePath }));
        }
      }

      // Keep a local copy for faster display; not fatal if storage is full.
      if (profile.user_id) {
        try {
          const base64Image = await storeImageInLocalStorage(profile.user_id, profilePicture);
          setPreviewUrl(base64Image);
        } catch (storageError) {
          console.error('Could not keep a local copy of the photo:', storageError);
        }
      }

      setSuccessMessage('Profile picture updated successfully!');
      setProfilePicture(null);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setPhotoError(photoErrorForStatus(error.response?.status));
    } finally {
      setIsUploading(false);
    }
  };

  const startEditing = () => {
    setIsEditing(true);
    setSuccessMessage('');
    setErrorMessage('');
    setValidationErrors({});
    setPhotoError('');
    showStatus(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSuccessMessage('');
    setErrorMessage('');
    setValidationErrors({});
    setPhotoError('');
    showStatus(null);
    // Cancel discards edits, including any kept from an expired session.
    clearProfileDraft(currentUser?.id || currentUser?._id);
    
    // Reset form to original data
    if (initialProfile) {
      setProfile(initialProfile);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    
    // Validate only fields that were actually filled in or changed.
    if (!validateForm()) {
      showStatus({ tone: 'error', text: FORM_MESSAGES.fixFields });
      setLoading(false);
      return;
    }
    showStatus(null);
      
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
            showStatus({ tone: 'success', text: FORM_MESSAGES.savedOnDevice });
            setLoading(false);
            return;
          }

          // Shared handling below (field errors, sign-in, network).
          throw error;
        }
      } else {
        // This is an existing profile that needs to be updated
        
        try {
          // Try direct API call first
          response = await api.put(`/alumni/${profileData.id}/simple`, profileData);
        } catch (directError) {
          console.error('Error with simple update endpoint:', directError);
          // A rejected session or invalid fields won't succeed on the other endpoint either.
          const status = directError.response?.status;
          if (status === 401 || status === 409 || status === 422) throw directError;
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
      setValidationErrors({});
      clearProfileDraft(userId);
      showStatus({ tone: 'success', text: FORM_MESSAGES.saved });
      
      // Upload profile picture if needed
      if (profilePicture) {
        // Check if we have an alumni ID now
        const alumniId = response?.data?.id || response?.data?._id || profileData.id;
        // Errors show under the upload box (uploadProfilePicture handles them).
        await uploadProfilePicture(alumniId);
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
        showStatus({ tone: 'success', text: FORM_MESSAGES.savedOnDevice });
        return;
      }

      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      if (status === 401) {
        // Session ended (12h cap): keep the edits for after sign-in.
        saveProfileDraft(currentUser?.id || currentUser?._id || profile.user_id, profile);
        showStatus({ tone: 'error', text: FORM_MESSAGES.signedOut, action: 'signin' });
      } else if (status === 409 || status === 422 || (detail && typeof detail === 'object')) {
        const { fieldErrors, unmatched } = mapServerErrors(detail, profile);
        serverRejectedRef.current = Object.fromEntries(
          Object.keys(fieldErrors).map((name) => [name, String(profile[name] ?? '')]),
        );
        const fieldCount = Object.keys(fieldErrors).length;
        setValidationErrors(fieldErrors);
        showStatus({
          tone: 'error',
          text: unmatched > 0 || fieldCount === 0 ? FORM_MESSAGES.serverUnmatched : FORM_MESSAGES.fixFields,
        });
        if (fieldCount > 0) setPendingFocusField(firstErroredField(fieldErrors));
      } else if (!error.response) {
        // No response at all: offline, DNS, or blocked by CORS.
        showStatus({ tone: 'error', text: FORM_MESSAGES.network });
      } else {
        showStatus({ tone: 'error', text: FORM_MESSAGES.generic });
      }
    } finally {
      setLoading(false);
    }
  };

  // Validate only the values currently present in the form.
  const validateForm = () => {
    const errors = validateProfile(profile);
    setValidationErrors(errors);
    const first = firstErroredField(errors);
    if (first) setPendingFocusField(first);
    return !first;
  };

  // "Sign in again": end the expired session (the draft stays in
  // sessionStorage) and come back to this page after signing in.
  const signInAgain = async () => {
    sessionStorage.setItem('redirectAfterLogin', '/alumni/profile');
    try {
      await logout();
    } finally {
      navigate('/login?redirect=%2Falumni%2Fprofile');
    }
  };
  

  // Helper function to determine input class based on validation state
  // Errored fields get one solid red border, focused or not (no green focus
  // classes competing with the red ones).
  const getInputClass = (fieldName) => {
    if (validationErrors[fieldName]) {
      return "block w-full rounded-lg border-red-600 bg-white shadow-sm transition text-red-900 placeholder-red-300 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 sm:text-sm";
    }
    return "block w-full rounded-lg border-gray-300 bg-white shadow-sm transition focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm";
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
    formStatus,
    getCourseOptionLabel,
    getCourseOptionValue,
    getDisplayValue,
    getFieldValue,
    getInputClass,
    handleFieldBlur,
    handleInputChange,
    handleProfilePictureChange,
    handleSocialMediaChange,
    handleUnemploymentReasonChange,
    isEditing,
    isUploading,
    loading,
    missingRequiredCount,
    photoError,
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
    signInAgain,
    startEditing,
    statusText,
    successMessage,
    uploadProfilePicture,
    validationErrors,
  };
}
