import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Fragment, useState, useEffect } from 'react';
import { Dialog, Menu, Transition } from '@headlessui/react';
import {
  AcademicCapIcon,
  DocumentCheckIcon,
  UserCircleIcon,
  HomeIcon,
  XMarkIcon,
  Bars3Icon,
  ClipboardDocumentCheckIcon,
  UsersIcon,
  ArrowLeftOnRectangleIcon,
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  FingerPrintIcon,
  BellIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  CalendarIcon,
  QrCodeIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import pollingService from '../services/polling';
// import cvsuLogo from '../assets/cvsu-logo.png';

// Placeholder for the logo until the actual image is added
const cvsuLogo = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzM4YTM4OSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjIwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiPkNWU1U8L3RleHQ+PC9zdmc+';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, logout, isAdmin, loadUserData, forceRefreshUserData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const isAdminUser = isAdmin();
  
  // Get user verification status - more robust check using multiple sources
  const [isVerified, setIsVerified] = useState(false);
  
  // Function to get the correct verification status
  useEffect(() => {
    const checkVerificationStatus = () => {
      // Add explicit debugging for admin status
      console.log('DEBUG - User data check:');
      console.log('- isAdminUser from isAdmin():', isAdminUser);
      console.log('- currentUser:', currentUser);
      console.log('- token type:', localStorage.getItem('token')?.slice(0, 20) + '...');
      
      try {
        const localUser = JSON.parse(localStorage.getItem('user') || '{}');
        console.log('- localStorage user:', localUser);
        console.log('- localStorage user is_admin:', localUser?.is_admin);
        console.log('- localStorage user is_verified:', localUser?.is_verified);
      } catch (e) {
        console.error('Error parsing localStorage user:', e);
      }
      
      // 1. First check if we already know user is admin (admins are always verified)
      if (isAdminUser) {
        console.log('User is admin, automatically verified');
        setIsVerified(true);
        return;
      }
      
      // 2. Check currentUser data from auth context
      if (currentUser?.is_verified) {
        console.log('User verified based on currentUser data');
        setIsVerified(true);
        return;
      }
      
      // 3. Fallback to localStorage user data
      try {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData && userData.is_verified) {
          console.log('User verified based on localStorage user data');
          setIsVerified(true);
          return;
        }
      } catch (e) {
        console.error('Error parsing user data from localStorage:', e);
      }
      
      // Default to not verified if none of the above checks passed
      console.log('User is not verified based on available data');
      setIsVerified(false);
    };
    
    checkVerificationStatus();
  }, [currentUser, isAdminUser]);

  // Function to handle the Force Refresh button click
  const handleForceRefresh = async () => {
    try {
      console.log('Force refreshing user data...');
      
      // Show a loading message
      alert("Refreshing your account data... page will reload in a moment.");
      
      // Use the enhanced force refresh function from AuthContext
      await forceRefreshUserData();
      
      // Hard reload the page to ensure all components update
      window.location.reload(true); // true forces a reload from server, not cache
    } catch (err) {
      console.error('Error during force refresh:', err);
      alert("Error refreshing data. Please try logging out and back in.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Common navigation items for all users
  const commonNavigation = [
    { 
      name: 'Dashboard', 
      href: isAdminUser ? '/admin' : '/alumni', 
      icon: HomeIcon, 
      current: location.pathname === (isAdminUser ? '/admin' : '/alumni'),
      alwaysAccessible: true // Always show this regardless of verification status
    },
    { 
      name: 'Profile', 
      href: isAdminUser ? '/admin/profile' : '/alumni/profile', 
      icon: UserCircleIcon, 
      current: location.pathname === (isAdminUser ? '/admin/profile' : '/alumni/profile'),
      alwaysAccessible: true // Always show this regardless of verification status
    },
    // Only show Documents for regular alumni users
    ...(isAdminUser ? [] : [{
      name: 'Documents', 
      href: '/alumni/documents', 
      icon: DocumentCheckIcon, 
      current: location.pathname === '/alumni/documents',
      alwaysAccessible: false // Requires verification
    }]),
    // Only show Upload Documents for regular alumni users
    ...(isAdminUser ? [] : [{
      name: 'Upload Documents',
      href: '/alumni/documents/upload',
      icon: DocumentArrowUpIcon,
      current: location.pathname === '/alumni/documents/upload',
      alwaysAccessible: false // Requires verification
    }]),
    {
      name: 'Document Requests',
      href: isAdminUser ? '/admin/document-requests' : '/alumni/document-requests',
      icon: DocumentIcon,
      current: location.pathname === (isAdminUser ? '/admin/document-requests' : '/alumni/document-requests'),
      alwaysAccessible: false // Requires verification
    },
    // Only show My Registrations for regular alumni users
    ...(isAdminUser ? [] : [{
      name: 'My Registrations', 
      href: '/alumni/registrations', 
      icon: QrCodeIcon, 
      current: location.pathname === '/alumni/registrations',
      alwaysAccessible: false // Requires verification
    }]),
  ];

  // Admin-only navigation items
  const adminOnlyNavigation = [
    { 
      name: 'User Verification', 
      href: '/admin/user-verification', 
      icon: FingerPrintIcon, 
      current: location.pathname === '/admin/user-verification' 
    },
    { 
      name: 'Document Verification', 
      href: '/admin/verifications', 
      icon: ClipboardDocumentCheckIcon, 
      current: location.pathname === '/admin/verifications' 
    },
    { 
      name: 'All Documents', 
      href: '/admin/admin-documents', 
      icon: DocumentCheckIcon, 
      current: location.pathname === '/admin/admin-documents' 
    },
    {
      name: 'Manage Document Requests',
      href: '/admin/document-requests-admin',
      icon: DocumentIcon,
      current: location.pathname === '/admin/document-requests-admin'
    },
    { 
      name: 'User Management', 
      href: '/admin/users', 
      icon: UserGroupIcon, 
      current: location.pathname === '/admin/users' 
    },
    { 
      name: 'Role Management', 
      href: '/admin/roles', 
      icon: ShieldCheckIcon, 
      current: location.pathname === '/admin/roles' 
    },
    { 
      name: 'Events Management', 
      href: '/admin/events', 
      icon: CalendarIcon, 
      current: location.pathname === '/admin/events' || location.pathname === '/admin/events/new' || location.pathname.startsWith('/admin/events/edit/'),
      subItems: [
        { 
          name: 'All Events', 
          href: '/admin/events',
          current: location.pathname === '/admin/events'
        },
        { 
          name: 'Event Registrations', 
          href: '/admin/event-registrations',
          current: location.pathname.includes('/admin/events/registrations')
        }
      ]
    },
    {
      name: 'Alumni Management',
      href: '/admin/alumni',
      icon: AcademicCapIcon,
      current: location.pathname === '/admin/alumni' || location.pathname.startsWith('/admin/alumni/')
    }
  ];

  // Combine navigation based on user role
  const fullNavigation = isAdminUser 
    ? [...commonNavigation, ...adminOnlyNavigation] 
    : commonNavigation;

  // Filter navigation items based on verification status
  const filteredNavigation = isAdminUser || isVerified 
    ? fullNavigation // Show all items for admins or verified users
    : fullNavigation.filter(item => item.alwaysAccessible); // Filter to only show always accessible items for unverified users

  // Fetch notifications on component mount
  useEffect(() => {
    // Check if using admin bypass token
    const token = localStorage.getItem('token');
    if (token && token.startsWith('admin_access_token_')) {
      console.log('DashboardLayout detected admin bypass token - skipping notification API calls');
      // For admin bypass, set empty notifications
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    
    const fetchNotifications = async () => {
      try {
        // Get base API URL
        let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        // Remove trailing slash if present
        baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        // Add /api/v1 only if it's not already included
        const apiUrl = baseUrl.includes('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;
        
        // Add a timestamp parameter to prevent caching
        const timestamp = new Date().getTime();
        
        const response = await fetch(`${apiUrl}/notifications?include_read=true&limit=5&_t=${timestamp}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }
        
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };

    // Start polling for notifications
    console.log("Starting notification polling in DashboardLayout");
    pollingService.startPolling();
    
    // Listen for new notifications
    const unsubscribe = pollingService.on('message', (data) => {
      console.log("Dashboard received notification:", data);
      setUnreadCount(prev => prev + 1);
      setNotifications(prev => [data, ...prev].slice(0, 5));  // Keep last 5 notifications
    });
    
    // Initial fetch of existing notifications
    fetchNotifications();
    
    return () => {
      unsubscribe();
      pollingService.stopPolling();
    };
  }, []);

  // Handle notification click
  const handleNotificationClick = async (notificationId) => {
    try {
      // Check if using admin bypass token
      const token = localStorage.getItem('token');
      if (token && token.startsWith('admin_access_token_')) {
        console.log('Admin bypass token - skipping notification read API call');
        // Just update local state
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => 
          prev.map(n => n.notification_id === notificationId ? {...n, is_read: true} : n)
        );
        return;
      }
      
      // Get base API URL
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      await fetch(`${baseUrl}/api/v1/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Update local state
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => 
        prev.map(n => n.notification_id === notificationId ? {...n, is_read: true} : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      // Check if using admin bypass token
      const token = localStorage.getItem('token');
      if (token && token.startsWith('admin_access_token_')) {
        console.log('Admin bypass token - skipping mark all as read API call');
        // Just update local state
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({...n, is_read: true})));
        return;
      }
      
      // Get base API URL
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      await fetch(`${baseUrl}/api/v1/notifications/read-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Update local state
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({...n, is_read: true})));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return (
    <div>
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                
                {/* Sidebar component for mobile */}
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
                  <div className="flex h-16 shrink-0 items-center">
                    <img
                      className="h-10 w-auto"
                      src={cvsuLogo}
                      alt="CVSU Logo"
                    />
                    <span className="ml-3 text-lg font-bold text-cvsu-green">CVSU-Carmona</span>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {fullNavigation.map((item) => {
                            const isAccessible = item.alwaysAccessible || isVerified || isAdminUser;
                            return (
                              <li key={item.name}>
                                {isAccessible ? (
                                  <Link
                                    to={item.href}
                                    className={classNames(
                                      item.current
                                        ? 'bg-gray-50 text-cvsu-green'
                                        : 'text-gray-700 hover:text-cvsu-green hover:bg-gray-50',
                                      'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                    )}
                                  >
                                    <item.icon
                                      className={classNames(
                                        item.current ? 'text-cvsu-green' : 'text-gray-400 group-hover:text-cvsu-green',
                                        'h-6 w-6 shrink-0'
                                      )}
                                      aria-hidden="true"
                                    />
                                    {item.name}
                                  </Link>
                                ) : (
                                  <div
                                    className="text-gray-400 cursor-not-allowed flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                                    title="Account needs verification to access this feature"
                                  >
                                    <item.icon
                                      className="text-gray-300 h-6 w-6 shrink-0"
                                      aria-hidden="true"
                                    />
                                    {item.name}
                                    <span className="ml-2 text-xs text-red-400">(Needs verification)</span>
                                  </div>
                                )}
                                {item.subItems && isAccessible && (
                                  <ul className="mt-1 pl-8 space-y-1">
                                    {item.subItems.map((subItem) => (
                                      <li key={subItem.name}>
                                        <Link
                                          to={subItem.href}
                                          className={classNames(
                                            subItem.current
                                              ? 'bg-gray-50 text-cvsu-green'
                                              : 'text-gray-700 hover:text-cvsu-green hover:bg-gray-50',
                                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6'
                                          )}
                                        >
                                          {subItem.name}
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                      <li>
                        <div className="-mx-2 mt-auto">
                          <button
                            onClick={handleLogout}
                            className="flex w-full items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50"
                          >
                            <ArrowLeftOnRectangleIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                            Log out
                          </button>
                        </div>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <img
              className="h-10 w-auto"
              src={cvsuLogo}
              alt="CVSU Logo"
            />
            <span className="ml-3 text-lg font-bold text-cvsu-green">CVSU-Carmona</span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <div className="text-xs font-semibold leading-6 text-gray-400">MENU</div>
                <ul role="list" className="-mx-2 mt-2 space-y-1">
                  {fullNavigation.map((item) => {
                    const isAccessible = item.alwaysAccessible || isVerified || isAdminUser;
                    return (
                      <li key={item.name}>
                        {isAccessible ? (
                          <Link
                            to={item.href}
                            className={classNames(
                              item.current
                                ? 'bg-gray-50 text-cvsu-green'
                                : 'text-gray-700 hover:text-cvsu-green hover:bg-gray-50',
                              'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                            )}
                          >
                            <item.icon
                              className={classNames(
                                item.current ? 'text-cvsu-green' : 'text-gray-400 group-hover:text-cvsu-green',
                                'h-6 w-6 shrink-0'
                              )}
                              aria-hidden="true"
                            />
                            {item.name}
                          </Link>
                        ) : (
                          <div
                            className="text-gray-400 cursor-not-allowed flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                            title="Account needs verification to access this feature"
                          >
                            <item.icon
                              className="text-gray-300 h-6 w-6 shrink-0"
                              aria-hidden="true"
                            />
                            {item.name}
                            <span className="ml-2 text-xs text-red-400">(Needs verification)</span>
                          </div>
                        )}
                        {item.subItems && isAccessible && (
                          <ul className="mt-1 pl-8 space-y-1">
                            {item.subItems.map((subItem) => (
                              <li key={subItem.name}>
                                <Link
                                  to={subItem.href}
                                  className={classNames(
                                    subItem.current
                                      ? 'bg-gray-50 text-cvsu-green'
                                      : 'text-gray-700 hover:text-cvsu-green hover:bg-gray-50',
                                    'group flex gap-x-3 rounded-md p-2 text-sm leading-6'
                                  )}
                                >
                                  {subItem.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
              <li className="-mx-2 mt-auto">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeftOnRectangleIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                  Log out
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Top header and content */}
      <div className="lg:pl-72">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button type="button" className="-m-2.5 p-2.5 text-gray-700 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          {/* Separator */}
          <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-end">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 py-3">
                Home
              </Link>
              
              {/* Notification bell */}
              <div className="relative">
                <Menu as="div" className="relative">
                  <div>
                    <Menu.Button className="flex items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2">
                      <span className="sr-only">Open notifications menu</span>
                      <div className="relative">
                        <BellIcon className="h-6 w-6 text-gray-400 hover:text-gray-500" aria-hidden="true" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-xs">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </Menu.Button>
                  </div>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <div className="px-4 py-2 border-b flex justify-between items-center">
                        <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-xs text-cvsu-green hover:text-cvsu-green/80"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      
                      {notifications.length === 0 ? (
                        <p className="py-4 px-4 text-sm text-gray-500 text-center">
                          No notifications yet
                        </p>
                      ) : (
                        <>
                          {notifications.map((notification, index) => (
                            <Menu.Item key={notification.notification_id || index}>
                              {({ active }) => (
                                <div
                                  className={`${
                                    active ? 'bg-gray-50' : ''
                                  } px-4 py-3 border-b cursor-pointer`}
                                  onClick={() => handleNotificationClick(notification.notification_id)}
                                >
                                  <div className="flex items-start">
                                    <div className={`w-2 h-2 mt-1 rounded-full flex-shrink-0 ${notification.is_read ? 'bg-gray-300' : 'bg-cvsu-green'}`}></div>
                                    <div className="ml-2">
                                      <p className="text-sm font-medium text-gray-900">{notification.type}</p>
                                      <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
                                      <p className="text-xs text-gray-400 mt-1">
                                        {new Date(notification.timestamp).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Menu.Item>
                          ))}
                          <div className="px-4 py-2 text-center">
                            <Link 
                              to="/dashboard/notifications"
                              className="text-xs font-medium text-cvsu-green hover:text-cvsu-green/80"
                            >
                              View all notifications
                            </Link>
                          </div>
                        </>
                      )}
                    </Menu.Items>
                  </Transition>
                </Menu>
              </div>
              
              {/* User menu */}
              <div className="relative">
                <Menu as="div" className="relative ml-3">
                  <div>
                    <Menu.Button className="flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2">
                      <span className="sr-only">Open user menu</span>
                      <UserCircleIcon className="h-8 w-8 text-gray-400" aria-hidden="true" />
                    </Menu.Button>
                  </div>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to="/admin/profile"
                            className={classNames(
                              active ? 'bg-gray-100' : '',
                              'block px-4 py-2 text-sm text-gray-700'
                            )}
                          >
                            Your Profile
                          </Link>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to="/admin/documents"
                            className={classNames(
                              active ? 'bg-gray-100' : '',
                              'block px-4 py-2 text-sm text-gray-700'
                            )}
                          >
                            Your Documents
                          </Link>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleLogout}
                            className={classNames(
                              active ? 'bg-gray-100' : '',
                              'block w-full text-left px-4 py-2 text-sm text-gray-700'
                            )}
                          >
                            Sign out
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>
              </div>
            </div>
          </div>
        </div>

        {/* Verification warning banner for non-admin, unverified alumni */}
        {!isAdminUser && !isVerified && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 mx-4 sm:mx-6 lg:mx-8 mt-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Your account is not yet verified. Some features are disabled until verification is complete.
                  <span className="font-medium"> Please contact the administrator for verification.</span>
                </p>
                <div className="mt-2 text-xs">
                  <div className="flex flex-col space-y-1 text-gray-500">
                    <p>Having trouble with verification? Try these steps:</p>
                    <ul className="list-disc pl-5">
                      <li>Ensure you have filled out your profile information</li>
                      <li>Check if you've been verified but need to refresh your login</li>
                      <li>Contact your administrator at admin@cvsu.edu.ph for assistance</li>
                    </ul>
                    <div className="mt-1">
                      <Link to="/debug-auth" className="text-blue-500 hover:underline mr-2">Auth Debug</Link> | 
                      <button 
                        onClick={() => {
                          localStorage.clear();
                          window.location.href = '/login';
                        }} 
                        className="text-blue-500 hover:underline mx-2"
                      >
                        Logout & Clear Data
                      </button> | 
                      <button 
                        onClick={handleForceRefresh} 
                        className="text-blue-500 hover:underline ml-2"
                      >
                        Force Refresh
                      </button>
                      
                      {/* Special fix button that only appears for specific account */}
                      {currentUser?.email === 'rodericksalise812@gmail.com' && (
                        <>
                          {' | '}
                          <button 
                            onClick={() => {
                              console.log('Special verification fix for rodericksalise812@gmail.com');
                              // Directly modify user data and refresh
                              try {
                                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                                if (userData && userData.email === 'rodericksalise812@gmail.com') {
                                  userData.is_verified = true;
                                  localStorage.setItem('user', JSON.stringify(userData));
                                  console.log('Set is_verified=true for rodericksalise812@gmail.com');
                                  // Force update state
                                  setIsVerified(true);
                                  // Reload page after short delay
                                  setTimeout(() => window.location.reload(), 500);
                                }
                              } catch (e) {
                                console.error('Error fixing verification:', e);
                              }
                            }}
                            className="text-green-500 hover:underline ml-2 font-bold"
                          >
                            Fix My Account
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
} 