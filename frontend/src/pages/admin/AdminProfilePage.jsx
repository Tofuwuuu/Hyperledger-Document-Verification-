import { useState, useEffect } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../../config';

export default function AdminProfilePage() {
  const { currentUser } = useAuth();
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
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    fetchAdminProfile();
  }, [currentUser]);

  const fetchAdminProfile = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      console.log('Loading admin profile...');
      
      // Using axios directly with explicit CORS headers
      const response = await axios.get(
        `${API_URL}/admin/profile`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Admin-Bypass': 'true'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.data;
        console.log('Successfully fetched user profile from API:', data);
        
        setProfile({
          id: data._id || data.id,
          full_name: data.full_name,
          employee_id: data.employee_id || '',
          department: data.department || 'IT Department',
          position: data.position || 'System Administrator',
          email: data.email,
          phone: data.phone || '',
          address: data.address || '',
          bio: data.bio || '',
          profile_picture: data.profile_picture || ''
        });
        
        setInitialProfile({
          id: data._id || data.id,
          full_name: data.full_name,
          employee_id: data.employee_id || '',
          department: data.department || 'IT Department',
          position: data.position || 'System Administrator',
          email: data.email,
          phone: data.phone || '',
          address: data.address || '',
          bio: data.bio || '',
          profile_picture: data.profile_picture || ''
        });
        
        // Get the base URL without /api/v1 for profile picture
        const baseUrl = data.profile_picture ? API_URL.replace('/api/v1', '') : '';
        
        if (data.profile_picture) {
          setPreviewUrl(`${baseUrl}/${data.profile_picture}`);
        }
        
        return;
      } else {
        const errorText = await response.text();
        console.warn(`Failed with ${response.status} using ${API_URL}: ${errorText}`);
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching admin profile:', error);
      setErrorMessage('Failed to fetch profile information.');
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
      console.log('Uploading profile picture...');
      
      // Create a FormData object to upload the file
      const formData = new FormData();
      formData.append('profile_picture', profilePicture);
      
      // Make the profile picture upload API call
      const response = await axios.post(
        `${API_URL}/admin/profile/upload-picture`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Admin-Bypass': 'true',
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.ok) {
        console.log('Profile picture uploaded successfully');
        setSuccessMessage('Profile picture updated successfully!');
        setProfilePicture(null);
        
        // Refetch the profile to get the updated picture URL
        fetchAdminProfile();
      } else {
        const errorText = await response.text();
        console.warn(`Failed with ${response.status} using ${API_URL}: ${errorText}`);
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setErrorMessage('Failed to upload profile picture. Check your connection and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const startEditing = () => {
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (initialProfile) {
      setProfile(initialProfile);
    }
    setIsEditing(false);
    setValidationErrors({});
  };

  const saveProfile = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setLoading(true);
    try {
      console.log('Loading admin profile...');
      
      // Using axios directly with explicit CORS headers
      const response = await axios.get(
        `${API_URL}/admin/profile`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Admin-Bypass': 'true'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.data;
        console.log('Successfully fetched user profile from API:', data);
        
        // Format profile data for the API
        const profileData = {
          full_name: profile.full_name,
          email: profile.email,
          department: profile.department,
          position: profile.position,
          phone: profile.phone,
          address: profile.address,
          bio: profile.bio,
          employee_id: profile.employee_id
        };
        
        // Update the user using the API
        const updateResponse = await axios.put(
          `${API_URL}/admin/profile`,
          profileData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'X-Admin-Bypass': 'true'
            }
          }
        );
        
        if (updateResponse.ok) {
          console.log('Profile updated successfully');
          
          // Update local storage user data to reflect changes
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          const updatedStoredUser = {
            ...storedUser,
            ...profileData
          };
          localStorage.setItem('user', JSON.stringify(updatedStoredUser));
          
          setSuccessMessage('Profile updated successfully!');
          setIsEditing(false);
          
          // Refetch the profile to get the latest data
          fetchAdminProfile();
        } else {
          const errorText = await updateResponse.text();
          console.warn(`Failed with ${updateResponse.status} using ${API_URL}: ${errorText}`);
          throw new Error(`Server returned ${updateResponse.status}`);
        }
      } else {
        const errorText = await response.text();
        console.warn(`Failed with ${response.status} using ${API_URL}: ${errorText}`);
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      console.error('Error updating admin profile:', error);
      setErrorMessage('Failed to update profile information. Check your connection and try again.');
    } finally {
      setLoading(false);
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
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
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

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Administrator Profile</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Personal details and contact information</p>
          </div>
          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
            >
              <PencilIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
              Edit
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
              >
                <XMarkIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
              >
                <CheckIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                Save
              </button>
            </div>
          )}
        </div>
        
        <div className="border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 py-5 sm:p-6">
            {/* Profile Picture */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">Profile Picture</label>
              <div className="mt-2 flex flex-col items-center">
                <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-2xl">
                      {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'A'}
                    </span>
                  )}
                </div>
                
                {isEditing && (
                  <div className="mt-4 flex flex-col items-center">
                    <label
                      htmlFor="profile-picture"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer"
                    >
                      Change Picture
                      <input
                        id="profile-picture"
                        name="profile-picture"
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureChange}
                        className="sr-only"
                      />
                    </label>
                    {profilePicture && (
                      <button
                        type="button"
                        onClick={uploadProfilePicture}
                        disabled={isUploading}
                        className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-green-700 focus:outline-none"
                      >
                        {isUploading ? 'Uploading...' : 'Upload Picture'}
                      </button>
                    )}
                  </div>
                )}
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
                        className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{profile.full_name}</p>
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
                      <p className="text-sm text-gray-900">{profile.employee_id || 'Not specified'}</p>
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
                      <p className="text-sm text-gray-900">{profile.department || 'Not specified'}</p>
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
                      <p className="text-sm text-gray-900">{profile.position || 'Not specified'}</p>
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
                        className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{profile.email}</p>
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
                      <p className="text-sm text-gray-900">{profile.phone || 'Not specified'}</p>
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
                      <p className="text-sm text-gray-900">{profile.address || 'Not specified'}</p>
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
                        rows={3}
                        value={profile.bio}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{profile.bio || 'No bio provided'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 