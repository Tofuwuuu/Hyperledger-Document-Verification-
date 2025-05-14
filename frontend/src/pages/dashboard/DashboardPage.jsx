import { useAuth } from '../../context/AuthContext';
import { UserCircleIcon, DocumentCheckIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

export default function DashboardPage() {
  const { currentUser, isAdmin } = useAuth();
  const location = useLocation();
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(true);
  
  useEffect(() => {
    // Auto-set verification to true
    setIsVerified(true);
    
    // Force set verification in storage for persistence
    sessionStorage.setItem('user_verified', 'true');
    
    // Update localStorage to ensure verification persists
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (!storedUser.is_verified) {
        localStorage.setItem('user', JSON.stringify({
          ...storedUser,
          is_verified: true
        }));
      }
    } catch (e) {
      console.error('Error updating localStorage:', e);
    }
    
    fetchUserActivity();
    
    // Check if coming from document upload page with refresh flag
    if (location.state?.refreshActivity) {
      console.log('Dashboard detected refreshActivity flag', location.state);
      
      // Show toast notification for document upload
      if (location.state?.documentUploaded) {
        toast.success(`Document "${location.state.documentTitle || 'New document'}" uploaded successfully`);
      }
      
      // Clear the state to prevent repeated refreshes
      history.replaceState({}, document.title);
    }
  }, [location, currentUser, isAdmin]);
  
  const fetchUserActivity = async () => {
    try {
      setLoading(true);
      
      // Get the API URL - fixing the URL construction
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const apiUrl = cleanBaseUrl.includes('/api/v1') ? cleanBaseUrl : `${cleanBaseUrl}/api/v1`;
      
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      
      // Ensure properly formed URL for the activities endpoint
      const activitiesUrl = `${apiUrl}/documents/activities?_t=${timestamp}`;
      console.log('Fetching activities from:', activitiesUrl);
      
      const response = await fetch(activitiesUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch activity: ${response.status}`);
      }
      
      const data = await response.json();
      setRecentActivity(data);
      console.log('User activity loaded:', data);
      
    } catch (error) {
      console.error('Error fetching user activity:', error);
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  const formatActivityTitle = (activity) => {
    if (activity.type === "document_upload") {
      return "📄 Recent Upload";
    }
    return activity.type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Welcome back, {currentUser?.full_name || 'Alumni'}! Manage your profile and documents.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
        {/* Profile Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-cvsu-green rounded-md p-3">
                <UserCircleIcon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Your Profile</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {currentUser?.full_name || 'Update your profile'}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-5">
              <Link
                to="/dashboard/profile"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-cvsu-green/90"
              >
                View Profile
              </Link>
            </div>
          </div>
        </div>

        {/* Documents Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-cvsu-green rounded-md p-3">
                <DocumentCheckIcon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Your Documents</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      Manage your documents
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-5">
              <Link
                to="/dashboard/documents"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-cvsu-green/90"
              >
                View Documents
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
          <button
            onClick={fetchUserActivity}
            className="text-sm text-cvsu-green hover:text-cvsu-green-dark"
          >
            Refresh
          </button>
        </div>

        <div className="mt-2 bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cvsu-green"></div>
            </div>
          ) : recentActivity.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {recentActivity.map((activity, index) => (
                <li key={activity.id || index}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-cvsu-green truncate">
                        {formatActivityTitle(activity)}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {activity.status || 'Complete'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          {activity.description || activity.title || 'Activity completed'}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <p>
                          {activity.created_at ? formatDate(activity.created_at) : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <p>No recent activity found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 