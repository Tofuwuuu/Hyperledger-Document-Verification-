import { useAuth } from '../../context/AuthContext';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeTransparentIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const journeySteps = [
  {
    title: 'Profile complete',
    description: 'Your alumni record has the required identity and academic details.',
    icon: UserCircleIcon,
    href: '/alumni/profile/edit',
  },
  {
    title: 'Account verified',
    description: 'An administrator confirms your alumni account.',
    icon: ShieldCheckIcon,
    href: '/alumni/profile',
  },
  {
    title: 'Upload document',
    description: 'Submit diploma, TOR, certificate, or other supported files.',
    icon: ArrowUpTrayIcon,
    href: '/alumni/documents/upload',
  },
  {
    title: 'Admin approves',
    description: 'The registrar/admin team reviews and approves the upload.',
    icon: DocumentCheckIcon,
    href: '/alumni/documents',
  },
  {
    title: 'Blockchain recorded',
    description: 'Approved document hashes are recorded for later verification.',
    icon: CubeTransparentIcon,
    href: '/alumni/documents',
  },
  {
    title: 'Request document',
    description: 'Create a request after a verified upload is available.',
    icon: ClockIcon,
    href: '/alumni/document-requests',
  },
  {
    title: 'Released / downloadable',
    description: 'Download the released document from your request history.',
    icon: ArrowDownTrayIcon,
    href: '/alumni/document-requests',
  },
];

export default function DashboardPage() {
  const { currentUser, isAdmin } = useAuth();
  const location = useLocation();
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const profileComplete = Boolean(
    currentUser?.full_name &&
    currentUser?.email &&
    (currentUser?.student_id || currentUser?.studentId)
  );
  const accountVerified = Boolean(currentUser?.is_verified || isAdmin());
  
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
      return "Recent Upload";
    }
    return activity.type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getJourneyState = (index) => {
    if (index === 0) return profileComplete ? 'complete' : 'current';
    if (index === 1) return accountVerified ? 'complete' : profileComplete ? 'current' : 'locked';
    if (accountVerified && index === 2) return 'current';
    return 'locked';
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
                to="/alumni/profile"
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
                to="/alumni/documents"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-cvsu-green/90"
              >
                View Documents
              </Link>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">Document Journey</h2>
          <p className="mt-1 text-sm text-slate-500">Follow these steps from profile readiness to released document download.</p>
        </div>
        <ol className="grid md:grid-cols-7">
          {journeySteps.map((step, index) => {
            const Icon = step.icon;
            const state = getJourneyState(index);
            const isComplete = state === 'complete';
            const isCurrent = state === 'current';

            return (
              <li key={step.title} className="border-b border-slate-100 p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                <div className="flex items-start gap-3 md:flex-col">
                  <div
                    className={[
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                      isComplete ? 'border-cvsu-green bg-cvsu-green text-white' : '',
                      isCurrent ? 'border-amber-300 bg-amber-50 text-amber-700' : '',
                      !isComplete && !isCurrent ? 'border-slate-200 bg-slate-50 text-slate-400' : '',
                    ].join(' ')}
                  >
                    {isComplete ? <CheckCircleIcon className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-slate-400">Step {index + 1}</span>
                      {isCurrent && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Current</span>}
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">{step.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
                    {(isComplete || isCurrent) && (
                      <Link to={step.href} className="mt-3 inline-flex text-xs font-semibold text-cvsu-green hover:text-cvsu-green/80">
                        Open
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

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
