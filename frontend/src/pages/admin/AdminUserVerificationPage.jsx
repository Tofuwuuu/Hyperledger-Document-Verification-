import { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  UserIcon 
} from '@heroicons/react/24/outline';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import * as authService from '../../services/authService';

export default function AdminUserVerificationPage() {
  const [unverifiedUsers, setUnverifiedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [verificationNote, setVerificationNote] = useState('');
  const [processingVerification, setProcessingVerification] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('AdminUserVerificationPage component mounted. Fetching unverified users...');
    fetchUnverifiedUsers();
  }, []);

  // TEMPORARY DEBUG FUNCTION - To help with API issues
  const enableDebugMode = () => {
    // Only allow in development mode for security
    if (import.meta.env.MODE !== 'development') {
      toast.error('Debug mode can only be enabled in development');
      return;
    }
    
    // Create mock unverified users for testing the UI
    setUnverifiedUsers([
      {
        id: '1234567890abcdef',
        email: 'test.user1@example.com',
        full_name: 'Test Unverified User 1',
        created_at: new Date().toISOString(),
        student_id: 'TEST-12345',
        is_verified: false
      },
      {
        id: '0987654321fedcba',
        email: 'test.user2@example.com',
        full_name: 'Test Unverified User 2',
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        student_id: 'TEST-67890',
        is_verified: false
      }
    ]);
    
    // Clear any errors
    setError(null);
    setLoading(false);
    
    toast.info('Debug mode enabled with mock data');
  };

  const fetchUnverifiedUsers = async () => {
    setLoading(true);
    setError(null);
    
    console.log('==========================================');
    console.log('Starting unverified users fetching process...');
    console.log('API URL from config:', import.meta.env.VITE_API_URL || 'Not set');
    
    try {
      // Log environment and auth state
      console.log('Environment:', import.meta.env.MODE);
      console.log('Token present:', !!localStorage.getItem('token'));
      
      // Add a timeout to prevent UI from hanging indefinitely
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout triggered at 15s');
        controller.abort();
      }, 15000); // 15s timeout
      
      console.log('Calling authService.getUnverifiedUsers() with timeout');
      const users = await authService.getUnverifiedUsers(controller.signal);
      clearTimeout(timeoutId);
      
      console.log('Response from getUnverifiedUsers:', users);
      console.log('Number of unverified users received:', Array.isArray(users) ? users.length : 'Not an array');
      
      if (Array.isArray(users) && users.length > 0) {
        console.log('Users received successfully, first user:', users[0]);
        setUnverifiedUsers(users);
        setError(null);
      } else {
        // If API returns empty array, show appropriate message
        console.log('API returned no users (empty array)');
        setUnverifiedUsers([]);
        setError('No unverified users found. All users have been verified.');
        
        // Log this for easier debugging
        console.log('Setting error state: No unverified users found. All users have been verified.');
      }
    } catch (err) {
      console.error('Error fetching unverified users:', err);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      
      if (err.name === 'AbortError') {
        setError('Request timed out. The server took too long to respond.');
      } else if (err.response && err.response.status === 413) {
        setError('Response too large. Please contact administrator to fix backend pagination.');
      } else if (err.response && err.response.status === 401) {
        setError('Authentication failed. Please log in again as an administrator.');
        // Auto-redirect to login after 3 seconds
        setTimeout(() => {
          console.log('Redirecting to login due to authentication error');
          navigate('/login');
        }, 3000);
      } else if (err.message && err.message.includes('Content-Length')) {
        setError('Server response error. Please contact administrator to check the backend logs.');
      } else {
        setError(err.message || 'Failed to load unverified users. Please try again later.');
      }
      
      setUnverifiedUsers([]);
    } finally {
      setLoading(false);
      console.log('Unverified users fetch process completed.');
      console.log('==========================================');
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setVerificationNote('');
  };

  // Function to update dashboard with new verification activity
  const updateDashboardActivity = async (verifiedUser) => {
    try {
      console.log('updateDashboardActivity called with user:', verifiedUser);
      
      // Get API URL from environment variables
      let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const apiUrl = baseUrl.includes('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;
      
      // Add a timestamp to prevent caching
      const timestamp = new Date().getTime();
      
      const url = `${apiUrl}/admin/dashboard/recent-activity?limit=1&_t=${timestamp}`;
      console.log('Fetching most recent activity from:', url);
      
      // Fetch the latest activity data
      const activityResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (activityResponse.ok) {
        // Check what the response contains
        const activityData = await activityResponse.json();
        console.log('Latest activity data:', activityData);
        
        // Check if the verification we just did appears
        const userVerifications = activityData.filter(item => 
          item.type === 'user_verification' && 
          item.user === (verifiedUser.full_name || verifiedUser.email)
        );
        console.log('Found our verification in response?', userVerifications.length > 0);
        
        // Log success
        console.log('Successfully fetched latest activity, redirecting to dashboard with state:',
          { 
            refreshActivity: true,
            verifiedUser: verifiedUser?.full_name || verifiedUser?.email,
            timestamp: timestamp
          });
        
        // Force refresh of dashboard by navigating to it with a state flag
        navigate('/admin', { 
          state: { 
            refreshActivity: true,
            verifiedUser: verifiedUser?.full_name || verifiedUser?.email,
            timestamp: timestamp
          } 
        });
      } else {
        console.error('Activity response error:', activityResponse.status);
        navigate('/admin'); // Navigate anyway
      }
    } catch (err) {
      console.error('Error updating dashboard activity:', err);
      // Still navigate to dashboard even if activity update fails
      navigate('/admin');
    }
  };

  const handleVerify = async () => {
    if (!selectedUser) return;
    
    setProcessingVerification(true);
    
    try {
      console.log('Starting verification process for user:', selectedUser);
      
      // Call API to verify the user
      const response = await authService.verifyUser(selectedUser.id, verificationNote);
      console.log('Verification API response:', response);
      
      toast.success(`User ${selectedUser.full_name || selectedUser.email} verified successfully`);
      
      // Remove verified user from the list
      setUnverifiedUsers(unverifiedUsers.filter(user => user.id !== selectedUser.id));
      
      // Update dashboard with new activity
      console.log('Calling updateDashboardActivity to refresh dashboard');
      await updateDashboardActivity(selectedUser);
      
      setSelectedUser(null);
      
    } catch (err) {
      console.error('Error verifying user:', err);
      toast.error(err.response?.data?.detail || 'Failed to verify user');
    } finally {
      setProcessingVerification(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">User Verification</h1>
        <p className="mt-1 text-sm text-gray-500">
          Verify student accounts before they can register for events
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading unverified users</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
                <div className="mt-3 flex space-x-2">
                  <button 
                    onClick={fetchUnverifiedUsers}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Retry
                  </button>
                  
                  {/* Debug button only shown in development mode */}
                  {import.meta.env.MODE === 'development' && (
                    <button 
                      onClick={enableDebugMode}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Enable Debug Mode
                    </button>
                  )}
                  
                  {/* Direct database check button - development only */}
                  {import.meta.env.MODE === 'development' && (
                    <button 
                      onClick={() => window.location.href='/admin'}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Back to Dashboard
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : unverifiedUsers.length === 0 ? (
        <div className="text-center py-10 px-6 border-2 border-dashed border-gray-300 rounded-lg">
          <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No unverified users</h3>
          <p className="mt-1 text-sm text-gray-500">
            All user accounts have been verified
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:space-x-8">
          {/* List of unverified users */}
          <div className="lg:w-2/3">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {unverifiedUsers.map((user) => (
                  <li 
                    key={user.id}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      selectedUser && selectedUser.id === user.id 
                        ? 'bg-gray-50 border-l-4 border-cvsu-green' 
                        : ''
                    }`}
                    onClick={() => handleSelectUser(user)}
                  >
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-cvsu-green truncate">
                          {user.full_name || user.email}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Unverified
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            {user.email}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <p>
                            Registered: {formatDate(user.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <p className="text-sm text-gray-500">
                          {user.student_id ? `ID: ${user.student_id}` : 'No Student ID'}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* User verification panel */}
          {selectedUser && (
            <div className="lg:w-1/3 mt-6 lg:mt-0 border border-gray-200 rounded-lg shadow-sm">
              <div className="px-4 py-5 sm:px-6 bg-gray-50 rounded-t-lg">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  Verify User Account
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Review and verify user information
                </p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4">
                  {/* User information */}
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{selectedUser.full_name || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{selectedUser.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Student ID</dt>
                    <dd className="mt-1 text-sm text-gray-900">{selectedUser.student_id || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Department</dt>
                    <dd className="mt-1 text-sm text-gray-900">{selectedUser.department || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Year Graduated</dt>
                    <dd className="mt-1 text-sm text-gray-900">{selectedUser.year_graduated || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Registration Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(selectedUser.created_at)}</dd>
                  </div>

                  {/* Verification note */}
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Verification Note (optional)</dt>
                    <dd className="mt-1">
                      <textarea
                        rows={3}
                        className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="Add a note about this verification"
                        value={verificationNote}
                        onChange={(e) => setVerificationNote(e.target.value)}
                      />
                    </dd>
                  </div>

                  {/* Action buttons */}
                  <div className="sm:col-span-1 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                      onClick={() => setSelectedUser(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-cvsu-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                      onClick={handleVerify}
                      disabled={processingVerification}
                    >
                      {processingVerification ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                          Verify User
                        </>
                      )}
                    </button>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 