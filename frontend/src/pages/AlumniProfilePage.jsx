import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { CalendarIcon, MapPinIcon, BriefcaseIcon, AcademicCapIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { alumniService, documentService, authService } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AlumniProfilePage({ isAdmin = false, isNew = false }) {
  const { id, alumniId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth(); // Get the current user from auth context
  const profileId = alumniId || id; // Use alumniId from admin routes or id from public routes
  
  // Extract userId from query parameters if present
  const queryParams = new URLSearchParams(location.search);
  const userIdFromQuery = queryParams.get('userId');
  
  const [alumni, setAlumni] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    student_id: '',
    graduation_year: new Date().getFullYear(),
    batch: '',
    course: '',
    department: '',
    sex: '',
    civil_status: '',
    address: '',
    birthday: '',
    region_of_origin: '',
    bio: '',
    current_job: '',
    current_employer: '',
    temp_password: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (!isNew && profileId) {
      fetchAlumniProfile();
    } else if (isNew && userIdFromQuery) {
      // If we're creating a new alumni profile but have a userId, fetch that user's data
      fetchUserData(userIdFromQuery);
    }
  }, [profileId, isNew, userIdFromQuery]);
  
  const fetchUserData = async (userId) => {
    setLoading(true);
    try {
      // Fetch the user information from the auth service
      const userData = await authService.getUserById(userId);
      
      // Populate form with user data
      setFormData(prev => ({
        ...prev,
        full_name: userData.full_name || '',
        email: userData.email || '',
        student_id: userData.student_id || '',
        department: userData.department || '',
        graduation_year: userData.graduation_year || userData.year_graduated || new Date().getFullYear(),
        // Set user_id to link the alumni profile to this user
        user_id: userId
      }));
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Don't set error state here as we don't want to show an error message
      // The form will just start empty
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAlumniProfile = async () => {
    setLoading(true);
    try {
      const response = await alumniService.getProfile(profileId);
      setAlumni(response.data);
      
      // Populate form data for editing
      if (isAdmin) {
        setFormData({
          full_name: response.data.full_name || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
          student_id: response.data.student_id || '',
          graduation_year: response.data.graduation_year || '',
          course: response.data.course || '',
          department: response.data.department || '',
          sex: response.data.sex || '',
          civil_status: response.data.civil_status || '',
          address: response.data.address || '',
          birthday: response.data.birthday ? new Date(response.data.birthday).toISOString().split('T')[0] : '',
          region_of_origin: response.data.region_of_origin || '',
          bio: response.data.bio || '',
          current_job: response.data.current_job || '',
          current_employer: response.data.current_employer || '',
          batch: response.data.batch || '',
          temp_password: '',
        });
      }
      
      // Fetch documents if there are verified documents
      if (response.data.verified_documents && response.data.verified_documents.length > 0) {
        fetchVerifiedDocuments(response.data._id);
      }
    } catch (error) {
      console.error('Error fetching alumni profile:', error);
      setError('Failed to load alumni profile');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchVerifiedDocuments = async (alumniId) => {
    try {
      const response = await documentService.getAlumniDocuments(alumniId);
      // Filter only verified documents
      const verifiedDocs = response.data.filter(doc => doc.verification_status === 'verified');
      setDocuments(verifiedDocs);
    } catch (error) {
      console.error('Error fetching verified documents:', error);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      if (isNew) {
        let userId = userIdFromQuery;
        
        if (isAdmin && !userId) {
          // Only create a new user if we don't already have a userId
          try {
            const userResponse = await authService.register({
              full_name: formData.full_name,
              email: formData.email,
              password: formData.temp_password,
              student_id: formData.student_id,
              graduation_year: parseInt(formData.graduation_year, 10),
              role: 'alumni'
            });
            userId = userResponse.data.user_id;
          } catch (error) {
            console.error('Error creating user account:', error);
            let errorMessage = 'Failed to create user account: ';
            
            if (error.response?.data?.detail) {
              errorMessage += error.response.data.detail;
            } else {
              errorMessage += error.message || 'Please try again';
            }
            
            alert(errorMessage);
            setIsSaving(false);
            return;
          }
        }
        
        // Create new alumni profile
        const profileData = {
          ...formData,
          user_id: userId || currentUser._id,
          graduation_year: parseInt(formData.graduation_year, 10)
        };
        
        // Remove temp_password from profile data
        delete profileData.temp_password;
        
        // Format birthday correctly to prevent timezone issues
        if (profileData.birthday) {
          try {
            // Parse the date string - birthday is typically in YYYY-MM-DD format from the input
            const [year, month, day] = profileData.birthday.split('T')[0].split('-').map(num => parseInt(num, 10));
            
            // Validate the date parts
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
              console.error('Invalid date parts:', { year, month, day });
              profileData.birthday = null;
            } else {
              // Create a date at noon UTC to avoid timezone issues (0-indexed month)
              const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
              
              // Format as YYYY-MM-DDT00:00:00Z using ISO format
              profileData.birthday = date.toISOString().split('.')[0];
              
              console.log('Formatted birthday for API:', profileData.birthday);
            }
          } catch (e) {
            console.error('Error formatting birthday:', e);
            profileData.birthday = null;
          }
        }
        
        console.log('Creating new alumni profile with data:', profileData);
        const response = await alumniService.createProfile(profileData);
        navigate(`/admin/alumni`);
      } else {
        // Update existing profile
        // According to the API, we need to include the ID in the data object
        const updateData = {
          ...formData,
          id: profileId, // Include the alumni ID in the update data
          // Ensure graduation_year is a number
          graduation_year: parseInt(formData.graduation_year, 10)
        };
        
        // Format birthday correctly to prevent timezone issues
        if (updateData.birthday) {
          try {
            // Parse the date string - birthday is typically in YYYY-MM-DD format from the input
            const [year, month, day] = updateData.birthday.split('T')[0].split('-').map(num => parseInt(num, 10));
            
            // Validate the date parts
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
              console.error('Invalid date parts:', { year, month, day });
              updateData.birthday = null;
            } else {
              // Create a date at noon UTC to avoid timezone issues (0-indexed month)
              const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
              
              // Format as YYYY-MM-DDT00:00:00Z using ISO format
              updateData.birthday = date.toISOString().split('.')[0];
              
              console.log('Formatted birthday for API:', updateData.birthday);
            }
          } catch (e) {
            console.error('Error formatting birthday:', e);
            updateData.birthday = null;
          }
        }
        
        console.log('Updating alumni profile with data:', updateData);
        const response = await alumniService.updateProfile(updateData);
        setAlumni(response.data);
        // Navigate back to alumni list
        navigate(`/admin/alumni`);
      }
    } catch (error) {
      console.error('Error saving alumni profile:', error);
      
      // Get detailed error message
      let errorMessage = 'Failed to save alumni profile: ';
      
      // Handle different error formats
      if (error.response && error.response.data) {
        const responseData = error.response.data;
        
        if (responseData.detail) {
          if (Array.isArray(responseData.detail)) {
            // Handle FastAPI validation errors array
            errorMessage += responseData.detail.map(err => {
              const field = err.loc ? err.loc[err.loc.length - 1] : '';
              return `${field}: ${err.msg}`;
            }).join(', ');
          } else if (typeof responseData.detail === 'object') {
            // Handle object-structured errors
            errorMessage += Object.entries(responseData.detail)
              .map(([field, msg]) => `${field}: ${msg}`)
              .join(', ');
          } else {
            // Handle string error
            errorMessage += responseData.detail;
          }
        } else if (responseData.message) {
          errorMessage += responseData.message;
        } else {
          errorMessage += 'Validation error - please check all required fields';
        }
      } else {
        errorMessage += error.message || 'Please try again';
      }
      
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Helper function to get profile picture URL
  const getProfileImageUrl = (profilePicture) => {
    if (profilePicture) {
      // Parse the API URL to avoid path duplication
      let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      // Remove trailing slash if present
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      return `${baseUrl}/${profilePicture}`;
    }
    return 'https://via.placeholder.com/300?text=No+Photo';
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Philippine courses/programs list for dropdown
  const philippineCourses = [
    "BS Accountancy",
    "BS Accounting Technology",
    "BS Aeronautical Engineering",
    "BS Agricultural Economics",
    "BS Agricultural Engineering",
    "BS Agriculture",
    "BS Architecture",
    "BS Biology",
    "BS Business Administration",
    "BS Business Management",
    "BS Chemical Engineering",
    "BS Chemistry",
    "BS Civil Engineering",
    "BS Communication",
    "BS Computer Engineering",
    "BS Computer Science",
    "BS Criminology",
    "BS Development Communication",
    "BS Economics",
    "BS Education",
    "BS Electrical Engineering",
    "BS Electronics and Communications Engineering",
    "BS Electronics Engineering",
    "BS Elementary Education",
    "BS Environmental Science",
    "BS Environmental Planning",
    "BS Food Technology",
    "BS Forestry",
    "BS Geodetic Engineering",
    "BS Geology",
    "BS Hospitality Management",
    "BS Hotel and Restaurant Management",
    "BS Industrial Engineering",
    "BS Information Systems",
    "BS Information Technology",
    "BS Interior Design",
    "BS Marine Engineering",
    "BS Marine Transportation",
    "BS Marketing Management",
    "BS Mathematics",
    "BS Mechanical Engineering",
    "BS Medical Technology",
    "BS Mining Engineering",
    "BS Nursing",
    "BS Nutrition and Dietetics",
    "BS Petroleum Engineering",
    "BS Pharmacy",
    "BS Physical Therapy",
    "BS Physics",
    "BS Psychology",
    "BS Public Administration",
    "BS Radiologic Technology",
    "BS Real Estate Management",
    "BS Secondary Education",
    "BS Social Work",
    "BS Statistics",
    "BS Tourism Management",
    "Bachelor of Arts in Communication",
    "Bachelor of Arts in Economics",
    "Bachelor of Arts in English",
    "Bachelor of Arts in History",
    "Bachelor of Arts in Journalism",
    "Bachelor of Arts in Literature",
    "Bachelor of Arts in Philosophy",
    "Bachelor of Arts in Political Science",
    "Bachelor of Arts in Psychology",
    "Bachelor of Arts in Sociology",
    "Bachelor of Elementary Education",
    "Bachelor of Fine Arts",
    "Bachelor of Laws",
    "Bachelor of Library and Information Science",
    "Bachelor of Music",
    "Bachelor of Physical Education",
    "Bachelor of Science in Midwifery",
    "Bachelor of Secondary Education",
    "Doctor of Dental Medicine",
    "Doctor of Medicine",
    "Doctor of Optometry",
    "Doctor of Veterinary Medicine",
    "AB Mass Communication",
    "AB Multimedia Arts"
  ].sort();
  
  // Common Philippine university departments
  const philippineDepartments = [
    "College of Accountancy",
    "College of Agriculture",
    "College of Architecture",
    "College of Arts and Letters",
    "College of Arts and Sciences",
    "College of Business Administration",
    "College of Communication",
    "College of Computer Studies",
    "College of Criminology",
    "College of Education",
    "College of Engineering",
    "College of Fine Arts",
    "College of Forestry",
    "College of Health Sciences",
    "College of Hospitality Management",
    "College of Human Ecology",
    "College of Industrial Technology",
    "College of Information and Communications Technology",
    "College of Law",
    "College of Liberal Arts",
    "College of Medicine",
    "College of Music",
    "College of Nursing",
    "College of Pharmacy",
    "College of Public Administration",
    "College of Science",
    "College of Social Sciences",
    "College of Social Work and Community Development",
    "College of Statistics",
    "College of Technology",
    "College of Tourism and Hospitality Management",
    "College of Veterinary Medicine",
    "Department of Biology",
    "Department of Chemistry",
    "Department of Computer Science",
    "Department of Economics",
    "Department of English",
    "Department of Mathematics",
    "Department of Physics",
    "Department of Psychology",
    "School of Business",
    "School of Design",
    "School of Economics",
    "School of Management"
  ].sort();

  // Function to suggest department based on course selection
  const getSuggestedDepartment = (course) => {
    if (!course || course === "other") return "";
    
    if (course.includes("Accountancy")) return "College of Accountancy";
    if (course.includes("Agriculture")) return "College of Agriculture";
    if (course.includes("Architecture")) return "College of Architecture";
    if (course.includes("Arts")) return "College of Arts and Letters";
    if (course.includes("Business") || course.includes("Management")) return "College of Business Administration";
    if (course.includes("Communication")) return "College of Communication";
    if (course.includes("Computer") || course.includes("Information Technology")) return "College of Computer Studies";
    if (course.includes("Criminology")) return "College of Criminology";
    if (course.includes("Education")) return "College of Education";
    if (course.includes("Engineering")) return "College of Engineering";
    if (course.includes("Fine Arts")) return "College of Fine Arts";
    if (course.includes("Forestry")) return "College of Forestry";
    if (course.includes("Nursing")) return "College of Nursing";
    if (course.includes("Pharmacy")) return "College of Pharmacy";
    if (course.includes("Science")) return "College of Science";
    if (course.includes("Statistics")) return "College of Statistics";
    if (course.includes("Tourism") || course.includes("Hospitality")) return "College of Tourism and Hospitality Management";
    
    return "";
  };
  
  // Handle course change with department suggestion
  const handleCourseChange = (e) => {
    const { name, value } = e.target;
    const suggestedDepartment = getSuggestedDepartment(value);
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Only suggest department if it's empty or if this is a new alumni
      department: (prev.department === "" || isNew) ? suggestedDepartment : prev.department
    }));
  };
  
  // Admin form view for creating/editing alumni
  if (isAdmin && (isNew || alumni)) {
    return (
      <div className="bg-gray-50 min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {isNew ? 'Add New Alumni' : 'Edit Alumni Profile'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {isNew ? 'Create a new alumni record' : `Editing profile for ${alumni?.full_name}`}
              </p>
            </div>
            <Link
              to="/admin/alumni"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Personal Information</h2>
            </div>
            
            <div className="p-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                  Full Name*
                </label>
                <input
                  type="text"
                  name="full_name"
                  id="full_name"
                  required
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div className="sm:col-span-3">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email*
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              {isAdmin && isNew && !userIdFromQuery && (
                <div className="sm:col-span-3">
                  <label htmlFor="temp_password" className="block text-sm font-medium text-gray-700">
                    Temporary Password*
                  </label>
                  <input
                    type="password"
                    name="temp_password"
                    id="temp_password"
                    required
                    value={formData.temp_password}
                    onChange={handleInputChange}
                    className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    placeholder="Enter a temporary password"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    The alumni will be required to change this password on first login.
                  </p>
                </div>
              )}
              
              <div className="sm:col-span-3">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="text"
                  name="phone"
                  id="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div className="sm:col-span-3">
                <label htmlFor="student_id" className="block text-sm font-medium text-gray-700">
                  Student ID*
                </label>
                <input
                  type="text"
                  name="student_id"
                  id="student_id"
                  required
                  value={formData.student_id}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div className="sm:col-span-2">
                <label htmlFor="graduation_year" className="block text-sm font-medium text-gray-700">
                  Graduation Year*
                </label>
                <input
                  type="number"
                  name="graduation_year"
                  id="graduation_year"
                  required
                  min="1900"
                  max={new Date().getFullYear()}
                  value={formData.graduation_year}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div className="sm:col-span-2">
                <label htmlFor="batch" className="block text-sm font-medium text-gray-700">
                  Batch / Class*
                </label>
                <input
                  type="text"
                  name="batch"
                  id="batch"
                  required
                  placeholder="e.g., Batch 2023, Class 2023-A"
                  value={formData.batch}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div className="sm:col-span-4">
                <label htmlFor="course" className="block text-sm font-medium text-gray-700">
                  Course/Program*
                </label>
                <div className="mt-1 relative">
                  <select
                    name="course"
                    id="course"
                    required
                    value={formData.course}
                    onChange={handleCourseChange}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                  >
                    <option value="">Select a course/program</option>
                    {philippineCourses.map((course) => (
                      <option key={course} value={course}>
                        {course}
                      </option>
                    ))}
                    <option value="other">Other (Not Listed)</option>
                  </select>
                  {formData.course === "other" && (
                    <input
                      type="text"
                      name="course_other"
                      id="course_other"
                      placeholder="Specify your course/program"
                      value={formData.course_other || ""}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          course_other: e.target.value,
                          course: e.target.value // Update the actual course value
                        }));
                      }}
                      className="mt-2 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    />
                  )}
                </div>
              </div>
              
              <div className="sm:col-span-4">
                <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                <div className="mt-1 relative">
                  <select
                    name="department"
                    id="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                  >
                    <option value="">Select a department</option>
                    {philippineDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                    <option value="other">Other (Not Listed)</option>
                  </select>
                  {formData.department === "other" && (
                    <input
                      type="text"
                      name="department_other"
                      id="department_other"
                      placeholder="Specify department"
                      value={formData.department_other || ""}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          department_other: e.target.value,
                          department: e.target.value // Update the actual department value
                        }));
                      }}
                      className="mt-2 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    />
                  )}
                </div>
              </div>
              
              <div className="sm:col-span-3">
                <label htmlFor="sex" className="block text-sm font-medium text-gray-700">
                  Sex
                </label>
                <select
                  name="sex"
                  id="sex"
                  value={formData.sex}
                  onChange={handleInputChange}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="sm:col-span-3">
                <label htmlFor="civil_status" className="block text-sm font-medium text-gray-700">
                  Civil Status
                </label>
                <select
                  name="civil_status"
                  id="civil_status"
                  value={formData.civil_status}
                  onChange={handleInputChange}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                >
                  <option value="">Select</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </div>
              
              <div className="sm:col-span-6">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  id="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div className="sm:col-span-3">
                <label htmlFor="birthday" className="block text-sm font-medium text-gray-700">
                  Birthday
                </label>
                <input
                  type="date"
                  name="birthday"
                  id="birthday"
                  value={formData.birthday}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div className="sm:col-span-3">
                <label htmlFor="region_of_origin" className="block text-sm font-medium text-gray-700">
                  Region of Origin
                </label>
                <input
                  type="text"
                  name="region_of_origin"
                  id="region_of_origin"
                  value={formData.region_of_origin}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div className="sm:col-span-6">
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                  Bio
                </label>
                <textarea
                  name="bio"
                  id="bio"
                  rows="3"
                  value={formData.bio}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                ></textarea>
              </div>
              
              <div className="sm:col-span-3">
                <label htmlFor="current_job" className="block text-sm font-medium text-gray-700">
                  Current Job
                </label>
                <input
                  type="text"
                  name="current_job"
                  id="current_job"
                  value={formData.current_job}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div className="sm:col-span-3">
                <label htmlFor="current_employer" className="block text-sm font-medium text-gray-700">
                  Current Employer
                </label>
                <input
                  type="text"
                  name="current_employer"
                  id="current_employer"
                  value={formData.current_employer}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : (isNew ? 'Create Alumni' : 'Save Changes')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  
  // Original view-only profile (non-admin mode)
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }
  
  if (error || !alumni) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h1>
          <p className="text-gray-600 mb-6">
            {error || "We couldn't find the alumni profile you're looking for."}
          </p>
          <Link
            to="/alumni-directory"
            className="inline-block bg-cvsu-green text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero section with profile picture and name */}
      <div className="bg-cvsu-green py-12 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center">
            <div className="mb-6 lg:mb-0 lg:mr-8">
              <img
                src={getProfileImageUrl(alumni.profile_picture)}
                alt={alumni.full_name}
                className="h-48 w-48 rounded-full object-cover border-4 border-white shadow-lg"
              />
            </div>
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-bold text-white sm:text-4xl">{alumni.full_name}</h1>
              <p className="mt-2 text-xl text-white opacity-90">{alumni.course}</p>
              <div className="mt-2 flex flex-wrap justify-center lg:justify-start gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  <AcademicCapIcon className="h-4 w-4 mr-1" />
                  Class of {alumni.graduation_year}
                </span>
                {alumni.department && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                    {alumni.department}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Personal information */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Personal Information</h2>
              
              {alumni.phone && (
                <div className="flex items-start mb-3">
                  <svg className="h-5 w-5 text-gray-500 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Phone</p>
                    <p className="text-gray-900">{alumni.phone}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start mb-3">
                <svg className="h-5 w-5 text-gray-500 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-gray-900">{alumni.email}</p>
                </div>
              </div>
              
              {alumni.address && (
                <div className="flex items-start mb-3">
                  <MapPinIcon className="h-5 w-5 text-gray-500 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Address</p>
                    <p className="text-gray-900">{alumni.address}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start mb-3">
                <CalendarIcon className="h-5 w-5 text-gray-500 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Student ID</p>
                  <p className="text-gray-900">{alumni.student_id}</p>
                </div>
              </div>
              
              {alumni.sex && (
                <div className="flex items-start mb-3">
                  <svg className="h-5 w-5 text-gray-500 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Sex</p>
                    <p className="text-gray-900">{alumni.sex.charAt(0).toUpperCase() + alumni.sex.slice(1)}</p>
                  </div>
                </div>
              )}
              
              {alumni.civil_status && (
                <div className="flex items-start mb-3">
                  <svg className="h-5 w-5 text-gray-500 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Civil Status</p>
                    <p className="text-gray-900">{alumni.civil_status.charAt(0).toUpperCase() + alumni.civil_status.slice(1)}</p>
                  </div>
                </div>
              )}
              
              {alumni.birthday && (
                <div className="flex items-start mb-3">
                  <CalendarIcon className="h-5 w-5 text-gray-500 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Birthday</p>
                    <p className="text-gray-900">{formatDate(alumni.birthday)}</p>
                  </div>
                </div>
              )}
              
              {alumni.region_of_origin && (
                <div className="flex items-start mb-3">
                  <MapPinIcon className="h-5 w-5 text-gray-500 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Region of Origin</p>
                    <p className="text-gray-900">{alumni.region_of_origin}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Social Media Links */}
            {alumni.social_media && alumni.social_media.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Connect</h2>
                <div className="space-y-3">
                  {alumni.social_media.map((social, index) => (
                    <a 
                      key={index}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-cvsu-green hover:text-green-700"
                    >
                      <span className="capitalize mr-2">{social.platform}</span>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Right column - Bio, education, etc. */}
          <div className="lg:col-span-2">
            {/* Bio section */}
            {alumni.bio && (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Biography</h2>
                <p className="text-gray-700 whitespace-pre-line">{alumni.bio}</p>
              </div>
            )}
            
            {/* Education section */}
            {alumni.education && alumni.education.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Education</h2>
                <div className="space-y-4">
                  {alumni.education.map((edu, index) => (
                    <div key={index} className="border-l-2 border-cvsu-green pl-4 py-1">
                      <div className="flex items-center">
                        <AcademicCapIcon className="h-5 w-5 text-cvsu-green mr-2" />
                        <h3 className="font-medium text-gray-900">{edu.degree}</h3>
                      </div>
                      {edu.major && <p className="text-gray-600 ml-7">Major: {edu.major}</p>}
                      <p className="text-gray-600 ml-7">Graduated: {edu.graduation_year}</p>
                      {edu.honors && edu.honors.length > 0 && (
                        <div className="ml-7 mt-1">
                          <p className="text-sm text-gray-500">Honors:</p>
                          <ul className="list-disc list-inside text-gray-600 text-sm">
                            {edu.honors.map((honor, idx) => (
                              <li key={idx}>{honor}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Work Experience section */}
            {alumni.work_experience && alumni.work_experience.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Work Experience</h2>
                <div className="space-y-4">
                  {alumni.work_experience.map((work, index) => (
                    <div key={index} className="border-l-2 border-cvsu-green pl-4 py-1">
                      <div className="flex items-center">
                        <BriefcaseIcon className="h-5 w-5 text-cvsu-green mr-2" />
                        <h3 className="font-medium text-gray-900">{work.position}</h3>
                      </div>
                      <p className="text-gray-600 ml-7">{work.company}</p>
                      <p className="text-gray-600 ml-7 text-sm">
                        {formatDate(work.start_date)} - {work.is_current ? 'Present' : formatDate(work.end_date)}
                      </p>
                      {work.description && (
                        <p className="text-gray-600 ml-7 mt-1 text-sm">{work.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Achievements section */}
            {alumni.achievements && alumni.achievements.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Achievements</h2>
                <div className="space-y-4">
                  {alumni.achievements.map((achievement, index) => (
                    <div key={index} className="border-l-2 border-cvsu-green pl-4 py-1">
                      <h3 className="font-medium text-gray-900">{achievement.title}</h3>
                      {achievement.issuer && <p className="text-gray-600 ml-1">{achievement.issuer}</p>}
                      {achievement.date && <p className="text-gray-600 ml-1 text-sm">{formatDate(achievement.date)}</p>}
                      {achievement.description && (
                        <p className="text-gray-600 ml-1 mt-1 text-sm">{achievement.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Verified Documents section */}
            {documents.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Verified Documents</h2>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc._id} className="flex items-center p-2 border border-gray-200 rounded-md">
                      <DocumentIcon className="h-6 w-6 text-cvsu-green mr-3" />
                      <div>
                        <h3 className="font-medium text-gray-900">{doc.title}</h3>
                        <p className="text-sm text-gray-500">{doc.document_type}</p>
                      </div>
                      <div className="ml-auto">
                        <Link
                          to={`/verify?id=${doc._id}`}
                          className="inline-flex items-center text-sm text-cvsu-green hover:text-green-700"
                        >
                          <span>Verify</span>
                          <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 