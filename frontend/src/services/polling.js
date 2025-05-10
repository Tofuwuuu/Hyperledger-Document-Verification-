import { getAuthTokens } from '../utils/authUtils';

class PollingService {
  constructor() {
    this.listeners = new Map();
    this.pollingInterval = null;
    this.lastNotificationId = null;
    this.isPolling = false;
    this.pollFrequency = parseInt(import.meta.env.VITE_POLLING_INTERVAL || '5000', 10); // Default to 5 seconds
    this.role = null;
    
    console.log(`Polling service initialized with frequency: ${this.pollFrequency}ms`);
  }

  startPolling(role = null) {
    if (this.isPolling) {
      console.log('Polling already active');
      return;
    }

    const { accessToken } = getAuthTokens();
    if (!accessToken) {
      console.error('No authentication token found');
      return;
    }
    
    this.role = role;
    console.log(`Starting notification polling service ${role ? `(as ${role})` : ''}`);
    this.isPolling = true;

    // Emit connection established event
    this.emit('connection', { 
      status: 'connected',
      message: 'Connected to polling notification service',
      timestamp: new Date().toISOString()
    });

    // Start polling
    this.pollingInterval = setInterval(() => {
      this.fetchNotifications();
    }, this.pollFrequency);

    // Initial fetch
    this.fetchNotifications();
  }

  async fetchNotifications() {
    try {
      const { accessToken } = getAuthTokens();
      if (!accessToken) {
        console.error('No auth token available for notifications');
        this.stopPolling();
        return;
      }

      // Special handling for admin bypass tokens
      if (accessToken.startsWith('admin_access_token_')) {
        console.log('Using admin bypass token - returning empty notifications array');
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
      console.log(`Fetching notifications from: ${url} ${this.role ? `(as ${this.role})` : ''}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch notifications: ${response.status} ${response.statusText}`);
        // If 401 Unauthorized, stop polling (token expired)
        if (response.status === 401) {
          console.error('Unauthorized access - stopping polling (token may have expired)');
          this.stopPolling();
        }
        return;
      }

      const data = await response.json();
      console.log(`Received notification data:`, data);
      
      // Process new notifications
      if (data.notifications && data.notifications.length > 0) {
        console.log(`Found ${data.notifications.length} new notifications`);
        
        // Sort notifications by creation date (newest first)
        const sortedNotifications = [...data.notifications].sort((a, b) => {
          return new Date(b.created_at) - new Date(a.created_at);
        });
        
        // Update last notification ID for next poll
        if (sortedNotifications[0] && sortedNotifications[0]._id) {
          this.lastNotificationId = sortedNotifications[0]._id;
          console.log(`Updated lastNotificationId to: ${this.lastNotificationId}`);
        }
        
        // Process each notification and emit events
        sortedNotifications.forEach(notification => {
          console.log(`Processing notification: ${notification.type}, ID: ${notification._id}`);
          
          // Convert to format similar to WebSocket messages
          const eventData = {
            type: notification.type,
            message: notification.message,
            notification_id: notification._id,
            timestamp: notification.created_at,
            is_read: notification.is_read,
            data: notification.data || {}
          };
          
          // Emit specific event type
          this.emit(notification.type, eventData);
          
          // Also emit to 'message' listeners for any message
          this.emit('message', eventData);
        });
      } else {
        console.log('No new notifications found');
      }
    } catch (error) {
      console.error('Error polling notifications:', error);
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    this.emit('disconnection', { status: 'disconnected' });
    console.log('Notification polling stopped');
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
    console.log(`Added listener for '${eventType}' events. Total listeners: ${this.listeners.get(eventType).length}`);
    return () => this.off(eventType, callback);
  }

  off(eventType, callback) {
    if (!this.listeners.has(eventType)) return;
    
    const eventListeners = this.listeners.get(eventType);
    const index = eventListeners.indexOf(callback);
    
    if (index !== -1) {
      eventListeners.splice(index, 1);
      console.log(`Removed listener for '${eventType}' events`);
    }
  }

  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      const listenerCount = this.listeners.get(eventType).length;
      console.log(`Emitting '${eventType}' event to ${listenerCount} listeners`);
      
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} listener:`, error);
        }
      });
    }
  }
}

// Create a singleton instance
const pollingService = new PollingService();

export default pollingService; 