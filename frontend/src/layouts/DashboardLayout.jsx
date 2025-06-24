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
  BuildingOfficeIcon,
  DocumentMagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import pollingService from '../services/polling';
import cvsuLogo from '../assets/cvsu-logo.png';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const isAdminUser = isAdmin();
  const isEmployerUser = currentUser?.type === 'employer' || currentUser?.is_employer === true;
  const [fullNavigation, setFullNavigation] = useState([]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Initialize navigation with dropdown state
  useEffect(() => {
    // Common navigation items for all users
    const commonNavItems = isAdminUser || isEmployerUser ? [
      { 
        name: 'Dashboard', 
        href: isAdminUser ? '/admin' : '/employer', 
        icon: HomeIcon, 
        current: location.pathname === (isAdminUser ? '/admin' : '/employer')
      },
      { 
        name: 'Profile', 
        href: isAdminUser ? '/admin/profile' : '/employer/profile', 
        icon: UserCircleIcon, 
        current: location.pathname === (isAdminUser ? '/admin/profile' : '/employer/profile')
      },
    ] : [];

    // Employer-specific navigation items
    const employerItems = [
      {
        name: 'Verify Documents',
        href: '/employer/verifications',
        icon: DocumentMagnifyingGlassIcon,
        current: location.pathname === '/employer/verifications'
      },
      {
        name: 'Recruitment Skills',
        href: '/employer/recruitment',
        icon: UserGroupIcon,
        current: location.pathname === '/employer/recruitment'
      }
    ];

    // Alumni-specific navigation items
    const alumniItems = [
      { 
        name: 'Dashboard', 
        href: '/alumni', 
        icon: HomeIcon, 
        current: location.pathname === '/alumni'
      },
      {
        name: 'Profile', 
        href: '/alumni/profile', 
        icon: UserCircleIcon, 
        current: location.pathname === '/alumni/profile'
      },
      {
        name: 'Document Center',
        href: '#',
        icon: DocumentIcon,
        current: location.pathname === '/alumni/documents' ||
                location.pathname === '/alumni/documents/upload' ||
                location.pathname === '/alumni/document-requests',
        isDropdown: true,
        isOpen: false, // Start closed
        children: [
          { 
            name: 'My Documents', 
            href: '/alumni/documents', 
            icon: DocumentCheckIcon, 
            current: location.pathname === '/alumni/documents'
          },
          {
            name: 'Upload Documents',
            href: '/alumni/documents/upload',
            icon: DocumentArrowUpIcon,
            current: location.pathname === '/alumni/documents/upload'
          },
          {
            name: 'Document Requests',
            href: '/alumni/document-requests',
            icon: DocumentIcon,
            current: location.pathname === '/alumni/document-requests'
          }
        ]
      },
      {
        name: 'Activities',
        href: '#',
        icon: UserGroupIcon,
        current: location.pathname === '/alumni/registrations' ||
                location.pathname === '/alumni/recruitment',
        isDropdown: true,
        isOpen: false,
        children: [
          {
            name: 'My Registrations', 
            href: '/alumni/registrations', 
            icon: QrCodeIcon, 
            current: location.pathname === '/alumni/registrations'
          },
          {
            name: 'Recruitment Skills', 
            href: '/alumni/recruitment', 
            icon: UserGroupIcon, 
            current: location.pathname === '/alumni/recruitment'
          }
        ]
      }
    ];

    // Admin-only navigation items
    const adminItems = [
      { 
        name: 'User Management',
        href: '#', // No direct link when it's a dropdown parent
        icon: UserGroupIcon,
        current: location.pathname === '/admin/users' || 
                location.pathname === '/admin/roles' || 
                location.pathname === '/admin/user-verification',
        isDropdown: true,
        isOpen: false, // Start closed
        children: [
          { 
            name: 'User Verification', 
            href: '/admin/user-verification', 
            icon: FingerPrintIcon, 
            current: location.pathname === '/admin/user-verification' 
          },
          { 
            name: 'Manage Users', 
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
        ]
      },
      {
        name: 'Document Management',
        href: '#',
        icon: DocumentIcon,
        current: location.pathname === '/admin/verifications' || 
                location.pathname === '/admin/document-requests-admin',
        isDropdown: true,
        isOpen: false, // Start closed
        children: [
          { 
            name: 'Document Verification', 
            href: '/admin/verifications', 
            icon: ClipboardDocumentCheckIcon, 
            current: location.pathname === '/admin/verifications' 
          },
          {
            name: 'Document Requests',
            href: '/admin/document-requests-admin',
            icon: DocumentIcon,
            current: location.pathname === '/admin/document-requests-admin'
          }
        ]
      },
      { 
        name: 'Events Management', 
        href: '#', 
        icon: CalendarIcon,
        current: location.pathname === '/admin/events' || 
                location.pathname === '/admin/events/new' || 
                location.pathname.startsWith('/admin/events/edit/') ||
                location.pathname.includes('/admin/events/registrations'),
        isDropdown: true,
        isOpen: false, // Start closed
        children: [
          { 
            name: 'All Events', 
            href: '/admin/events',
            icon: CalendarIcon,
            current: location.pathname === '/admin/events'
          },
          { 
            name: 'Event Registrations', 
            href: '/admin/event-registrations',
            icon: QrCodeIcon,
            current: location.pathname.includes('/admin/events/registrations')
          }
        ]
      },
      {
        name: 'Alumni Services',
        href: '#',
        icon: AcademicCapIcon,
        current: location.pathname === '/admin/alumni' || 
                location.pathname.startsWith('/admin/alumni/') ||
                location.pathname === '/admin/exit-interviews',
        isDropdown: true,
        isOpen: false, // Start closed
        children: [
          {
            name: 'Alumni Management',
            href: '/admin/alumni',
            icon: AcademicCapIcon,
            current: location.pathname === '/admin/alumni' || location.pathname.startsWith('/admin/alumni/')
          },
          {
            name: 'Exit Interviews',
            href: '/admin/exit-interviews',
            icon: AcademicCapIcon,
            current: location.pathname === '/admin/exit-interviews'
          }
        ]
      }
    ];

    // Combine navigation based on user role
    const items = isAdminUser 
      ? [...commonNavItems, ...adminItems] 
      : isEmployerUser
      ? [...commonNavItems, ...employerItems]
      : [...commonNavItems, ...alumniItems];

    setFullNavigation(items);
  }, [isAdminUser, isEmployerUser, location.pathname]);

  // Fetch notifications on component mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Use the proxy path directly to avoid CORS issues
        const apiUrl = '/api/v1';
        
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
      // Use the proxy path directly
      const apiUrl = '/api/v1';
      
      await fetch(`${apiUrl}/notifications/${notificationId}/read`, {
        method: 'PUT',
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
      // Use the proxy path directly
      const apiUrl = '/api/v1';
      
      await fetch(`${apiUrl}/notifications/mark-all-read`, {
        method: 'PUT',
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
                          {fullNavigation.map((item) => (
                            <li key={item.name}>
                              {item.isDropdown ? (
                                // Dropdown menu item for mobile
                                <div>
                                  <button
                                    className={classNames(
                                      item.current
                                        ? 'bg-gray-50 text-cvsu-green'
                                        : 'text-gray-700 hover:text-cvsu-green hover:bg-gray-50',
                                      'group flex w-full items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                    )}
                                    onClick={() => {
                                      setFullNavigation(nav => 
                                        nav.map(navItem => 
                                          navItem.name === item.name 
                                            ? {...navItem, isOpen: !navItem.isOpen} 
                                            : navItem
                                        )
                                      );
                                    }}
                                  >
                                    <item.icon
                                      className={classNames(
                                        item.current ? 'text-cvsu-green' : 'text-gray-400 group-hover:text-cvsu-green',
                                        'h-6 w-6 shrink-0'
                                      )}
                                      aria-hidden="true"
                                    />
                                    {item.name}
                                    <svg 
                                      className={classNames(
                                        item.isOpen ? 'rotate-90' : '',
                                        'ml-auto h-5 w-5 flex-none text-gray-400 transition-transform'
                                      )}
                                      viewBox="0 0 20 20" 
                                      fill="currentColor" 
                                      aria-hidden="true"
                                    >
                                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                  {/* Dropdown children */}
                                  {item.isOpen && item.children && (
                                    <ul className="mt-1 pl-8 space-y-1">
                                      {item.children.map((child) => (
                                        <li key={child.name}>
                                          <Link
                                            to={child.href}
                                            className={classNames(
                                              child.current
                                                ? 'bg-gray-50 text-cvsu-green'
                                                : 'text-gray-700 hover:text-cvsu-green hover:bg-gray-50',
                                              'group flex gap-x-3 rounded-md p-2 text-sm leading-6'
                                            )}
                                            onClick={() => setSidebarOpen(false)}
                                          >
                                            {child.icon && (
                                              <child.icon
                                                className={classNames(
                                                  child.current ? 'text-cvsu-green' : 'text-gray-400 group-hover:text-cvsu-green',
                                                  'h-5 w-5 shrink-0'
                                                )}
                                                aria-hidden="true"
                                              />
                                            )}
                                            {child.name}
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ) : (
                                // Regular menu item
                                <Link
                                  to={item.href}
                                  className={classNames(
                                    item.current
                                      ? 'bg-gray-50 text-cvsu-green'
                                      : 'text-gray-700 hover:text-cvsu-green hover:bg-gray-50',
                                    'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                  )}
                                  onClick={() => setSidebarOpen(false)}
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
                              )}
                              {!item.isDropdown && item.subItems && (
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
                                        onClick={() => setSidebarOpen(false)}
                                      >
                                        {subItem.name}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
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
                  {fullNavigation.map((item) => (
                    <li key={item.name}>
                      {item.isDropdown ? (
                        // Dropdown menu item
                        <div>
                          <button
                            className={classNames(
                              item.current
                                ? 'bg-gray-50 text-cvsu-green'
                                : 'text-gray-700 hover:text-cvsu-green hover:bg-gray-50',
                              'group flex w-full items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                            )}
                            onClick={() => {
                              // Toggle dropdown state - add this function
                              setFullNavigation(nav => 
                                nav.map(navItem => 
                                  navItem.name === item.name 
                                    ? {...navItem, isOpen: !navItem.isOpen} 
                                    : navItem
                                )
                              );
                            }}
                          >
                            <item.icon
                              className={classNames(
                                item.current ? 'text-cvsu-green' : 'text-gray-400 group-hover:text-cvsu-green',
                                'h-6 w-6 shrink-0'
                              )}
                              aria-hidden="true"
                            />
                            {item.name}
                            <svg 
                              className={classNames(
                                item.isOpen ? 'rotate-90' : '',
                                'ml-auto h-5 w-5 flex-none text-gray-400 transition-transform'
                              )}
                              viewBox="0 0 20 20" 
                              fill="currentColor" 
                              aria-hidden="true"
                            >
                              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {/* Dropdown children */}
                          {item.isOpen && item.children && (
                            <ul className="mt-1 pl-8 space-y-1">
                              {item.children.map((child) => (
                                <li key={child.name}>
                                  <Link
                                    to={child.href}
                                    className={classNames(
                                      child.current
                                        ? 'bg-gray-50 text-cvsu-green'
                                        : 'text-gray-700 hover:text-cvsu-green hover:bg-gray-50',
                                      'group flex gap-x-3 rounded-md p-2 text-sm leading-6'
                                    )}
                                  >
                                    {child.icon && (
                                      <child.icon
                                        className={classNames(
                                          child.current ? 'text-cvsu-green' : 'text-gray-400 group-hover:text-cvsu-green',
                                          'h-5 w-5 shrink-0'
                                        )}
                                        aria-hidden="true"
                                      />
                                    )}
                                    {child.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        // Regular menu item
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
                      )}
                      {/* Keep existing subItems support for backward compatibility */}
                      {!item.isDropdown && item.subItems && (
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
                  ))}
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

        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
} 