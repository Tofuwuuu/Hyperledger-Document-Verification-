import { getAuthTokens } from '../utils/authUtils';

class PollingService {
  constructor() {
    this.listeners = new Map();
    this.pollingInterval = null;
    this.lastNotificationId = null;
    this.isPolling = false;
    this.pollFrequency = parseInt(import.meta.env.VITE_POLLING_INTERVAL || '5000', 10); // Default to 5 seconds
    this.role = null;
    this.endpointDisabled = false;
  }

  startPolling(role = null) {
    if (this.isPolling) {
      return;
    }

    const { accessToken } = getAuthTokens();
    if (!accessToken) {
      return;
    }
    
    this.role = role;
    this.isPolling = true;

    // Emit connection established event
    this.emit('connection', { 
      status: 'connected',
      message: 'Connected to polling notification service',
      timestamp: new Date().toISOString()
    });

    // Start polling
    this.pollingInterval = setInterval(() => {
      if (this.endpointDisabled) {
        return;
      }
      this.fetchNotifications();
    }, this.pollFrequency);

    // Initial fetch
    if (!this.endpointDisabled) {
      this.fetchNotifications();
    }
  }

  disableEndpoint() {
    this.endpointDisabled = true;
    this.stopPolling();
  }

  // Stub implementation to avoid 405 errors
  stubNotifications() {
    // Just emit an empty message event to satisfy listeners
    this.emit('message', {
      type: 'stub',
      message: 'Notification service unavailable',
      notification_id: 'stub_' + Date.now(),
      timestamp: new Date().toISOString(),
      is_read: false,
      data: {}
    });
  }

  async fetchNotifications() {
    try {
      const { accessToken } = getAuthTokens();
      if (!accessToken) {
        this.stopPolling();
        return;
      }

      // Special handling for admin bypass tokens
      if (accessToken.startsWith('admin_access_token_')) {
        // For admin bypass, just emit empty notifications to prevent API calls that would 401
        const mockData = {
          notifications: [],
          count: 0,
          unread_count: 0
        };
        
        // Emit empty message event to satisfy any listeners
        this.emit('message', {
          type: 'admin_bypass',
          message: 'Using admin bypass - notifications simulated',
          notification_id: 'mock_' + Date.now(),
          timestamp: new Date().toISOString(),
          is_read: false,
          data: {}
        });
        
        return;
      }

      // Get base API URL
      let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      // Remove trailing slash if present
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      // Add /api/v1 only if it's not already included
      const apiUrl = baseUrl.includes('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;
      
      // Add a timestamp parameter to prevent caching
      const timestamp = new Date().getTime();
      
      // Query parameter for lastNotificationId if we have one
      const sinceParam = this.lastNotificationId ? 
        `&since_id=${this.lastNotificationId}` : '';
      
      const url = `${apiUrl}/notifications?include_read=false&limit=10${sinceParam}&_t=${timestamp}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        // Disable polling entirely when the endpoint does not exist on the live backend.
        if (response.status === 404 || response.status === 405) {
          this.disableEndpoint();
          return;
        }
        
        // If 401 Unauthorized, stop polling (token expired)
        if (response.status === 401) {
          this.stopPolling();
        }
        return;
      }

      const data = await response.json();
      const notifications = Array.isArray(data) ? data : (data.notifications || []);
      
      // Process new notifications
      if (notifications.length > 0) {
        // Sort notifications by creation date (newest first)
        const sortedNotifications = [...notifications].sort((a, b) => {
          return new Date(b.created_at) - new Date(a.created_at);
        });
        
        // Update last notification ID for next poll
        if (sortedNotifications[0]) {
          this.lastNotificationId = sortedNotifications[0]._id || sortedNotifications[0].id;
        }
        
        // Process each notification and emit events
        sortedNotifications.forEach(notification => {
          // Convert to format similar to WebSocket messages
          const eventData = {
            type: notification.type || 'notification',
            message: notification.message || notification.body || notification.title || 'New notification',
            notification_id: notification._id || notification.id,
            timestamp: notification.created_at,
            is_read: Boolean(notification.is_read ?? notification.read),
            data: notification.data || {}
          };
          
          // Emit specific event type
          this.emit(notification.type, eventData);
          
          // Also emit to 'message' listeners for any message
          this.emit('message', eventData);
        });
      }
    } catch (error) {
      // Silent error handling
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    this.emit('disconnection', { status: 'disconnected' });
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
    return () => this.off(eventType, callback);
  }

  off(eventType, callback) {
    if (!this.listeners.has(eventType)) return;
    
    const eventListeners = this.listeners.get(eventType);
    const index = eventListeners.indexOf(callback);
    
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }
  }

  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      const listenerCount = this.listeners.get(eventType).length;
      
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          // Silent error handling
        }
      });
    }
  }
}

// Create a singleton instance
const pollingService = new PollingService();

export default pollingService; 

// Let's implement a safer version of fetching notifications with smaller limit
const fetchRecentNotifications = async (sinceId = null) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return {
        notifications: [],
        unread_count: 0,
        error: null
      };
    }
    
    // Get the API URL with a fallback
    let baseUrl = localStorage.getItem('api_url') || import.meta.env.VITE_API_URL || 'http://localhost:8000';
    
    // Clean the URL
    baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const apiUrl = baseUrl.includes('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;
    
    // Add a timestamp to prevent caching and limit results to just 3 newest
    const timestamp = new Date().getTime();
    let url = `${apiUrl}/notifications?include_read=false&limit=3&_t=${timestamp}`;
    
    // If we have a sinceId, only get notifications newer than that
    if (sinceId) {
      url += `&since_id=${sinceId}`;
    }
    
    // Set a 5-second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 401) {
        // Auth error - token expired
        return {
          notifications: [],
          unread_count: 0,
          error: 'auth'
        };
      }
      
      // If method not allowed, return stub data
      if (response.status === 405) {
        return {
          notifications: [],
          unread_count: 0,
          error: null
        };
      }
      
      return {
        notifications: [],
        unread_count: 0,
        error: response.status
      };
    }
    
    // Parse the response
    const data = await response.json();
    
    return {
      notifications: data.notifications || [],
      unread_count: data.unread_count || 0,
      error: null
    };
  } catch (error) {
    // Return empty results on error
    return {
      notifications: [],
      unread_count: 0,
      error: error.name === 'AbortError' ? 'timeout' : 'network'
    };
  }
};

export { fetchRecentNotifications }; 
