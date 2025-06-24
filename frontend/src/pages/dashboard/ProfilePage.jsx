import { useState, useEffect } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { alumniService, referenceService } from '../../services/api';
import { toast } from 'react-toastify';
import { prepareProfileData } from '../../utils/profile-helpers';

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

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [initialProfile, setInitialProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [profile, setProfile] = useState({
    full_name: '',
    student_id: '',
    course: '',
    graduation_year: '',
    graduation_month: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    department: '',
    batch: '',
    social_media: [],
    honors_awards: '',
    degree_reasons: [],
    degree_reasons_other: '',
    advanced_studies: { level: 'None', institution: '', field: '', motivation: '' },
    csc_passer: false,
    csc_year: '',
    professional_exams: '',
    certifications: '',
    is_employed: '',
    unemployment_reason: '',
    employment_status: '',
    occupation: '',
    business_type: '',
    company_name: '',
    company_address: '',
    company_sector: '',
    business_line: '',
    work_location: '',
    is_first_job: false,
    stay_reasons: [],
    first_job_related: false,
    first_job_reasons: [],
    first_job_tenure: '',
    first_job_acquisition: '',
    time_to_first_job: '',
    first_job_level: '',
    current_job_level: '',
    initial_salary: '',
    curriculum_relevance_first: '',
    curriculum_relevance_current: '',
    profile_picture: '',
    // University Acquired Skills/Abilities fields
    competencies_from_college: [],
    curriculum_improvement_suggestions: '',
    data_privacy_consent: false,
    // Additional fields
    sex: '',
    civil_status: '',
    birthday: '',
    region_of_origin: '',
    skills: '',
    achievements: '',
    special_projects: '',
    professional_organizations: '',
    monthly_salary: '',
    date_employed: ''
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [courses, setCourses] = useState([]);
  const [errors, setErrors] = useState({});
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
    
    setLoading(true);
    try {
      // Use _id as fallback if id is not present
      const userId = currentUser.id || currentUser._id;
      
      // Check if user has a profile
      const response = await alumniService.getAlumniByUserId(userId);
      const alumniData = response.data;
      
      setProfile({
        id: alumniData._id,
        user_id: alumniData.user_id,
        full_name: alumniData.full_name || '',
        student_id: alumniData.student_id || '',
        course: alumniData.course || 'Bachelor of Science in Computer Science',
        graduation_year: alumniData.graduation_year || '',
        graduation_month: alumniData.graduation_month || '',
        honors_awards: alumniData.honors_awards || '',
        degree_reasons: alumniData.degree_reasons || [],
        degree_reasons_other: alumniData.degree_reasons_other || '',
        advanced_studies: alumniData.advanced_studies || { level: 'None', institution: '', field: '', motivation: '' },
        csc_passer: alumniData.csc_passer || false,
        csc_year: alumniData.csc_year || '',
        professional_exams: alumniData.professional_exams || '',
        certifications: alumniData.certifications || '',
        email: alumniData.email || '',
        phone: alumniData.phone || '',
        address: alumniData.address || '',
        bio: alumniData.bio || '',
        department: alumniData.department || 'IT Department',
        batch: alumniData.batch || '2023',
        social_media: alumniData.social_media || [],
        profile_picture: alumniData.profile_picture || '',
        sex: alumniData.sex || '',
        civil_status: alumniData.civil_status || '',
        birthday: alumniData.birthday ? new Date(alumniData.birthday).toISOString().split('T')[0] : '',
        region_of_origin: alumniData.region_of_origin || '',
        // University Acquired Skills
        competencies_from_college: alumniData.competencies_from_college || [],
        curriculum_improvement_suggestions: alumniData.curriculum_improvement_suggestions || '',
        work_awards: alumniData.work_awards || [],
        data_privacy_consent: alumniData.data_privacy_consent || false,
        skills: alumniData.skills || '',
        achievements: alumniData.achievements || '',
        special_projects: alumniData.special_projects || '',
        professional_organizations: alumniData.professional_organizations || '',
        // Employment data
        is_employed: alumniData.is_employed || '',
        employment_status: alumniData.employment_status || '',
        occupation: alumniData.occupation || '',
        company_name: alumniData.company_name || '',
        company_address: alumniData.company_address || '',
        company_sector: alumniData.company_sector || '',
        business_line: alumniData.business_line || '',
        work_location: alumniData.work_location || '',
        is_first_job: alumniData.is_first_job || false,
        stay_reasons: alumniData.stay_reasons || [],
        first_job_related: alumniData.first_job_related || false,
        first_job_reasons: alumniData.first_job_reasons || [],
        first_job_tenure: alumniData.first_job_tenure || '',
        first_job_acquisition: alumniData.first_job_acquisition || '',
        time_to_first_job: alumniData.time_to_first_job || '',
        first_job_level: alumniData.first_job_level || '',
        current_job_level: alumniData.current_job_level || '',
        initial_salary: alumniData.initial_salary || '',
        curriculum_relevance_first: alumniData.curriculum_relevance_first || '',
        curriculum_relevance_current: alumniData.curriculum_relevance_current || '',
        monthly_salary: alumniData.monthly_salary || '',
        date_employed: alumniData.date_employed || '',
        unemployment_reason: alumniData.unemployment_reason || []
      });
      
      setInitialProfile({
        id: alumniData._id,
        user_id: alumniData.user_id,
        full_name: alumniData.full_name || '',
        student_id: alumniData.student_id || '',
        course: alumniData.course || 'Bachelor of Science in Computer Science',
        graduation_year: alumniData.graduation_year || '',
        graduation_month: alumniData.graduation_month || '',
        honors_awards: alumniData.honors_awards || '',
        degree_reasons: alumniData.degree_reasons || [],
        degree_reasons_other: alumniData.degree_reasons_other || '',
        advanced_studies: alumniData.advanced_studies || { level: 'None', institution: '', field: '', motivation: '' },
        csc_passer: alumniData.csc_passer || false,
        csc_year: alumniData.csc_year || '',
        professional_exams: alumniData.professional_exams || '',
        certifications: alumniData.certifications || '',
        email: alumniData.email || '',
        phone: alumniData.phone || '',
        address: alumniData.address || '',
        bio: alumniData.bio || '',
        department: alumniData.department || 'IT Department',
        batch: alumniData.batch || '2023',
        social_media: alumniData.social_media || [],
        profile_picture: alumniData.profile_picture || '',
        sex: alumniData.sex || '',
        civil_status: alumniData.civil_status || '',
        birthday: alumniData.birthday ? new Date(alumniData.birthday).toISOString().split('T')[0] : '',
        region_of_origin: alumniData.region_of_origin || '',
        skills: alumniData.skills || '',
        achievements: alumniData.achievements || '',
        special_projects: alumniData.special_projects || '',
        professional_organizations: alumniData.professional_organizations || '',
        // Employment data
        is_employed: alumniData.is_employed || '',
        employment_status: alumniData.employment_status || '',
        occupation: alumniData.occupation || '',
        company_name: alumniData.company_name || '',
        company_address: alumniData.company_address || '',
        company_sector: alumniData.company_sector || '',
        business_line: alumniData.business_line || '',
        work_location: alumniData.work_location || '',
        is_first_job: alumniData.is_first_job || false,
        stay_reasons: alumniData.stay_reasons || [],
        first_job_related: alumniData.first_job_related || false,
        first_job_reasons: alumniData.first_job_reasons || [],
        first_job_tenure: alumniData.first_job_tenure || '',
        first_job_acquisition: alumniData.first_job_acquisition || '',
        time_to_first_job: alumniData.time_to_first_job || '',
        first_job_level: alumniData.first_job_level || '',
        current_job_level: alumniData.current_job_level || '',
        initial_salary: alumniData.initial_salary || '',
        curriculum_relevance_first: alumniData.curriculum_relevance_first || '',
        curriculum_relevance_current: alumniData.curriculum_relevance_current || '',
        monthly_salary: alumniData.monthly_salary || '',
        date_employed: alumniData.date_employed || '',
        unemployment_reason: alumniData.unemployment_reason || []
      });
      
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
    } catch (error) {
      console.error('Error fetching alumni profile:', error);
      
      // If profile doesn't exist, create empty profile form with user data
      if (error.response?.status === 404) {
        setProfile({
          user_id: currentUser.id || currentUser._id,
          full_name: currentUser.full_name || '',
          student_id: currentUser.student_id || '',
          course: '',
          graduation_year: currentUser.graduation_year || '',
          graduation_month: '',
          honors_awards: '',
          degree_reasons: [],
          degree_reasons_other: '',
          advanced_studies: { level: 'None', institution: '', field: '', motivation: '' },
          csc_passer: false,
          csc_year: '',
          professional_exams: '',
          certifications: '',
          email: currentUser.email || '',
          phone: '',
          address: '',
          bio: '',
          department: '',
          batch: '',
          social_media: [],
          sex: '',
          civil_status: '',
          birthday: '',
          region_of_origin: ''
        });
        
        // This is a new profile, we need to create it first
        toast.info('Please complete your profile information and save to create your alumni profile.');
        setIsEditing(true); // Start in edit mode for new profile
        setInitialProfile(null);
      } else if (error.response?.data?.detail === "Alumni profile already exists for this user") {
        // If we get the "profile already exists" error, try to fetch the profile again
        toast.info('Your profile already exists. Retrieving it now...');
        
        try {
          const userId = currentUser.id || currentUser._id;
          const response = await alumniService.getAlumniByUserId(userId);
          const alumniData = response.data;
          
          setProfile({
            id: alumniData._id,
            user_id: alumniData.user_id,
            // Include all other profile fields
            full_name: alumniData.full_name || '',
            student_id: alumniData.student_id || '',
            course: alumniData.course || 'Bachelor of Science in Computer Science',
            graduation_year: alumniData.graduation_year || '',
            graduation_month: alumniData.graduation_month || '',
            honors_awards: alumniData.honors_awards || '',
            degree_reasons: alumniData.degree_reasons || [],
            degree_reasons_other: alumniData.degree_reasons_other || '',
            advanced_studies: alumniData.advanced_studies || { level: 'None', institution: '', field: '', motivation: '' },
            csc_passer: alumniData.csc_passer || false,
            csc_year: alumniData.csc_year || '',
            professional_exams: alumniData.professional_exams || '',
            certifications: alumniData.certifications || '',
            email: alumniData.email || '',
            phone: alumniData.phone || '',
            address: alumniData.address || '',
            bio: alumniData.bio || '',
            department: alumniData.department || 'IT Department',
            batch: alumniData.batch || '2023',
            social_media: alumniData.social_media || [],
            profile_picture: alumniData.profile_picture || '',
            sex: alumniData.sex || '',
            civil_status: alumniData.civil_status || '',
            birthday: alumniData.birthday ? new Date(alumniData.birthday).toISOString().split('T')[0] : '',
            region_of_origin: alumniData.region_of_origin || '',
            competencies_from_college: alumniData.competencies_from_college || [],
            curriculum_improvement_suggestions: alumniData.curriculum_improvement_suggestions || '',
            work_awards: alumniData.work_awards || [],
            data_privacy_consent: alumniData.data_privacy_consent || false,
            skills: alumniData.skills || '',
            achievements: alumniData.achievements || '',
            special_projects: alumniData.special_projects || '',
            professional_organizations: alumniData.professional_organizations || '',
            is_employed: alumniData.is_employed || '',
            employment_status: alumniData.employment_status || '',
            occupation: alumniData.occupation || '',
            company_name: alumniData.company_name || '',
            company_address: alumniData.company_address || '',
            company_sector: alumniData.company_sector || '',
            business_line: alumniData.business_line || '',
            work_location: alumniData.work_location || '',
            is_first_job: alumniData.is_first_job || false,
            stay_reasons: alumniData.stay_reasons || [],
            first_job_related: alumniData.first_job_related || false,
            first_job_reasons: alumniData.first_job_reasons || [],
            first_job_tenure: alumniData.first_job_tenure || '',
            first_job_acquisition: alumniData.first_job_acquisition || '',
            time_to_first_job: alumniData.time_to_first_job || '',
            first_job_level: alumniData.first_job_level || '',
            current_job_level: alumniData.current_job_level || '',
            initial_salary: alumniData.initial_salary || '',
            curriculum_relevance_first: alumniData.curriculum_relevance_first || '',
            curriculum_relevance_current: alumniData.curriculum_relevance_current || '',
            monthly_salary: alumniData.monthly_salary || '',
            date_employed: alumniData.date_employed || '',
            unemployment_reason: alumniData.unemployment_reason || []
          });
          
          setInitialProfile({
            // Same fields as above
            id: alumniData._id,
            user_id: alumniData.user_id,
            full_name: alumniData.full_name || '',
            // Include all other fields
            // ...copy all the fields from above
            student_id: alumniData.student_id || '',
            course: alumniData.course || 'Bachelor of Science in Computer Science',
            graduation_year: alumniData.graduation_year || '',
            graduation_month: alumniData.graduation_month || '',
            honors_awards: alumniData.honors_awards || '',
            degree_reasons: alumniData.degree_reasons || [],
            degree_reasons_other: alumniData.degree_reasons_other || '',
            advanced_studies: alumniData.advanced_studies || { level: 'None', institution: '', field: '', motivation: '' },
            csc_passer: alumniData.csc_passer || false,
            csc_year: alumniData.csc_year || '',
            professional_exams: alumniData.professional_exams || '',
            certifications: alumniData.certifications || '',
            email: alumniData.email || '',
            phone: alumniData.phone || '',
            address: alumniData.address || '',
            bio: alumniData.bio || '',
            department: alumniData.department || 'IT Department',
            batch: alumniData.batch || '2023',
            social_media: alumniData.social_media || [],
            profile_picture: alumniData.profile_picture || '',
            sex: alumniData.sex || '',
            civil_status: alumniData.civil_status || '',
            birthday: alumniData.birthday ? new Date(alumniData.birthday).toISOString().split('T')[0] : '',
            region_of_origin: alumniData.region_of_origin || '',
            skills: alumniData.skills || '',
            achievements: alumniData.achievements || '',
            special_projects: alumniData.special_projects || '',
            professional_organizations: alumniData.professional_organizations || '',
            is_employed: alumniData.is_employed || '',
            employment_status: alumniData.employment_status || '',
            occupation: alumniData.occupation || '',
            company_name: alumniData.company_name || '',
            company_address: alumniData.company_address || '',
            company_sector: alumniData.company_sector || '',
            business_line: alumniData.business_line || '',
            work_location: alumniData.work_location || '',
            is_first_job: alumniData.is_first_job || false,
            stay_reasons: alumniData.stay_reasons || [],
            first_job_related: alumniData.first_job_related || false,
            first_job_reasons: alumniData.first_job_reasons || [],
            first_job_tenure: alumniData.first_job_tenure || '',
            first_job_acquisition: alumniData.first_job_acquisition || '',
            time_to_first_job: alumniData.time_to_first_job || '',
            first_job_level: alumniData.first_job_level || '',
            current_job_level: alumniData.current_job_level || '',
            initial_salary: alumniData.initial_salary || '',
            curriculum_relevance_first: alumniData.curriculum_relevance_first || '',
            curriculum_relevance_current: alumniData.curriculum_relevance_current || '',
            monthly_salary: alumniData.monthly_salary || '',
            date_employed: alumniData.date_employed || '',
            unemployment_reason: alumniData.unemployment_reason || []
          });
          
          // Start in edit mode so user can immediately make changes
          setIsEditing(true);
        } catch (fetchError) {
          console.error('Error fetching existing profile:', fetchError);
          toast.error('Could not retrieve your existing profile');
        }
      } else {
        // Remove the error message display
        // setErrorMessage('Failed to fetch profile information.');
        
        // Instead, silently initialize an empty profile
        setProfile({
          user_id: currentUser.id || currentUser._id,
          full_name: currentUser.full_name || '',
          student_id: currentUser.student_id || '',
          course: '',
          graduation_year: currentUser.graduation_year || '',
          graduation_month: '',
          email: currentUser.email || '',
          department: '',
          batch: '',
          social_media: []
        });
        setIsEditing(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch CVSU courses
  const fetchCVSUCourses = async () => {
    try {
      const response = await referenceService.getCVSUCourses();
      setCourses(response.data);
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
  const uploadProfilePicture = async () => {
    if (!profilePicture || !profile.id) {
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
        const response = await alumniService.uploadProfilePicture(profile.id, profilePicture);
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
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSuccessMessage('');
    
    // Reset form to original data
    if (initialProfile) {
      setProfile(initialProfile);
    }
  };

  // Debug function to help identify validation issues
  const logProfileDataForDebugging = (data) => {
    console.group('Profile Data Validation Debug');
    console.log('Full profile data:', data);
    
    // Check for required fields
    const requiredFields = [
      'user_id', 'student_id', 'full_name', 'email', 
      'graduation_year', 'department', 'course', 'batch'
    ];
    
    console.log('Required fields check:');
    requiredFields.forEach(field => {
      const value = data[field];
      const valid = !!value && 
        (typeof value !== 'string' || value.trim() !== '') && 
        (field !== 'student_id' || value.length >= 5) &&
        (field !== 'full_name' || value.length >= 2);
        
      console.log(`${field}: ${value} (${typeof value}) - ${valid ? '✅ Valid' : '❌ Invalid'}`);
    });
    
    // Check complex objects
    if (data.achievements) {
      console.log('Achievements:', 
        Array.isArray(data.achievements) ? 
        `Array with ${data.achievements.length} items` : 
        `Not an array: ${typeof data.achievements}`
      );
      
      if (Array.isArray(data.achievements) && data.achievements.length > 0) {
        console.log('First achievement:', data.achievements[0]);
      }
    }
    
    if (data.competencies_from_college) {
      console.log('Competencies:', 
        Array.isArray(data.competencies_from_college) ? 
        `Array with ${data.competencies_from_college.length} items` : 
        `Not an array: ${typeof data.competencies_from_college}`
      );
    }
    
    // Check date/number fields
    if (data.birthday) {
      console.log('Birthday:', data.birthday, 'Valid date:', !isNaN(new Date(data.birthday).getTime()));
    }
    
    if (data.graduation_year) {
      const year = parseInt(data.graduation_year, 10);
      console.log('Graduation year:', data.graduation_year, 
        'Parsed:', year, 
        'Valid:', !isNaN(year) && year >= 1948 && year <= new Date().getFullYear()
      );
    }
    
    console.groupEnd();
    return data; // Return the data unchanged for chaining
  };

  const saveProfile = async () => {
    setLoading(true);
    setSuccessMessage('');
    
    try {
      // Validate fields
      const errors = validateForm();
      
      if (Object.keys(errors).length > 0) {
        console.log('Validation errors:', errors);
        setValidationErrors(errors);
        toast.error('Please fix the errors in the form');
        setLoading(false);
        return;
      }
      
      // Create a copy of the profile to send to the API
      const profileData = { ...profile };
      
      // Remove empty values
      Object.keys(profileData).forEach(key => {
        if (profileData[key] === null || profileData[key] === undefined || profileData[key] === '') {
          delete profileData[key];
        }
      });
      
      // Make sure we have the user_id
      if (!profileData.user_id && currentUser) {
        profileData.user_id = currentUser.id || currentUser._id;
      }
      
      let response;
      
      // If profile has an ID, update the existing profile
      if (profileData.id) {
        console.log("Updating existing profile:", profileData.id);
        try {
          response = await alumniService.updateProfile(profileData);
          toast.success('Profile updated successfully');
        } catch (error) {
          console.error('Error updating profile:', error);
          
          if (error.response?.status === 422) {
            // Validation error from the API
            let errorMessage = 'Validation failed: ';
            
            if (Array.isArray(error.response.data.detail)) {
              // Extract field names and error messages
              const fieldErrors = error.response.data.detail.map(err => {
                const field = err.loc[err.loc.length - 1];
                return `${field} (${err.msg})`;
              });
              errorMessage += fieldErrors.join(', ');
            } else {
              errorMessage += error.response.data.detail || 'Please check your information';
            }
            
            toast.error(errorMessage);
          } else {
            toast.error('Failed to update profile: ' + (error.message || 'Please check your information and try again.'));
          }
          setLoading(false);
          return;
        }
      } else {
        // If no ID, try to get the existing profile first to avoid duplication
        try {
          const userId = profileData.user_id;
          const existingProfileResponse = await alumniService.getAlumniByUserId(userId);
          
          if (existingProfileResponse && existingProfileResponse.data && existingProfileResponse.data._id) {
            // If profile exists, update it instead of creating a new one
            profileData.id = existingProfileResponse.data._id;
            console.log("Found existing profile, updating instead:", profileData.id);
            response = await alumniService.updateProfile(profileData);
            toast.success('Profile updated successfully');
          }
        } catch (checkError) {
          // If profile doesn't exist, continue with creation
          console.log("No existing profile found, creating new one");
          try {
            response = await alumniService.createProfile(profileData);
            
            // Check if the response was from an existing profile fetch instead of creation
            if (response.config && response.config.url.includes('/alumni/user/')) {
              console.log('Received existing profile from createProfile instead of creating new one');
              profileData.id = response.data._id;
              // Now update this profile instead
              response = await alumniService.updateProfile(profileData);
              toast.success('Profile updated successfully');
            } else {
              toast.success('Profile created successfully!');
            }
          } catch (error) {
            console.error('Error creating profile:', error);
            
            // Check if error is due to profile already existing
            if (error.response?.data?.detail === "Alumni profile already exists for this user") {
              toast.info('An alumni profile already exists for your account. Loading your profile...');
              
              // Fetch the existing profile instead
              try {
                const userId = profileData.user_id;
                const existingProfile = await alumniService.getAlumniByUserId(userId);
                setProfile(existingProfile.data);
                setInitialProfile(existingProfile.data);
                setIsEditing(false);
                setLoading(false);
                return;
              } catch (fetchError) {
                toast.error('Failed to load your existing profile.');
              }
            } else if (error.response?.status === 422) {
              // Validation error from the API
              let errorMessage = 'Validation failed: ';
              
              if (Array.isArray(error.response.data.detail)) {
                // Extract field names and error messages
                const fieldErrors = error.response.data.detail.map(err => {
                  const field = err.loc[err.loc.length - 1];
                  return `${field} (${err.msg})`;
                });
                errorMessage += fieldErrors.join(', ');
              } else {
                errorMessage += error.response.data.detail || 'Please check your information';
              }
              
              toast.error(errorMessage);
            } else {
              // For other errors
              toast.error('Failed to create profile: ' + (error.message || 'Please check your information and try again.'));
            }
            setLoading(false);
            return;
          }
        }
      }
      
      // Update the local state with the response data
      setProfile(response.data);
      setInitialProfile(response.data);
      setIsEditing(false);
      
    } catch (error) {
      console.error('Unexpected error saving profile:', error);
      toast.error('An unexpected error occurred while saving your profile.');
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
      // Extract the date parts from the dateString (YYYY-MM-DD)
      const parts = dateString.split('T')[0].split('-');
      if (parts.length !== 3) {
        console.error('Invalid date format, expected YYYY-MM-DD:', dateString);
        return null;
      }
      
      // Send date with time set to midnight (00:00:00) in ISO format
      // but WITHOUT any timezone information
      return `${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return null;
    }
  };

  // Form validation function
  const validateForm = () => {
    const errors = {};
    
    // Required fields validation
    if (!profile.full_name) errors.full_name = "Full name is required";
    if (!profile.student_id) errors.student_id = "Student ID is required";
    if (!profile.course) errors.course = "Course is required";
    if (!profile.department) errors.department = "Department is required";
    if (!profile.batch) errors.batch = "Batch is required";
    if (!profile.email) errors.email = "Email is required";
    
    // Email format validation
    if (profile.email && !/\S+@\S+\.\S+/.test(profile.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    // Student ID format validation
    if (profile.student_id && !/^[A-Za-z0-9-]+$/.test(profile.student_id)) {
      errors.student_id = "Student ID can only contain letters, numbers, and hyphens";
    }
    
    // Graduation year validation
    if (!profile.graduation_year) {
      errors.graduation_year = "Graduation year is required";
    } else {
      const year = parseInt(profile.graduation_year);
      const currentYear = new Date().getFullYear();
      if (isNaN(year)) {
        errors.graduation_year = "Graduation year must be a valid number";
      } else if (year < 1948) {
        errors.graduation_year = "Graduation year cannot be before 1948";
      } else if (year > currentYear) {
        errors.graduation_year = "Graduation year cannot be in the future";
      }
    }
    
    // Graduation month validation
    if (profile.graduation_month && !["April", "September", "November"].includes(profile.graduation_month)) {
      errors.graduation_month = "Graduation month must be April, September, or November";
    }
    
    // CSC year validation
    if (profile.csc_passer && profile.csc_year) {
      const year = parseInt(profile.csc_year);
      const currentYear = new Date().getFullYear();
      if (isNaN(year)) {
        errors.csc_year = "CSC year must be a valid number";
      } else if (year < 1948) {
        errors.csc_year = "CSC year cannot be before 1948";
      } else if (year > currentYear) {
        errors.csc_year = "CSC year cannot be in the future";
      }
    } else if (profile.csc_passer && !profile.csc_year) {
      errors.csc_year = "Please enter the year when you passed the CSC exam";
    }
    
    // Advanced studies validation
    if (profile.advanced_studies && profile.advanced_studies.level !== 'None') {
      if (!profile.advanced_studies.institution) {
        errors.advanced_studies_institution = "Institution is required when specifying advanced studies";
      }
      if (!profile.advanced_studies.field) {
        errors.advanced_studies_field = "Field of study is required when specifying advanced studies";
      }
    }
    
    // Phone number validation
    if (profile.phone && !/^\+?[0-9]{8,20}$/.test(profile.phone)) {
      errors.phone = "Please enter a valid phone number";
    }
    
    // Address length validation
    if (profile.address && profile.address.length > 200) {
      errors.address = "Address must be 200 characters or less";
    }
    
    // Validate social media urls
    if (profile.social_media && profile.social_media.length > 0) {
      profile.social_media.forEach((social, index) => {
        if (social.platform && !social.url) {
          errors[`social_media_${index}_url`] = "URL is required when platform is selected";
        } else if (social.url && !social.platform) {
          errors[`social_media_${index}_platform`] = "Platform is required when URL is provided";
        } else if (social.url && !isValidURL(social.url)) {
          errors[`social_media_${index}_url`] = "Invalid URL format";
        }
      });
    }
    
    // Validate birthday
    if (profile.birthday) {
      try {
        const birthDate = new Date(profile.birthday);
        const today = new Date();
        
        if (isNaN(birthDate.getTime())) {
          errors.birthday = "Invalid date format";
        } else if (birthDate > today) {
          errors.birthday = "Birthday cannot be in the future";
        }
        
        // Check if alumni is at least 16 years old
        const minAge = 16;
        const minDate = new Date();
        minDate.setFullYear(today.getFullYear() - minAge);
        
        if (birthDate > minDate) {
          errors.birthday = `Alumni must be at least ${minAge} years old`;
        }
        
        // Check if birthday is reasonable (not more than 100 years ago)
        const maxAge = 100;
        const maxDate = new Date();
        maxDate.setFullYear(today.getFullYear() - maxAge);
        
        if (birthDate < maxDate) {
          errors.birthday = `Birthday indicates age greater than ${maxAge} years`;
        }
      } catch (error) {
        console.error('Error validating birthday:', error);
        // Don't add validation errors if the birthday is being removed anyway
      }
    }
    
    // If employed, validate required employment fields
    if (profile.is_employed === "Yes") {
      if (!profile.occupation) {
        errors.occupation = "Occupation is required when employed";
      }
      if (!profile.company_name) {
        errors.company_name = "Company name is required when employed";
      }
      if (!profile.employment_status) {
        errors.employment_status = "Employment status is required when employed";
      }
    }
    
    // If unemployed, validate unemployment reason
    if ((profile.is_employed === "No" || profile.is_employed === "Never Employed") && 
        (!profile.unemployment_reason || profile.unemployment_reason.length === 0)) {
      errors.unemployment_reason = "Please specify at least one reason for unemployment";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
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
    const baseClass = "max-w-lg block w-full shadow-sm focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm border-gray-300 rounded-md";
    return validationErrors[fieldName] 
      ? `${baseClass} border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500` 
      : baseClass;
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
    { id: 'personal', name: 'Personal Information' },
    { id: 'education', name: 'Educational Background' },
    { id: 'eligibility', name: 'Eligibility & Licensure' },
    { id: 'employment', name: 'Employment Data' },
    { id: 'skills', name: 'Skills & Abilities' },
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
    <div className="bg-white shadow sm:rounded-lg relative">
      {/* Profile header */}
      <div className="px-4 py-5 sm:px-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Alumni Profile
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Your personal information and academic details
            </p>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-cvsu-green hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
            >
              <PencilIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
              Edit
            </button>
          )}
        </div>

        {/* Profile Completion Indicator */}
        <div className="mt-6">
          {profile && (
            <>
              {(() => {
                // Calculate profile completion percentage
                const requiredFields = ['full_name', 'student_id', 'email', 'department', 'course', 'batch', 'graduation_year'];
                const recommendedFields = [
                  'phone', 'address', 'bio', 'sex', 'civil_status', 'birthday', 'region_of_origin',
                  'is_employed', 'csc_passer', 'honors_awards', 'degree_reasons'
                ];
                
                // Count completed required fields
                const completedRequired = requiredFields.filter(field => 
                  profile[field] && profile[field].toString().trim() !== ''
                ).length;
                
                // Count completed recommended fields
                const completedRecommended = recommendedFields.filter(field => {
                  // Handle array fields
                  if (Array.isArray(profile[field])) {
                    return profile[field].length > 0;
                  }
                  // Handle boolean fields
                  if (typeof profile[field] === 'boolean') {
                    return true; // If it's a boolean value, it's considered filled
                  }
                  // Handle regular fields
                  return profile[field] && profile[field].toString().trim() !== '';
                }).length;
                
                // Calculate overall percentage (weight required fields more heavily)
                const totalFields = requiredFields.length + recommendedFields.length;
                const requiredWeight = 0.7; // Required fields are 70% of completion
                const recommendedWeight = 0.3; // Recommended fields are 30% of completion
                
                const requiredCompletion = (completedRequired / requiredFields.length) * requiredWeight;
                const recommendedCompletion = (completedRecommended / recommendedFields.length) * recommendedWeight;
                
                const completionPercentage = Math.round((requiredCompletion + recommendedCompletion) * 100);
                
                // Determine status color based on completion
                let statusColor = 'bg-red-500';
                let statusText = 'Needs Attention';
                
                if (completionPercentage >= 85) {
                  statusColor = 'bg-green-500';
                  statusText = 'Excellent';
                } else if (completionPercentage >= 60) {
                  statusColor = 'bg-yellow-500';
                  statusText = 'Good Progress';
                } else if (completionPercentage >= 30) {
                  statusColor = 'bg-orange-500';
                  statusText = 'Getting Started';
                }
                
                return (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Profile Completion</h4>
                      <span className="text-sm font-medium text-gray-700">{completionPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`${statusColor} h-2.5 rounded-full transition-all duration-500 ease-in-out`} 
                        style={{width: `${completionPercentage}%`}}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">Status: <span className="font-medium">{statusText}</span></span>
                      {completedRequired < requiredFields.length && (
                        <span className="text-xs text-red-600">
                          Missing required fields: {requiredFields.length - completedRequired}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id 
                    ? 'border-cvsu-green text-cvsu-green' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Status Messages */}
        {successMessage && (
          <div className="mt-4 rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profile content */}
      <div className="border-t border-gray-200">
        <dl>
          {/* Personal Information Tab Content */}
          {activeTab === 'personal' && (
            <div className="bg-white shadow-sm rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Personal Information</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Your basic personal details</p>
              </div>
              
              <div className="px-4 py-5 sm:p-6">
                {/* Profile Picture Section */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Profile Picture</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <div className="flex items-center space-x-5">
                      <div className="flex-shrink-0">
                        <div className="relative h-16 w-16 rounded-full overflow-hidden bg-gray-100">
                          {previewUrl ? (
                            <>
                              {/* Debug info - remove in production */}
                              {console.log('Rendering image with URL:', previewUrl)}
                              <img 
                                src={previewUrl} 
                                alt="Profile" 
                                className="h-full w-full object-cover"
                                // Add key to force React to recreate the image element when URL changes
                                key={previewUrl?.substring(0, 30)} // Use just the beginning of the URL as key to avoid overly long keys
                                // Add onLoad handler to confirm successful loading
                                onLoad={() => console.log('Profile image loaded successfully')}
                                // Add onError handler to handle any loading issues
                                onError={(e) => {
                                  console.error('Error loading profile image:', previewUrl?.substring(0, 30) + '...');
                                  e.target.onerror = null; // Prevent infinite fallback loop
                                  
                                  // If localStorage image is available, try that as fallback
                                  if (profile.user_id) {
                                    const localImage = getImageFromLocalStorage(profile.user_id);
                                    if (localImage && localImage !== previewUrl) {
                                      console.log('Falling back to localStorage image');
                                      e.target.src = localImage;
                                      return;
                                    }
                                  }
                                  
                                  // If we got here, both approaches failed
                                  console.log('All image loading attempts failed, using default avatar');
                                  // Set display to none and let the parent SVG show through
                                  e.target.style.display = 'none';
                                }}
                              />
                            </>
                          ) : (
                            <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          )}
                        </div>
                      </div>
                      {isEditing && (
                        <div>
                          <div className="flex text-sm text-gray-600">
                            <label
                              htmlFor="profile-picture-upload"
                              className="relative cursor-pointer rounded-md bg-white font-medium text-cvsu-green hover:text-cvsu-green/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-cvsu-green"
                            >
                              <span>Upload a file</span>
                              <input id="profile-picture-upload" name="profile-picture-upload" type="file" accept="image/*" className="sr-only" onChange={handleProfilePictureChange} />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                          {profilePicture && (
                            <button
                              type="button"
                              disabled={isUploading}
                              onClick={uploadProfilePicture}
                              className="mt-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-cvsu-green bg-cvsu-green/10 hover:bg-cvsu-green/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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

                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Student ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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

                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Sex</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Civil Status</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">
                Birthday
                <div className="mt-1 text-xs text-gray-400 font-normal">
                  Date of birth information
                </div>
                <div className="mt-1 text-xs text-red-500 font-normal">
                  (Temporarily disabled - will be available in a future update)
                </div>
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {isEditing ? (
                  <div className="text-sm text-gray-500">
                    Birthday field is temporarily disabled. Please complete other profile information.
                  </div>
                ) : (
                  profile.birthday ? new Date(profile.birthday).toLocaleDateString() : 'Not provided'
                )}
              </dd>
                </div>

                {/* Region of Origin */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Region of Origin</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">
                    Address
                    <div className="mt-1 text-xs text-gray-400 font-normal">
                      Maximum 200 characters
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {isEditing ? (
                      <div>
                        <textarea
                          name="address"
                          id="address"
                          rows={3}
                          maxLength={200}
                          value={profile.address || ''}
                          onChange={handleInputChange}
                          className={getInputClass('address')}
                        />
                        <div className="mt-1 text-xs text-gray-500">
                          {profile.address ? `${profile.address.length}/200 characters` : '0/200 characters'}
                        </div>
                      </div>
                    ) : (
                      profile.address || 'Not provided'
                    )}
                    <FieldError name="address" />
                  </dd>
                </div>

                {/* Bio */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Bio</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Social Media</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                                  <div className="text-xs text-gray-500 truncate max-w-[200px]">{social.url}</div>
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
            <div className="bg-white shadow-sm rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Educational Background</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Your academic history and achievements</p>
              </div>
              
              <div className="px-4 py-5 sm:p-6">
                {/* Department, Batch, Course fields */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Department</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {isEditing ? (
                      <input
                        type="text"
                        name="department"
                        id="department"
                        value={profile.department}
                        onChange={handleInputChange}
                        className={getInputClass('department')}
                      />
                    ) : (
                      profile.department
                    )}
                    <FieldError name="department" />
                  </dd>
                </div>
                
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Course</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {isEditing ? (
                      <select
                        name="course"
                        id="course"
                        value={profile.course}
                        onChange={handleInputChange}
                        className={getInputClass('course')}
                      >
                        <option value="">Select course</option>
                        {courses.map((course, index) => (
                          <option key={index} value={course}>{course}</option>
                        ))}
                      </select>
                    ) : (
                      profile.course
                    )}
                    <FieldError name="course" />
                  </dd>
                </div>
                
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Batch</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {isEditing ? (
                      <input
                        type="text"
                        name="batch"
                        id="batch"
                        value={profile.batch}
                        onChange={handleInputChange}
                        className={getInputClass('batch')}
                      />
                    ) : (
                      profile.batch
                    )}
                    <FieldError name="batch" />
                  </dd>
                </div>
                
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Graduation Year</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {isEditing ? (
                      <input
                        type="number"
                        name="graduation_year"
                        id="graduation_year"
                        min="1948"
                        max={new Date().getFullYear()}
                        value={profile.graduation_year}
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Graduation Period</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Honors/Awards Received
                    <div className="mt-1 text-xs text-gray-400 font-normal">
                      List any academic honors, dean's list awards, or scholarships you received
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Reasons for Pursuing Degree</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                            <label htmlFor={`reason-${index}`} className="ml-2 block text-sm text-gray-700">
                              {reason}
                            </label>
                          </div>
                        ))}
                        <div>
                          <label htmlFor="reason-other" className="block text-sm text-gray-700 mb-1">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Advanced Studies</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                              <label className="block text-sm text-gray-700 mb-1">
                                Institution
                              </label>
                              <input
                                type="text"
                                name="advanced_studies_institution"
                                value={profile.advanced_studies.institution || ''}
                                onChange={(e) => setProfile({
                                  ...profile,
                                  advanced_studies: {
                                    ...profile.advanced_studies,
                                    institution: e.target.value
                                  }
                                })}
                                className={getInputClass('advanced_studies_institution')}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">
                                Field of Study
                              </label>
                              <input
                                type="text"
                                name="advanced_studies_field"
                                value={profile.advanced_studies.field || ''}
                                onChange={(e) => setProfile({
                                  ...profile,
                                  advanced_studies: {
                                    ...profile.advanced_studies,
                                    field: e.target.value
                                  }
                                })}
                                className={getInputClass('advanced_studies_field')}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">
                                Motivation
                              </label>
                              <textarea
                                name="advanced_studies_motivation"
                                rows={3}
                                value={profile.advanced_studies.motivation || ''}
                                onChange={(e) => setProfile({
                                  ...profile,
                                  advanced_studies: {
                                    ...profile.advanced_studies,
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
            <div className="bg-white shadow-sm rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Eligibility & Licensure</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Information about your professional credentials and certifications</p>
              </div>
              
              <div className="px-4 py-5 sm:p-6">
                {/* Civil Service Eligibility */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Civil Service Professional (CSC) Passer
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                              <label htmlFor="csc_passer_yes" className="ml-2 block text-sm text-gray-700">
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
                              <label htmlFor="csc_passer_no" className="ml-2 block text-sm text-gray-700">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Professional Examination(s) Passed
                    <div className="mt-1 text-xs text-gray-400 font-normal">
                      PRC Licensure Examinations and the like
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Certification
                    <div className="mt-1 text-xs text-gray-400 font-normal">
                      NC Level, Microsoft Certificates, CISCO Certificates, etc. (Be Specific)
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
            <div className="bg-white shadow-sm rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Employment Data</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Information about your current employment status</p>
              </div>
              
              <div className="px-4 py-5 sm:p-6">
                {/* Employment Status */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Are you presently employed? (Self-employed considered "employed")
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                              <label htmlFor={`employed_${option.toLowerCase().replace(' ', '_')}`} className="ml-2 block text-sm text-gray-700">
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
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-t border-gray-200">
                    <dt className="text-sm font-medium text-gray-500">
                      Reason(s) why you are not yet employed
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                          <label htmlFor="reason-advanced-studies" className="ml-2 block text-sm text-gray-700">
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
                          <label htmlFor="reason-family" className="ml-2 block text-sm text-gray-700">
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
                          <label htmlFor="reason-no-job" className="ml-2 block text-sm text-gray-700">
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
                          <label htmlFor="reason-no-match" className="ml-2 block text-sm text-gray-700">
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
                          <label htmlFor="reason-salary" className="ml-2 block text-sm text-gray-700">
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
                          <label htmlFor="reason-health" className="ml-2 block text-sm text-gray-700">
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
                          <label htmlFor="reason-employment-strain" className="ml-2 block text-sm text-gray-700">
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
                          <label htmlFor="reason-other" className="ml-2 block text-sm text-gray-700">
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
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-t border-gray-200">
                    <dt className="text-sm font-medium text-gray-500">
                      Reason(s) why you are not yet employed
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Employment Type
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Present Occupation
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Name of Your Company or Organization?
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Complete address of your organization or institution?
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Company Sector
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Business Line
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Work Location
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Is this your first job?
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                              <label htmlFor="is_first_job_yes" className="ml-2 block text-sm text-gray-700">
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
                              <label htmlFor="is_first_job_no" className="ml-2 block text-sm text-gray-700">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Reasons for staying on the job
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                                  className="ml-2 block text-sm text-gray-700"
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Is your first job related to your course?
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                              <label htmlFor="first_job_related_yes" className="ml-2 block text-sm text-gray-700">
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
                              <label htmlFor="first_job_related_no" className="ml-2 block text-sm text-gray-700">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Reasons for accepting first job
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                                  className="ml-2 block text-sm text-gray-700"
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        How long did you stay in your first job?
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        How did you find your first job?
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        How long did it take to find your first job?
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Level of your first job
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Level of your current job
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Initial Salary (First Job)
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Relevance of curriculum to first job
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Relevance of curriculum to current job
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Date Employed
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Monthly Salary Range
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
            <div className="bg-white shadow-sm rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Skills & Abilities</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Share your professional skills and achievements</p>
              </div>
              
              <div className="px-4 py-5 sm:p-6">
                {/* Professional Skills */}
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Professional Skills
                    <div className="mt-1 text-xs text-gray-400 font-normal">
                      List your key professional skills
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Achievements
                    <div className="mt-1 text-xs text-gray-400 font-normal">
                      List your notable achievements and awards
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Special Projects
                    <div className="mt-1 text-xs text-gray-400 font-normal">
                      Describe any significant projects you've worked on
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Professional Organizations
                    <div className="mt-1 text-xs text-gray-400 font-normal">
                      List any professional groups or associations you belong to
                    </div>
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
            {successMessage && (
              <p className="text-sm font-medium text-green-600 truncate max-w-sm md:max-w-md">
                {successMessage}
              </p>
            )}
            {!successMessage && (
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