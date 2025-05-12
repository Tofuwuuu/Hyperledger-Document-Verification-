import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  UsersIcon, 
  DocumentCheckIcon, 
  ChartBarIcon, 
  UserPlusIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import pollingService from '../../services/polling';
import DiagnosticPanel from '../../components/DiagnosticPanel';

export default function AdminDashboardPage() {
  const { currentUser, isAdmin } = useAuth();
  const isAdminUser = isAdmin();
  const location = useLocation();
  const [stats, setStats] = useState({
    totalAlumni: 0,
    pendingVerifications: 0,
    verifiedDocuments: 0,
    newRegistrations: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Add these console logs for debugging
  console.log("Admin Dashboard: API URL:", import.meta.env.VITE_API_URL);
  console.log("Admin Polling Enabled:", true);
  console.log("User Role:", localStorage.getItem('user_role'));

  useEffect(() => {
    console.log("Starting polling from AdminDashboardPage");
    
    // Check if we're using admin bypass
    const token = localStorage.getItem('token');
    if (token && token.startsWith('admin_access_token_')) {
      console.log('Admin bypass token detected - not starting polling to avoid API calls');
      return; // Skip polling for admin bypass
    }
    
    // Start polling as admin
    pollingService.stopPolling(); // Stop any existing polling
    pollingService.startPolling('admin'); // Start with admin role
    
    // Add listener for document request notifications specifically
    const unsubscribe = pollingService.on('document_requested', (data) => {
      console.log("Admin received document_requested notification:", data);
      // Update UI or fetch latest data
      fetchDashboardData(); // Refresh dashboard data when new document request comes in
      
      // Build a more informative toast message
      let toastMessage = data.message;
      
      // Check for alumni info in the notification data
      if (data.data) {
        const alumniName = data.data.alumni_name;
        const studentId = data.data.student_id;
        const documentType = data.data.document_type;
        
        if (alumniName && documentType) {
          toastMessage = `New ${documentType} request from ${alumniName}`;
          if (studentId && studentId !== "N/A") {
            toastMessage += ` (${studentId})`;
          }
        }
      }
      
      // Show toast notification
      toast.info(toastMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    });
    
    // Add generic message listener too
    const messageUnsubscribe = pollingService.on('message', (data) => {
      console.log("Admin received general message:", data);
    });
    
    return () => {
      unsubscribe && unsubscribe();
      messageUnsubscribe && messageUnsubscribe();
      pollingService.stopPolling();
    };
  }, []);

  // Add auto-refresh functionality
  useEffect(() => {
    // Initial fetch
    fetchDashboardData();
    
    // Setup auto-refresh interval - every 60 seconds
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing dashboard data...');
      fetchDashboardData();
    }, 60000); // 60 seconds
    
    // Clear interval on component unmount
    return () => {
      console.log('Cleaning up dashboard auto-refresh interval');
      clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    if (isAdminUser) {
      // This is kept for backward compatibility
      // The initial fetch and subsequent refreshes are now handled by the auto-refresh useEffect above
    } else {
      // For regular users, we don't need to fetch admin stats
      // but we should still fetch their activity
      setLoading(true);
      fetchUserActivity();
    }
    
    // Check if coming from verification page with refresh flag
    if (location.state?.refreshActivity) {
      console.log('Dashboard detected refreshActivity flag', location.state);
      
      // Show toast notification for verification
      if (location.state?.verifiedUser) {
        toast.success(`User ${location.state.verifiedUser} verified successfully`);
      }
      
      // Show toast notification for document upload
      if (location.state?.documentUploaded) {
        toast.success(`Document "${location.state.documentTitle || 'New document'}" uploaded successfully`);
      }
      
      // Explicitly fetch the latest activity data
      console.log('Triggering refreshRecentActivity because of navigation state');
      if (isAdminUser) {
        fetchRecentActivity();
      } else {
        fetchUserActivity();
      }
      
      // Clear the state to prevent repeated refreshes
      history.replaceState({}, document.title);
    }
  }, [location, isAdminUser]);

  // Function to pre-process activity data from backend
  const processActivityData = (activities) => {
    return activities.map(activity => {
      const processed = { ...activity };
      
      // Try to parse data field if it's a string
      if (typeof processed.data === 'string') {
        try {
          processed.data = JSON.parse(processed.data);
        } catch (e) {
          // Keep as is if parsing fails
        }
      }
      
      // Try to extract additional info from the data field
      if (processed.data) {
        // Move relevant fields to the top level for easier access
        if (processed.data.user_name && !processed.user_name) {
          processed.user_name = processed.data.user_name;
        }
        if (processed.data.full_name && !processed.full_name) {
          processed.full_name = processed.data.full_name;
        }
        if (processed.data.email && !processed.email) {
          processed.email = processed.data.email;
        }
        if (processed.data.document_type && !processed.document_type) {
          processed.document_type = processed.data.document_type;
        }
      }
      
      // Check 'user' field
      if (typeof processed.user === 'string') {
        try {
          processed.user = JSON.parse(processed.user);
          if (processed.user && processed.user.full_name && !processed.user_name) {
            processed.user_name = processed.user.full_name;
          }
        } catch (e) {
          // If user field is a string but not JSON, it might be a name
          if (!processed.user_name) {
            processed.user_name = processed.user;
          }
        }
      }
      
      return processed;
    });
  };

  // Function to fetch regular user activity
  const fetchUserActivity = async () => {
    try {
      // Get the API URL
      let baseUrl = import.meta.env.VITE_API_URL || 'https://final-ecri.onrender.com';
      // Remove trailing slash if present
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      // Add /api/v1 only if it's not already included
      const apiUrl = baseUrl.includes('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;
      
      // Add a timestamp parameter to prevent caching
      const timestamp = new Date().getTime();
      
      // Use the documents/activities endpoint which is guaranteed to exist
      const response = await fetch(`${apiUrl}/documents/activities?_t=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        // If specific endpoint fails, try the general activity endpoint as fallback
        const fallbackResponse = await fetch(`${apiUrl}/admin/dashboard/recent-activity`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          // Process the data to extract user information
          const processedData = processActivityData(data);
          setRecentActivity(processedData);
        } else {
          console.error('Failed to fetch user activity:', response.status);
          setRecentActivity([]);
        }
      } else {
        const data = await response.json();
        // Process the data to extract user information
        const processedData = processActivityData(data);
        setRecentActivity(processedData);
      }
    } catch (err) {
      console.error('Error fetching user activity:', err);
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch only recent activity (for updates)
  const fetchRecentActivity = async () => {
    try {
      console.log('fetchRecentActivity started...');
      
      // Get the API URL
      let baseUrl = import.meta.env.VITE_API_URL || 'https://final-ecri.onrender.com';
      // Remove trailing slash if present
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      // Add /api/v1 only if it's not already included
      const apiUrl = baseUrl.includes('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;
      
      // Add a timestamp parameter to prevent caching
      const timestamp = new Date().getTime();
      
      const url = `${apiUrl}/admin/dashboard/recent-activity?_t=${timestamp}`;
      console.log('Fetching recent activity from:', url);
      
      // Fetch recent activity
      const activityResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!activityResponse.ok) {
        throw new Error(`Failed to fetch recent activity: ${activityResponse.status}`);
      }
      
      const activityData = await activityResponse.json();
      console.log('Updated recent activity data received:', activityData);
      
      // Process the data to extract user information
      const processedData = processActivityData(activityData);
      
      // Check if we have any user verification activities
      const userVerifications = processedData.filter(item => item.type === 'user_verification');
      console.log('User verification activities found:', userVerifications.length, userVerifications);
      
      setRecentActivity(processedData);
      console.log('State updated with new activity data');
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get base API URL
      let baseUrl = import.meta.env.VITE_API_URL || 'https://final-ecri.onrender.com';
      // Remove trailing slash if present
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      // Add /api/v1 only if it's not already included
      const apiUrl = baseUrl.includes('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;
      
      // Get user info for admin name
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const adminName = user.full_name || 'Admin User';
      const token = localStorage.getItem('token');
      
      console.log(`Fetching real-time dashboard data from: ${apiUrl}/admin/dashboard/stats`);
      
      // Add timestamp to avoid caching
      const timestamp = new Date().getTime();
      const statsUrl = `${apiUrl}/admin/dashboard/stats?_t=${timestamp}`;
      
      const statsResponse = await fetch(statsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Admin-Bypass': 'true',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      console.log(`Stats response status: ${statsResponse.status}`);
      
      if (statsResponse.ok) {
        console.log('Successfully fetched real stats data!');
        const statsData = await statsResponse.json();
        console.log('Stats data received:', statsData);
        setStats(statsData);
        setLastUpdated(new Date());
      } else {
        const errorText = await statsResponse.text();
        console.error(`Failed to fetch stats: ${statsResponse.status}`, errorText);
        setError(`Failed to load dashboard data: ${statsResponse.status} - ${errorText}`);
        
        // We don't want to use mock data anymore, just set empty values
        setStats({
          totalAlumni: 0,
          pendingVerifications: 0,
          verifiedDocuments: 0,
          newRegistrations: 0
        });
        
        // Show error toast
        toast.error(`Failed to load dashboard statistics. Please try refreshing the page.`);
      }
      
      // Fetch activity data
      const activityUrl = `${apiUrl}/admin/dashboard/recent-activity?_t=${timestamp}`;
      console.log(`Fetching real activity from: ${activityUrl}`);
      
      const activityResponse = await fetch(activityUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Admin-Bypass': 'true',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (activityResponse.ok) {
        console.log('Successfully fetched real activity data!');
        const activityData = await activityResponse.json();
        
        // Process the activity data to extract user information
        const processedActivityData = processActivityData(activityData);
        setRecentActivity(processedActivityData);
      } else {
        const errorText = await activityResponse.text();
        console.error(`Failed to fetch activity: ${activityResponse.status}`, errorText);
        
        // Set empty activity array instead of mock data
        setRecentActivity([]);
        
        // Show error toast
        toast.error(`Failed to load recent activities. Please try refreshing the page.`);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
      
      // Set empty values instead of mock data
      setStats({
        totalAlumni: 0,
        pendingVerifications: 0,
        verifiedDocuments: 0,
        newRegistrations: 0
      });
      setRecentActivity([]);
      
      // Show error toast
      toast.error(`Failed to load dashboard data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    // Convert to Philippines timezone (UTC+8)
    const date = new Date(dateString);
    // Adjust to Philippines time by adding 8 hours
    const philippinesDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    // Use en-US locale but with adjusted time
    return philippinesDate.toLocaleDateString('en-US', options);
  };

  const formatActivityTitle = (activity) => {
    if (activity.title) {
      return activity.title;
    }
    
    // Handle specific activity types
    if (activity.type === "user_verification") {
      return "User Verification";
    }
    if (activity.type === "registration") {
      return "User Registration";
    }
    if (activity.type === "document_verification") {
      return "Document Verification";
    }
    if (activity.type === "document_upload") {
      return "📄 Recent Upload";
    }
    if (activity.type === "profile_update") {
      return "Profile Update";
    }
    
    // Generic formatting for other types
    if (activity.type) {
      // Convert snake_case to Title Case with spaces
      return activity.type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    
    // Fallbacks based on status
    if (activity.status === "verified") {
      return "Verification Completed";
    }
    if (activity.status === "completed") {
      return "Action Completed";
    }
    if (activity.status === "pending") {
      return "Pending Action";
    }
    
    return "System Activity";
  };

  const formatActivityDescription = (activity) => {
    if (activity.description) {
      return activity.description;
    }
    
    // Try to extract user information
    const userName = activity.user_name || activity.full_name || activity.name || 
                    (activity.user && (activity.user.full_name || activity.user.name)) || 
                    (activity.data && (activity.data.user_name || activity.data.full_name || activity.data.name));
    
    // Handle specific activity types
    if (activity.type === "user_verification") {
      if (userName) {
        return `User ${userName} was verified`;
      }
      if (activity.data && activity.data.email) {
        return `User with email ${activity.data.email} was verified`;
      }
      return "A user was verified";
    }
    
    if (activity.type === "registration") {
      if (userName) {
        return `${userName} registered an account`;
      }
      if (activity.data && activity.data.email) {
        return `New registration with email ${activity.data.email}`;
      }
      return "A new user registered";
    }
    
    if (activity.type === "document_verification") {
      const docType = activity.document_type || 
                     (activity.data && activity.data.document_type) || 
                     "document";
      if (userName) {
        return `${docType.charAt(0).toUpperCase() + docType.slice(1)} for ${userName} was verified`;
      }
      return `A ${docType} was verified`;
    }
    
    if (activity.type === "document_upload") {
      const docType = activity.document_type || 
                     (activity.data && activity.data.document_type) || 
                     "document";
      const docTitle = activity.data && activity.data.document_title ? 
                     activity.data.document_title : "";
      
      if (userName) {
        return `You uploaded ${docTitle ? `"${docTitle}"` : `a new ${docType}`} ${formatDate(activity.timestamp).split(',')[0]}`;
      }
      return `A new ${docType} was uploaded`;
    }
    
    // Check for message
    if (activity.message) {
      return activity.message;
    }
    
    // Generic formatting with available data
    if (userName) {
      return `User: ${userName}`;
    }
    
    if (activity.document_id) {
      return `Document ID: ${activity.document_id}`;
    }
    
    // Status-based fallbacks
    if (activity.status === "verified") {
      return "Item was verified successfully";
    }
    if (activity.status === "completed") {
      return "Action was completed successfully";
    }
    if (activity.status === "pending") {
      return "Action is pending completion";
    }
    
    return "System activity recorded";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  if (error && isAdminUser) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading dashboard data</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
              <button 
                onClick={fetchDashboardData}
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

  // Render different dashboards based on user role
  if (!isAdminUser) {
    // Regular user dashboard (similar to the original DashboardPage)
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {currentUser?.full_name || 'Alumni'}! Manage your profile and documents.
          </p>
        </div>

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
                  to="/admin/profile"
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
                  to="/admin/documents"
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
            {loading ? (
              <div className="py-10 flex justify-center items-center">
                <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="ml-2 text-gray-600">Loading recent activities...</span>
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="py-10 text-center text-gray-500">
                <p>No recent activity found.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {recentActivity.map((activity, i) => (
                  <li key={activity.id || `activity-${i}`} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${activity.status === 'verified' || activity.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : activity.status === 'pending' 
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'}`}>
                          {activity.status === 'verified' ? 'Verified' : 
                           activity.status === 'completed' ? 'Completed' : 
                           activity.status === 'pending' ? 'Pending' : 
                           activity.status}
                        </p>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {formatActivityTitle(activity)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatActivityDescription(activity)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        {formatDate(activity.timestamp)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard (original content)
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome to the CVSU-Carmona Alumni Document Verification System admin panel.
        </p>
      </div>

      {/* Diagnostics Panel - only for admins */}
      {isAdminUser && (
        <DiagnosticPanel />
      )}
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <UsersIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Alumni</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{loading ? '...' : stats.totalAlumni}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/admin/alumni" className="font-medium text-cvsu-green hover:text-cvsu-green">
                View all
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <DocumentCheckIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending Verifications</dt>
                  <dd>
                    {loading ? (
                      <div className="h-7 flex items-center">
                        <svg className="animate-spin h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : (
                      <div className="text-lg font-semibold text-gray-900">{stats.pendingVerifications}</div>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/admin/verifications" className="font-medium text-yellow-600 hover:text-yellow-900">
                Review verifications
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <ChartBarIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Verified Documents</dt>
                  <dd>
                    {loading ? (
                      <div className="h-7 flex items-center">
                        <svg className="animate-spin h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : (
                      <div className="text-lg font-semibold text-gray-900">{stats.verifiedDocuments}</div>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/admin/documents" className="font-medium text-green-600 hover:text-green-900">
                View all documents
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <UserPlusIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">New Registrations</dt>
                  <dd>
                    {loading ? (
                      <div className="h-7 flex items-center">
                        <svg className="animate-spin h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : (
                      <div className="text-lg font-semibold text-gray-900">{stats.newRegistrations}</div>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/admin/registrations" className="font-medium text-purple-600 hover:text-purple-900">
                View new registrations
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow overflow-hidden rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h3>
        </div>
        <div className="border-t border-gray-200">
          {loading ? (
            <div className="py-10 flex justify-center items-center">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-gray-600">Loading recent activities...</span>
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              <p>No recent activity found.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {recentActivity.map((activity, i) => (
                <li key={activity.id || `activity-${i}`} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${activity.status === 'verified' || activity.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : activity.status === 'pending' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'}`}>
                        {activity.status === 'verified' ? 'Verified' : 
                         activity.status === 'completed' ? 'Completed' : 
                         activity.status === 'pending' ? 'Pending' : 
                         activity.status}
                      </p>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {formatActivityTitle(activity)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatActivityDescription(activity)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {formatDate(activity.timestamp)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Quick Actions</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Common administrative tasks</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-4 sm:gap-4 sm:px-6">
              <Link to="/admin/verifications" className="text-sm font-medium text-cvsu-green hover:text-cvsu-green/90">
                Review Pending Verifications
              </Link>
              <Link to="/admin/user-verification" className="text-sm font-medium text-cvsu-green hover:text-cvsu-green/90">
                Verify User Accounts
              </Link>
              <Link to="/admin/users" className="text-sm font-medium text-cvsu-green hover:text-cvsu-green/90">
                Manage Admin Users
              </Link>
              <Link to="/admin/alumni/add" className="text-sm font-medium text-cvsu-green hover:text-cvsu-green/90">
                Add New Alumni
              </Link>
              <Link to="/admin/documents/admin-upload" className="text-sm font-medium text-cvsu-green hover:text-cvsu-green/90">
                Upload Batch Documents
              </Link>
              <Link to="/admin/roles" className="text-sm font-medium text-cvsu-green hover:text-cvsu-green/90">
                Role Management
              </Link>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
} 