import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import pollingService from '../../services/polling';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        // Parse the API URL
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        
        const response = await fetch(`${baseUrl}/api/v1/notifications?include_read=true`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }
        
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    // Start polling for notifications
    pollingService.startPolling();
    
    // Listen for new notifications
    const unsubscribe = pollingService.on('message', (data) => {
      console.log("Notification page received notification:", data);
      setNotifications(prev => [data, ...prev]);
      if (!data.is_read) {
        setUnreadCount(prev => prev + 1);
      }
    });
    
    fetchNotifications();
    
    return () => {
      unsubscribe();
      pollingService.stopPolling();
    };
  }, []);

  const handleMarkAsRead = async (notificationId) => {
    try {
      // Parse the API URL
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${baseUrl}/api/v1/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification._id === notificationId 
            ? { ...notification, is_read: true } 
            : notification
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Parse the API URL
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${baseUrl}/api/v1/notifications/read-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      // Parse the API URL to avoid path duplication
      let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      // Remove trailing slash if present
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      const response = await fetch(`${baseUrl}/api/v1/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      
      // Update local state
      setNotifications(prev => 
        prev.filter(notification => notification._id !== notificationId)
      );
      
      // Update unread count if necessary
      const deletedNotification = notifications.find(n => n._id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="animate-pulse text-gray-500">Loading notifications...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md">
        <p>Error: {error}</p>
        <p>Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadCount > 0 
              ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.` 
              : 'No unread notifications.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-cvsu-green/90"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="mt-8">
        {(notifications?.length ?? 0) === 0 ? (
          <div className="text-center py-12 bg-white shadow rounded-lg">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No notifications</h3>
            <p className="mt-1 text-sm text-gray-500">You don't have any notifications yet.</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <li 
                  key={notification._id}
                  className={`${!notification.is_read ? 'bg-gray-50' : ''}`}
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${notification.is_read ? 'bg-gray-300' : 'bg-cvsu-green'}`}></div>
                        <p className="ml-2 text-sm font-medium text-cvsu-green truncate">
                          {notification.type}
                        </p>
                      </div>
                      <div className="ml-2 flex-shrink-0 flex">
                        {!notification.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notification._id)}
                            className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-cvsu-green hover:bg-gray-100"
                          >
                            Mark as read
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNotification(notification._id)}
                          className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-800">
                          {notification.message}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <p>
                          {notification.created_at ? format(new Date(notification.created_at), 'PPp') : 'Unknown date'}
                        </p>
                      </div>
                    </div>
                    {notification.document_id && (
                      <div className="mt-2">
                        <a 
                          href={`/dashboard/documents/${notification.document_id}`}
                          className="text-sm text-cvsu-green hover:underline"
                        >
                          View related document
                        </a>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
} 