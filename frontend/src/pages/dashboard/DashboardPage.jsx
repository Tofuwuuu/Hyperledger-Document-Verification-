import { useAuth } from '../../context/AuthContext';
import { UserCircleIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
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
  }, [location]);
  
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
        <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
        <div className="mt-2 bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {loading ? (
              <li>
                <div className="px-4 py-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-cvsu-green"></div>
                  <span className="ml-2 text-sm text-gray-500">Loading activities...</span>
                </div>
              </li>
            ) : recentActivity && recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <li key={index}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-cvsu-green truncate">
                        {formatActivityTitle(activity)}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${activity.status === 'verified' ? 'bg-blue-100 text-blue-800' : ''}
                          ${activity.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${activity.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                          ${!activity.status ? 'bg-green-100 text-green-800' : ''}
                        `}>
                          {activity.status ? activity.status.charAt(0).toUpperCase() + activity.status.slice(1) : 'Completed'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          {activity.description || (activity.type === 'document_upload' ? 
                            `You uploaded ${activity.document_title ? `"${activity.document_title}"` : `a ${activity.document_type}`}` : 
                            'Activity recorded')}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <p>
                          {formatDate(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li>
                <div className="px-4 py-4 text-center text-gray-500">
                  No recent activity found
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
} 