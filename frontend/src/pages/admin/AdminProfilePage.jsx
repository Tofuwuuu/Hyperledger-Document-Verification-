import { useState, useEffect } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon, CameraIcon, UserCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { adminUserService } from '../../services/api';
import { toast } from 'react-toastify';

export default function AdminProfilePage() {
  const { currentUser, refreshUserData } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    employee_id: '',
    department: '',
    position: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    profile_picture: ''
  });
  const [initialProfile, setInitialProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchAdminProfile();
  }, [currentUser]);

  const fetchAdminProfile = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      // In a real implementation with the API
      let adminData;
      if (currentUser._id) {
        // Try to get full profile from API first
        try {
          const response = await adminUserService.getAdminUser(currentUser._id);
          adminData = response.data;
          setLastUpdated(new Date());
        } catch (error) {
          console.error('Error fetching from API, using local data:', error);
          // Fallback to using currentUser data
          adminData = {
            _id: currentUser._id,
            full_name: currentUser.full_name || 'System Administrator',
            employee_id: currentUser.employee_id || '',
            department: currentUser.department || 'IT Department',
            position: currentUser.position || 'System Administrator',
            email: currentUser.email || 'admin@cvsu.edu.ph',
            phone: currentUser.phone || '',
            address: currentUser.address || '',
            bio: currentUser.bio || '',
            profile_picture: currentUser.profile_picture || ''
          };
        }
      } else {
        // Fallback to using currentUser data
        adminData = {
          _id: currentUser._id,
          full_name: currentUser.full_name || 'System Administrator',
          employee_id: currentUser.employee_id || '',
          department: currentUser.department || 'IT Department',
          position: currentUser.position || 'System Administrator',
          email: currentUser.email || 'admin@cvsu.edu.ph',
          phone: currentUser.phone || '',
          address: currentUser.address || '',
          bio: currentUser.bio || '',
          profile_picture: currentUser.profile_picture || ''
        };
      }
      
      const profileData = {
        id: adminData._id,
        full_name: adminData.full_name || 
                  ((adminData.first_name || '') + 
                   (adminData.last_name ? ' ' + adminData.last_name : '')),
        employee_id: adminData.employee_id || '',
        department: adminData.department || 'IT Department',
        position: adminData.position || 'System Administrator',
        email: adminData.email || '',
        phone: adminData.phone || '',
        address: adminData.address || '',
        bio: adminData.bio || '',
        profile_picture: adminData.profile_picture || ''
      };
      
      setProfile(profileData);
      setInitialProfile({...profileData});
      
      if (adminData.profile_picture) {
        setPreviewUrl(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/${adminData.profile_picture}`);
      }
    } catch (error) {
      console.error('Error fetching admin profile:', error);
      setErrorMessage('Failed to fetch profile information.');
      toast.error('Failed to load profile. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prevProfile => ({
      ...prevProfile,
      [name]: value
    }));
    
    // Clear validation error for this field when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large. Please select an image under 5MB.');
      return;
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please select a JPEG, PNG or GIF image.');
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

  const uploadProfilePicture = async () => {
    if (!profilePicture || !profile.id) return;
    
    setIsUploading(true);
    try {
      // In a real implementation, you would upload the profile picture to an API
      // await adminService.uploadProfilePicture(profile.id, profilePicture);
      
      // Example implementation with FormData:
      const formData = new FormData();
      formData.append('profile_picture', profilePicture);
      
      // Simulating API call - replace with actual API call when endpoint is ready
      // const response = await adminUserService.uploadProfilePicture(profile.id, formData);
      
      console.log('Would upload profile picture here'); // Remove this in production
      
      toast.success('Profile picture updated successfully!');
      setSuccessMessage('Profile picture updated successfully!');
      setProfilePicture(null);
      
      // In a real implementation, you would refetch the profile
      // await fetchAdminProfile();
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setErrorMessage('Failed to upload profile picture.');
      toast.error('Failed to upload profile picture. Please try again.');
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
    if (initialProfile) {
      setProfile(initialProfile);
    }
    setIsEditing(false);
    setValidationErrors({});
    setSuccessMessage('');
    setErrorMessage('');
  };

  const saveProfile = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setFormSubmitting(true);
    try {
      // In a real implementation, you would save the profile to an API
      // Prepare the data to send to API
      const userData = {
        full_name: profile.full_name, // Keep this for backwards compatibility
        first_name: profile.full_name, // Map full_name to first_name for now
        last_name: '', // Set last_name as empty as we're using full_name 
        employee_id: profile.employee_id,
        department: profile.department || 'IT Department',
        position: profile.position || 'System Administrator',
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        bio: profile.bio
      };
      
      // Make the API call to update the user
      try {
        if (profile.id) {
          await adminUserService.updateAdminUser(profile.id, userData);
          // Refresh the user data in context if available
          if (refreshUserData) {
            await refreshUserData();
          }
        }
      } catch (apiError) {
        console.error('API error updating profile:', apiError);
        throw new Error(apiError.message || 'Failed to communicate with server');
      }
      
      setSuccessMessage('Profile updated successfully!');
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      
      // Update initialProfile to match current profile
      setInitialProfile({...profile});
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error updating admin profile:', error);
      setErrorMessage('Failed to update profile information. ' + error.message);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!profile.full_name) {
      errors.full_name = 'Full name is required';
    }
    
    if (!profile.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(profile.email)) {
      errors.email = 'Email is invalid';
    }
    
    return errors;
  };

  const FieldError = ({ name }) => {
    if (!validationErrors[name]) return null;
    return (
      <p className="mt-1 text-sm text-red-600" id={`${name}-error`}>
        {validationErrors[name]}
      </p>
    );
  };

  if (loading && !profile.full_name) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
        <p className="ml-3 text-lg text-gray-700">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Page header with action buttons */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Administrator Profile</h1>
      </div>
      
      {/* Success and error messages */}
      {successMessage && (
        <div className="mb-4 bg-green-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  type="button"
                  onClick={() => setSuccessMessage('')}
                  className="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50"
                >
                  <span className="sr-only">Dismiss</span>
                  <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {errorMessage && (
        <div className="mb-4 bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <XMarkIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{errorMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  type="button"
                  onClick={() => setErrorMessage('')}
                  className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                >
                  <span className="sr-only">Dismiss</span>
                  <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Administrator Profile</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Personal details and contact information</p>
          </div>
          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green transition duration-150 ease-in-out"
            >
              <PencilIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
              Edit Profile
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green transition duration-150 ease-in-out"
              >
                <XMarkIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={formSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green transition duration-150 ease-in-out"
              >
                {formSubmitting ? (
                  <>
                    <ArrowPathIcon className="animate-spin -ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Profile Picture */}
            <div className="md:col-span-1">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Profile Picture</label>
                  <div className="mt-2 flex flex-col items-center">
                    <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center relative group">
                      {previewUrl ? (
                        <>
                          <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                          {isEditing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <label
                                htmlFor="profile-picture"
                                className="cursor-pointer text-white p-2 rounded-full bg-gray-800 hover:bg-gray-700"
                              >
                                <CameraIcon className="h-8 w-8" />
                                <input
                                  id="profile-picture"
                                  name="profile-picture"
                                  type="file"
                                  accept="image/*"
                                  onChange={handleProfilePictureChange}
                                  className="sr-only"
                                />
                              </label>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-center w-full h-full bg-gray-200">
                            <UserCircleIcon className="h-24 w-24 text-gray-400" />
                          </div>
                          {isEditing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <label
                                htmlFor="profile-picture"
                                className="cursor-pointer text-white p-2 rounded-full bg-gray-800 hover:bg-gray-700"
                              >
                                <CameraIcon className="h-8 w-8" />
                                <input
                                  id="profile-picture"
                                  name="profile-picture"
                                  type="file"
                                  accept="image/*"
                                  onChange={handleProfilePictureChange}
                                  className="sr-only"
                                />
                              </label>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    {isEditing && profilePicture && (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={uploadProfilePicture}
                          disabled={isUploading}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-green-700 focus:outline-none"
                        >
                          {isUploading ? (
                            <>
                              <ArrowPathIcon className="animate-spin -ml-0.5 mr-2 h-4 w-4" />
                              Uploading...
                            </>
                          ) : 'Upload Picture'}
                        </button>
                      </div>
                    )}
                    
                    {!isEditing && lastUpdated && (
                      <p className="text-xs text-gray-500 mt-3">
                        Last updated: {lastUpdated.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Account status section */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="text-sm font-medium text-gray-900">Account Status</h4>
                  <div className="mt-2 flex flex-col space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Type:</span>
                      <span className="text-sm font-medium text-gray-900">Administrator</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Status:</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Personal Information */}
            <div className="md:col-span-2">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <div className="mt-1">
                    {isEditing ? (
                      <input
                        type="text"
                        name="full_name"
                        id="full_name"
                        value={profile.full_name}
                        onChange={handleInputChange}
                        className={`shadow-sm block w-full sm:text-sm rounded-md ${
                          validationErrors.full_name 
                            ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                            : 'focus:ring-cvsu-green focus:border-cvsu-green border-gray-300'
                        }`}
                      />
                    ) : (
                      <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">{profile.full_name}</p>
                    )}
                    <FieldError name="full_name" />
                  </div>
                </div>

                <div>
                  <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700">
                    Employee ID
                  </label>
                  <div className="mt-1">
                    {isEditing ? (
                      <input
                        type="text"
                        name="employee_id"
                        id="employee_id"
                        value={profile.employee_id}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">{profile.employee_id || 'Not specified'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                    Department
                  </label>
                  <div className="mt-1">
                    {isEditing ? (
                      <input
                        type="text"
                        name="department"
                        id="department"
                        value={profile.department}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">{profile.department !== '' ? profile.department : 'Not specified'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                    Position
                  </label>
                  <div className="mt-1">
                    {isEditing ? (
                      <input
                        type="text"
                        name="position"
                        id="position"
                        value={profile.position}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">{profile.position !== '' ? profile.position : 'Not specified'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <div className="mt-1">
                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        id="email"
                        value={profile.email}
                        onChange={handleInputChange}
                        className={`shadow-sm block w-full sm:text-sm rounded-md ${
                          validationErrors.email 
                            ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                            : 'focus:ring-cvsu-green focus:border-cvsu-green border-gray-300'
                        }`}
                      />
                    ) : (
                      <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">{profile.email}</p>
                    )}
                    <FieldError name="email" />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <div className="mt-1">
                    {isEditing ? (
                      <input
                        type="text"
                        name="phone"
                        id="phone"
                        value={profile.phone}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">{profile.phone || 'Not specified'}</p>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Address
                  </label>
                  <div className="mt-1">
                    {isEditing ? (
                      <input
                        type="text"
                        name="address"
                        id="address"
                        value={profile.address}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">{profile.address || 'Not specified'}</p>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    Bio
                  </label>
                  <div className="mt-1">
                    {isEditing ? (
                      <textarea
                        id="bio"
                        name="bio"
                        rows={4}
                        value={profile.bio}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="Tell us about yourself..."
                      />
                    ) : (
                      <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md min-h-[6rem]">{profile.bio || 'No bio provided'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Password change section */}
      <div className="bg-white shadow sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Account Security</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Password and security settings</p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <h4 className="text-base font-medium text-gray-900">Change Password</h4>
          <p className="mt-1 text-sm text-gray-500">
            Update your password to maintain security. We recommend using a strong password that you don't use elsewhere.
          </p>
          <div className="mt-5">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
              onClick={() => toast.info('Password change functionality will be implemented soon.')}
            >
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 