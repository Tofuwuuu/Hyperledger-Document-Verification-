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
import cvsuLogo from '../assets/cvsu-logo.png';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function isUnavailableEndpointStatus(status) {
  return status === 404 || status === 405;
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isAdminUser = isAdmin();
  const isVerified = isAdminUser || Boolean(currentUser?.is_verified);

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
    // Only show Document Requests for regular alumni users (not for admin)
    ...(isAdminUser ? [] : [{
      name: 'Document Requests',
      href: '/alumni/document-requests',
      icon: DocumentIcon,
      current: location.pathname === '/alumni/document-requests',
      alwaysAccessible: false // Requires verification
    }]),
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
      current: location.pathname === '/admin/user-verification',
      alwaysAccessible: true,
      section: 'Verification'
    },
    { 
      name: 'Document Verification', 
      href: '/admin/verifications', 
      icon: ClipboardDocumentCheckIcon, 
      current: location.pathname === '/admin/verifications',
      alwaysAccessible: true,
      section: 'Verification',
      badge: 'Review'
    },
    { 
      name: 'All Documents', 
      href: '/admin/admin-documents', 
      icon: DocumentCheckIcon, 
      current: location.pathname === '/admin/admin-documents',
      alwaysAccessible: true,
      section: 'Documents'
    },
    {
      name: 'Manage Document Requests',
      href: '/admin/document-requests-admin',
      icon: DocumentIcon,
      current: location.pathname === '/admin/document-requests-admin',
      alwaysAccessible: true,
      section: 'Documents'
    },
    { 
      name: 'User Management', 
      href: '/admin/users', 
      icon: UserGroupIcon, 
      current: location.pathname === '/admin/users',
      alwaysAccessible: true,
      section: 'People'
    },
    { 
      name: 'Role Management', 
      href: '/admin/roles', 
      icon: ShieldCheckIcon, 
      current: location.pathname === '/admin/roles',
      alwaysAccessible: true,
      section: 'People'
    },
    { 
      name: 'Events Management', 
      href: '/admin/events', 
      icon: CalendarIcon, 
      current: location.pathname === '/admin/events' || location.pathname === '/admin/events/new' || location.pathname.startsWith('/admin/events/edit/'),
      alwaysAccessible: true,
      section: 'Operations',
      subItems: [
        { 
          name: 'All Events', 
          href: '/admin/events',
          current: location.pathname === '/admin/events'
        },
        { 
          name: 'Event Registrations', 
          href: '/admin/event-registrations',
          current: location.pathname === '/admin/event-registrations' || location.pathname.includes('/admin/events/registrations')
        }
      ]
    },
    {
      name: 'Alumni Management',
      href: '/admin/alumni',
      icon: AcademicCapIcon,
      current: location.pathname === '/admin/alumni' || location.pathname.startsWith('/admin/alumni/'),
      alwaysAccessible: true,
      section: 'People'
    }
  ];

  // Combine navigation based on user role
  const fullNavigation = isAdminUser 
    ? [...commonNavigation, ...adminOnlyNavigation] 
    : commonNavigation;
  const activeNavigationItem = fullNavigation.find((item) => item.current);

  const navigationSections = isAdminUser
    ? [
        { name: 'Workspace', items: commonNavigation },
        { name: 'Verification', items: adminOnlyNavigation.filter((item) => item.section === 'Verification') },
        { name: 'Documents', items: adminOnlyNavigation.filter((item) => item.section === 'Documents') },
        { name: 'Operations', items: adminOnlyNavigation.filter((item) => item.section === 'Operations') },
        { name: 'People', items: adminOnlyNavigation.filter((item) => item.section === 'People') },
      ]
    : [{ name: 'Menu', items: fullNavigation }];

  const renderNavigationItem = (item, isCompact = false) => {
    const isAccessible = item.alwaysAccessible || isVerified || isAdminUser;
    const itemClasses = classNames(
      item.current
        ? 'bg-cvsu-green text-white shadow-sm'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
      'group flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-semibold transition'
    );
    const iconClasses = classNames(
      item.current ? 'text-white' : 'text-slate-400 group-hover:text-cvsu-green',
      'h-5 w-5 shrink-0'
    );

    if (!isAccessible) {
      return (
        <div
          className="flex cursor-not-allowed items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-400"
          title="Account needs verification to access this feature"
        >
          <item.icon className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
        </div>
      );
    }

    return (
      <>
        <Link
          to={item.href}
          className={itemClasses}
          onClick={() => {
            if (isCompact) {
              setSidebarOpen(false);
            }
            localStorage.setItem('lastNavigation', JSON.stringify({
              name: item.name,
              path: item.href,
              time: new Date().toISOString()
            }));
          }}
        >
          <item.icon className={iconClasses} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {item.badge && (
            <span
              className={classNames(
                item.current ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700',
                'rounded-full px-2 py-0.5 text-[11px] font-bold'
              )}
            >
              {item.badge}
            </span>
          )}
        </Link>
        {item.subItems && (
          <ul className="ml-8 mt-1 space-y-1 border-l border-slate-200 pl-3">
            {item.subItems.map((subItem) => (
              <li key={subItem.name}>
                <Link
                  to={subItem.href}
                  onClick={() => isCompact && setSidebarOpen(false)}
                  className={classNames(
                    subItem.current
                      ? 'text-cvsu-green'
                      : 'text-slate-500 hover:text-slate-950',
                    'block rounded-md px-3 py-1.5 text-sm font-medium hover:bg-slate-100'
                  )}
                >
                  {subItem.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };

  // Debug logging for path changes
  useEffect(() => {
    console.log('Current path:', location.pathname);
    // Check which navigation item should be active
    const activeItem = fullNavigation.find(item => item.href === location.pathname);
    if (activeItem) {
      console.log('Active navigation item:', activeItem.name);
    } else {
      console.log('No matching navigation item for current path');
    }
  }, [location.pathname, fullNavigation]);

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

    let isMounted = true;
    
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
          if (isUnavailableEndpointStatus(response.status)) {
            pollingService.disableEndpoint();
            if (isMounted) {
              setNotifications([]);
              setUnreadCount(0);
            }
            return false;
          }
          throw new Error('Failed to fetch notifications');
        }
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : ((data && data.notifications) || []);
        if (isMounted) {
          setNotifications(items);
          setUnreadCount(
            Array.isArray(data)
              ? items.filter((notification) => !(notification.is_read ?? notification.read)).length
              : (data?.unread_count ?? 0)
          );
        }
        return true;
      } catch {
        if (isMounted) {
          setNotifications([]);
          setUnreadCount(0);
        }
        return false;
      }
    };
    
    // Listen for new notifications
    const unsubscribe = pollingService.on('message', (data) => {
      console.log("Dashboard received notification:", data);
      setUnreadCount(prev => (prev || 0) + 1);
      setNotifications(prev => [data, ...(prev || [])].slice(0, 5));  // Keep last 5 notifications
    });

    const initializeNotifications = async () => {
      const endpointAvailable = await fetchNotifications();
      if (endpointAvailable && isMounted && !pollingService.endpointDisabled) {
        console.log("Starting notification polling in DashboardLayout");
        pollingService.startPolling();
      }
    };

    initializeNotifications();
    
    return () => {
      isMounted = false;
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
          (prev || []).map(n => n.notification_id === notificationId ? {...n, is_read: true} : n)
        );
        return;
      }
      
      // Get base API URL
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${baseUrl}/api/v1/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok && !isUnavailableEndpointStatus(response.status)) {
        throw new Error('Failed to mark notification as read');
      }
      
      // Update local state
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => 
        prev.map(n => (n.notification_id === notificationId || n._id === notificationId || n.id === notificationId)
          ? {...n, is_read: true, read: true}
          : n)
      );
    } catch {
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev =>
        prev.map(n => (n.notification_id === notificationId || n._id === notificationId || n.id === notificationId)
          ? {...n, is_read: true, read: true}
          : n)
      );
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
      
      const response = await fetch(`${baseUrl}/api/v1/notifications/read-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok && !isUnavailableEndpointStatus(response.status)) {
        throw new Error('Failed to mark all notifications as read');
      }
      
      // Update local state
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({...n, is_read: true, read: true})));
    } catch {
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({...n, is_read: true, read: true})));
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
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-4 pb-4">
                  <div className="flex h-16 shrink-0 items-center px-2">
                    <img
                      className="h-10 w-auto"
                      src={cvsuLogo}
                      alt="CVSU Logo"
                    />
                    <div className="ml-3">
                      <p className="text-base font-bold text-cvsu-green">CVSU-Carmona</p>
                      <p className="text-xs font-medium text-slate-500">{isAdminUser ? 'Admin Console' : 'Alumni Portal'}</p>
                    </div>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-6">
                      {navigationSections.map((section) => (
                        <li key={section.name}>
                          <div className="px-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">{section.name}</div>
                          <ul role="list" className="mt-2 space-y-1">
                            {section.items.map((item) => (
                              <li key={item.name}>{renderNavigationItem(item, true)}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                      <li>
                        <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <button
                            onClick={handleLogout}
                            className="flex w-full items-center gap-x-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                          >
                            <ArrowLeftOnRectangleIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
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
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-slate-200 bg-white px-4 pb-4">
          <div className="flex h-20 shrink-0 items-center rounded-b-2xl bg-cvsu-green/5 px-3">
            <img
              className="h-10 w-auto"
              src={cvsuLogo}
              alt="CVSU Logo"
            />
            <div className="ml-3">
              <p className="text-base font-bold text-cvsu-green">CVSU-Carmona</p>
              <p className="text-xs font-medium text-slate-500">{isAdminUser ? 'Admin Console' : 'Alumni Portal'}</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-6">
              {navigationSections.map((section) => (
                <li key={section.name}>
                  <div className="px-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">{section.name}</div>
                  <ul role="list" className="mt-2 space-y-1">
                    {section.items.map((item) => (
                      <li key={item.name}>{renderNavigationItem(item)}</li>
                    ))}
                  </ul>
                </li>
              ))}
              <li className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 px-1 text-xs font-medium text-slate-500">
                  Signed in as {currentUser?.full_name || currentUser?.email || 'Administrator'}
                </p>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-x-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  <ArrowLeftOnRectangleIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  Log out
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Top header and content */}
      <div className="min-h-screen bg-slate-50 lg:pl-72">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur sm:gap-x-6 sm:px-6 lg:px-8">
          <button type="button" className="-m-2.5 p-2.5 text-gray-700 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          {/* Separator */}
          <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

          <div className="hidden flex-1 items-center lg:flex">
            <div>
              <p className="text-sm font-semibold text-slate-900">{activeNavigationItem?.name || (isAdminUser ? 'Admin Console' : 'Alumni Portal')}</p>
              <p className="text-xs text-slate-500">{isAdminUser ? 'Manage verification, documents, events, and accounts' : 'Manage your profile and records'}</p>
            </div>
          </div>

          <div className="flex flex-1 gap-x-4 self-stretch lg:flex-none lg:gap-x-6 justify-end">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <Link to="/" className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 sm:block">
                Home
              </Link>
              
              {/* Notification bell */}
              <div className="relative">
                <Menu as="div" className="relative">
                  <div>
                    <Menu.Button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2">
                      <span className="sr-only">Open notifications menu</span>
                      <div className="relative">
                        <BellIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
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
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-lg bg-white py-1 shadow-xl ring-1 ring-slate-900/10 focus:outline-none">
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
                      
                      {(notifications?.length ?? 0) === 0 ? (
                        <p className="py-4 px-4 text-sm text-gray-500 text-center">
                          No notifications yet
                        </p>
                      ) : (
                        <>
                          {(notifications || []).map((notification, index) => (
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
                              to={isAdminUser ? "/admin/notifications" : "/alumni/notifications"}
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
                    <Menu.Button className="flex max-w-xs items-center rounded-full border border-slate-200 bg-white p-1 text-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2">
                      <span className="sr-only">Open user menu</span>
                      <UserCircleIcon className="h-8 w-8 text-slate-500" aria-hidden="true" />
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
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-lg bg-white py-1 shadow-xl ring-1 ring-slate-900/10 focus:outline-none">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{currentUser?.full_name || 'Administrator'}</p>
                        <p className="truncate text-xs text-slate-500">{currentUser?.email || 'Admin account'}</p>
                      </div>
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to={isAdminUser ? "/admin/profile" : "/alumni/profile"}
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
                            to={isAdminUser ? "/admin/admin-documents" : "/alumni/documents"}
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
        {!isAdminUser && (!isVerified && !currentUser?.is_verified) && (
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
} 
