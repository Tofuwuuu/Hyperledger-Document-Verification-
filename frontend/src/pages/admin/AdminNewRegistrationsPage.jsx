import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserIcon, UserPlusIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { format } from 'date-fns';

export default function AdminNewRegistrationsPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterIncomplete, setFilterIncomplete] = useState(true);

  useEffect(() => {
    fetchRecentUsers();
  }, []);

  const fetchRecentUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get the API URL
      let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const apiUrl = baseUrl.includes('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;
      
      // Get token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Fetch recent users (last 30 days)
      const response = await axios.get(`${apiUrl}/admin/recent-users`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log("API response data:", response.data);
      
      // Map the department values if needed
      const processedUsers = response.data.map(user => {
        // Log each user to debug
        console.log(`Processing user ${user.email}:`, user);
        
        // Check for department formatting issues
        if (user.department && typeof user.department === 'string') {
          // Department mapping for standardization if needed
          const deptMap = {
            "BSCS": "Computer Science",
            "BSIT": "Information Technology",
            "CS": "Computer Science",
            "IT": "Information Technology"
          };
          
          // Use mapped value or original if no mapping exists
          const standardDepartment = deptMap[user.department] || user.department;
          console.log(`Mapped department '${user.department}' to '${standardDepartment}'`);
          
          return {...user, department: standardDepartment};
        }
        return user;
      });
      
      setUsers(processedUsers);
    } catch (err) {
      console.error('Error fetching recent users:', err);
      setError(err.message || 'Failed to load recent user registrations');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return dateString;
    }
  };
  
  const isProfileIncomplete = (user) => {
    // Check for missing essential profile fields with debugging
    console.log('Checking completion for user:', user.email, user);
    
    // Essential fields might be named differently in the database vs the API response
    const hasFullName = !!user.full_name;
    const hasStudentId = !!user.student_id;
    console.log(`Profile check for ${user.email}:`, {
      hasFullName,
      hasStudentId
    });
    
    // Add specific field debugging for this user
    if (user.email === "rodericksalise812@gmail.com") {
      console.log("DETAILED CHECK FOR ROD:", {
        "full_name": user.full_name,
        "full_name type": typeof user.full_name,
        "student_id": user.student_id,
        "student_id type": typeof user.student_id,
        "department": user.department,
        "department type": typeof user.department,
        "graduation_year": user.graduation_year,
        "graduation_year type": typeof user.graduation_year,
        "year_graduated": user.year_graduated,
        "year_graduated type": typeof user.year_graduated
      });
    }
    
    return !hasFullName || !hasStudentId;
  };
  
  // Filter users if needed
  const filteredUsers = filterIncomplete 
    ? users.filter(isProfileIncomplete) 
    : users;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading recent registrations</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
              <button 
                onClick={fetchRecentUsers}
                className="mt-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">New Registrations</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage recent user registrations
        </p>
      </div>
      
      {/* Filter Toggle */}
      <div className="mb-6">
        <div className="flex items-center">
          <button
            onClick={() => setFilterIncomplete(!filterIncomplete)}
            className={`${
              filterIncomplete ? 'bg-cvsu-green text-white' : 'bg-gray-100 text-gray-700'
            } px-4 py-2 rounded-md text-sm font-medium flex items-center`}
          >
            <UserIcon className="mr-2 h-5 w-5" />
            {filterIncomplete ? 'Showing Incomplete Profiles' : 'Showing All Registrations'}
          </button>
        </div>
      </div>
      
      {/* User List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <UserPlusIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No registrations found</h3>
            <p className="mt-1 text-sm text-gray-500">
              There are no {filterIncomplete ? 'incomplete profile' : ''} recent registrations to display.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <li key={user.id || user._id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-cvsu-green truncate">
                      {user.full_name || user.email}
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      {isProfileIncomplete(user) ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Incomplete Profile
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Complete
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        Email: {user.email}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <p>
                        Registered: {formatDate(user.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        {user.student_id ? `Student ID: ${user.student_id}` : 'No Student ID'}
                        {user.department ? ` • Department: ${user.department}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 
