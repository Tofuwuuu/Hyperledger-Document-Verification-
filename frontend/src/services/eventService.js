import axios from 'axios';
import { API_URL } from '../config';
import api from './api';

const getToken = () => {
  return localStorage.getItem('token');
};

const getAuthHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Event-related API calls
export const getUpcomingEvents = async (limit = 5) => {
  try {
    // This is a public endpoint, so we can use direct axios call
    const response = await axios.get(`${API_URL}/events/upcoming?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    throw error;
  }
};

export const getAllEvents = async (activeOnly = false) => {
  try {
    // Use api instance to include admin headers
    const response = await api.get(`/events?active_only=${activeOnly}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching all events:', error);
    throw error;
  }
};

export const getEventById = async (eventId) => {
  try {
    // Use api instance to include admin headers
    const response = await api.get(`/events/${eventId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching event with ID ${eventId}:`, error);
    throw error;
  }
};

export const createEvent = async (eventData) => {
  try {
    console.log('Creating event with data:', JSON.stringify(eventData));
    
    // Make sure all date fields are properly formatted
    const cleanedData = {
      ...eventData,
      // Ensure dates are proper ISO strings
      start_date: eventData.start_date || null,
      end_date: eventData.end_date || null,
      registration_deadline: eventData.registration_deadline || null,
      // Convert empty strings to null
      image_url: eventData.image_url || null,
      registration_url: eventData.registration_url || null,
      // Ensure numbers are properly typed
      max_attendees: eventData.max_attendees === '' ? null : 
                     (typeof eventData.max_attendees === 'number' ? 
                      eventData.max_attendees : Number(eventData.max_attendees))
    };
    
    console.log('Fetching CSRF token for event creation');
    
    // First, explicitly fetch a CSRF token and ensure it's stored - with retry mechanism
    let csrfToken = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!csrfToken && retryCount < maxRetries) {
      try {
        const tokenResponse = await axios.get(`${API_URL}/auth/csrf-token`, { 
          withCredentials: true,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (tokenResponse.data && tokenResponse.data.csrf_token) {
          csrfToken = tokenResponse.data.csrf_token;
          localStorage.setItem('csrf_token', csrfToken);
          console.log('CSRF token obtained');
        } else {
          console.warn('CSRF token response missing token data');
          retryCount++;
          await new Promise(r => setTimeout(r, 1000)); // 1 second delay before retry
        }
      } catch (csrfError) {
        console.warn(`Error obtaining CSRF token (attempt ${retryCount + 1}/${maxRetries}):`, csrfError);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(r => setTimeout(r, 1000)); // 1 second delay before retry
        }
      }
    }
    
    if (!csrfToken) {
      console.warn('Failed to obtain CSRF token after multiple attempts, will try without it');
    }
    
    console.log('Sending cleaned event data:', JSON.stringify(cleanedData));
    
    // Create custom axios instance for this specific request
    const axiosInstance = axios.create({
      baseURL: API_URL,
      timeout: 15000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    // Add auth token
    const token = localStorage.getItem('token');
    if (token) {
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    // Add CSRF token if available
    if (csrfToken) {
      axiosInstance.defaults.headers.common['X-CSRF-Token'] = csrfToken;
      console.log('Added CSRF token to request');
    }

    // Making the request directly with axios instead of using the api service
    const response = await axiosInstance.post('/events', cleanedData);
    
    console.log('Event creation successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating event:', error.message || error);
    if (error.response) {
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      console.error('Response headers:', error.response?.headers);
      
      // Additional debug info
      if (error.response?.status === 403) {
        console.error('CSRF token being used:', localStorage.getItem('csrf_token'));
        console.error('Auth token present:', !!localStorage.getItem('token'));
        
        // Check for specific error message patterns
        const errorDetail = error.response?.data?.detail || '';
        if (errorDetail.includes('CSRF')) {
          console.error('CSRF validation failed. The server rejected the CSRF token.');
        } else if (errorDetail.includes('auth') || errorDetail.includes('token')) {
          console.error('Authentication issue detected. Try logging out and back in.');
        } else {
          console.error('Forbidden error but no specific reason identified:', errorDetail);
        }
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
    }
    throw error;
  }
};

export const updateEvent = async (eventId, eventData) => {
  try {
    console.log(`Updating event ${eventId} with data:`, JSON.stringify(eventData));
    
    // First, explicitly fetch a CSRF token and ensure it's stored
    try {
      const tokenResponse = await api.get('/auth/csrf-token', { 
        withCredentials: true 
      });
      
      if (tokenResponse.data && tokenResponse.data.csrf_token) {
        localStorage.setItem('csrf_token', tokenResponse.data.csrf_token);
        console.log('CSRF token obtained and stored:', tokenResponse.data.csrf_token);
      }
    } catch (csrfError) {
      console.warn('Error obtaining initial CSRF token:', csrfError);
      // Continue anyway, the withCORS method will retry
    }
    
    // Import apiService from the current file's context
    const { apiService } = await import('./api');
    
    // Use the withCORS method which has built-in CSRF handling and retries
    const response = await apiService.withCORS('put', `/events/${eventId}`, eventData, {
      timeout: 15000 // Increase timeout to 15 seconds
    });
    
    console.log('Event update successful:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Error updating event with ID ${eventId}:`, error);
    if (error.response) {
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      
      // If it's a CSRF error, provide a more helpful error message
      if (error.response?.status === 403 && 
          error.response?.data?.detail?.includes('CSRF token')) {
        error.userMessage = 'CSRF validation failed. Please try refreshing the page and submitting again.';
      }
    }
    throw error;
  }
};

export const deleteEvent = async (eventId) => {
  try {
    console.log(`Deleting event ${eventId}`);
    
    // First, explicitly fetch a CSRF token and ensure it's stored
    try {
      const tokenResponse = await api.get('/auth/csrf-token', { 
        withCredentials: true 
      });
      
      if (tokenResponse.data && tokenResponse.data.csrf_token) {
        localStorage.setItem('csrf_token', tokenResponse.data.csrf_token);
        console.log('CSRF token obtained and stored:', tokenResponse.data.csrf_token);
      }
    } catch (csrfError) {
      console.warn('Error obtaining initial CSRF token:', csrfError);
      // Continue anyway, the withCORS method will retry
    }
    
    // Import apiService from the current file's context
    const { apiService } = await import('./api');
    
    // Use the withCORS method which has built-in CSRF handling and retries
    const response = await apiService.withCORS('delete', `/events/${eventId}`, null, {
      timeout: 15000 // Increase timeout to 15 seconds
    });
    
    console.log('Event deletion successful');
    return response.data;
  } catch (error) {
    console.error(`Error deleting event with ID ${eventId}:`, error);
    if (error.response) {
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      
      // If it's a CSRF error, provide a more helpful error message
      if (error.response?.status === 403 && 
          error.response?.data?.detail?.includes('CSRF token')) {
        error.userMessage = 'CSRF validation failed. Please try refreshing the page and submitting again.';
      }
    }
    throw error;
  }
};

// Registration-related API calls
export const registerForEvent = async (eventId) => {
  try {
    console.log(`Registering for event with ID ${eventId}`);
    // Get the current user ID from localStorage
    const token = localStorage.getItem('token');
    let userId = null;
    
    if (token) {
      try {
        // Extract user ID from token payload
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        userId = payload.sub; // 'sub' field contains the user ID
      } catch (e) {
        console.error('Error extracting user ID from token:', e);
      }
    }
    
    const payload = { 
      event_id: eventId,
      user_id: userId // Include user_id explicitly
    };
    console.log('Request payload:', JSON.stringify(payload));
    
    // Use api instance to include admin headers
    const response = await api.post(`/registrations`, payload);
    console.log('Registration successful:', response.data);
    
    // Add the new registration to localStorage cache
    if (response.data) {
      try {
        // Get existing registrations from localStorage
        const cachedRegistrationsStr = localStorage.getItem('userRegistrations');
        const cachedRegistrations = cachedRegistrationsStr ? JSON.parse(cachedRegistrationsStr) : [];
        
        // Add new registration to cache
        cachedRegistrations.push(response.data);
        
        // Update localStorage
        localStorage.setItem('userRegistrations', JSON.stringify(cachedRegistrations));
        console.log('Updated localStorage with new registration');
      } catch (e) {
        console.error('Error updating registration cache:', e);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error registering for event with ID ${eventId}:`, error);
    
    // Log more detailed error information
    if (error.response) {
      console.error('Server error response:', error.response.status);
      console.error('Error details:', error.response.data);
      
      // For validation errors, log the specific validation messages
      if (error.response.data && error.response.data.detail) {
        if (Array.isArray(error.response.data.detail)) {
          console.error('Validation errors:');
          error.response.data.detail.forEach((err, index) => {
            console.error(`Error ${index + 1}:`, err);
          });
        } else {
          console.error('Error detail:', error.response.data.detail);
        }
      }
      
      // Extract the detailed error message to show to the user
      let errorDetail = 'An unknown error occurred';
      if (error.response.data.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorDetail = error.response.data.detail[0]?.msg || error.response.data.detail[0] || 'Validation error';
        } else {
          errorDetail = error.response.data.detail;
        }
      }
      error.userMessage = errorDetail;
    } else {
      error.userMessage = 'Unable to connect to the server. Please try again later.';
    }
    
    throw error;
  }
};

export const getUserRegistrations = async () => {
  try {
    console.log('Fetching user registrations');
    
    // Use api instance to include admin headers
    const response = await api.get(`/registrations/user`);
    console.log(`Received ${response.data.length} registrations from API`);
    
    // Cache registrations in localStorage for offline access
    localStorage.setItem('userRegistrations', JSON.stringify(response.data));
    localStorage.setItem('userRegistrationsLastUpdated', new Date().toISOString());
    
    return response.data;
  } catch (error) {
    console.error('Error fetching user registrations:', error);
    
    // Try to use cached data if available
    try {
      const cachedData = localStorage.getItem('userRegistrations');
      if (cachedData) {
        console.log('Using cached registration data');
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error('Error reading cached registrations:', cacheError);
    }
    
    throw error;
  }
};

export const getEventRegistrations = async (eventId) => {
  try {
    console.log(`Fetching registrations for event ${eventId}`);
    
    // Use api instance to include admin headers
    const response = await api.get(`/registrations/event/${eventId}`);
    console.log(`Received ${response.data.length} registrations for event ${eventId}`);
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching registrations for event ${eventId}:`, error);
    throw error;
  }
};

export const getAllEventRegistrations = async () => {
  try {
    console.log("Making API call to fetch all registrations");
    
    // Use api instance to include admin headers
    const response = await api.get(`/registrations/all`, {
      timeout: 15000 // Increase timeout to 15 seconds
    });
    
    console.log("Received API response for all registrations");
    
    // Validate the response data
    if (response.data === undefined || response.data === null) {
      console.error('API returned invalid data for registrations:', response.data);
      throw new Error('API returned invalid data');
    }
    
    // Ensure response data is handled correctly based on its structure
    let registrations = Array.isArray(response.data) ? response.data : 
                       (response.data.registrations || response.data.data || []);
    
    // Log number of registrations
    console.log(`Retrieved ${registrations.length} registrations from API`);
    
    // Add default status if missing to ensure stats are calculated properly
    registrations = registrations.map(reg => {
      if (!reg.status) {
        console.warn(`Registration ${reg._id || reg.id} missing status, defaulting to 'registered'`);
        return { ...reg, status: 'registered' };
      }
      return reg;
    });
    
    return registrations;
  } catch (error) {
    console.error('Error fetching all event registrations:', error);
    throw error;
  }
};

export const checkInUser = async (registrationId) => {
  try {
    // Use api instance to include admin headers
    const response = await api.post(`/registrations/${registrationId}/check-in`);
    return response.data;
  } catch (error) {
    console.error(`Error checking in user with registration ID ${registrationId}:`, error);
    throw error;
  }
};

export const checkInByQR = async (qrCodeData) => {
  try {
    // Use api instance to include admin headers
    const response = await api.post(`/registrations/check-in-qr`, { qr_data: qrCodeData });
    return response.data;
  } catch (error) {
    console.error(`Error checking in user with QR code:`, error);
    throw error;
  }
};

/**
 * Cancels a user's registration for an event
 * @param {string} registrationId - The ID of the registration to cancel
 * @returns {Promise<Object>} - The cancellation result data
 */
export const cancelRegistration = async (registrationId) => {
  try {
    const response = await axios.delete(`${API_URL}/registrations/${registrationId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      timeout: 10000
    });
    
    console.log('Registration cancelled successfully:', response.data);
    
    // Remove the cancelled registration from localStorage cache
    try {
      const cachedRegistrationsStr = localStorage.getItem('userRegistrations');
      if (cachedRegistrationsStr) {
        const cachedRegistrations = JSON.parse(cachedRegistrationsStr);
        
        // Filter out the cancelled registration
        const updatedRegistrations = cachedRegistrations.filter(reg => {
          // Registration ID could be stored in different formats
          const regId = reg._id || reg.id;
          return String(regId) !== String(registrationId);
        });
        
        // Update localStorage
        localStorage.setItem('userRegistrations', JSON.stringify(updatedRegistrations));
        console.log('Updated localStorage after cancellation');
      }
    } catch (e) {
      console.error('Error updating registration cache after cancellation:', e);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error cancelling registration:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
};

export const checkUserEventRegistration = async (eventId) => {
  try {
    console.log(`Checking registration for event ID: ${eventId}`);
    
    // Get all user registrations
    const registrations = await getUserRegistrations();
    console.log(`Received ${registrations.length} user registrations to check against`);
    
    // Normalize the event ID we're checking for
    const eventIdToMatch = typeof eventId === 'object' ? 
      (eventId._id || eventId.id) : 
      String(eventId);
      
    console.log(`Normalized event ID to match: ${eventIdToMatch}`);
    
    // Check if the user is registered for this event
    const matchingRegistration = registrations.find(reg => {
      // Extract and normalize the event ID from the registration
      let regEventId;
      
      if (typeof reg.event_id === 'object') {
        regEventId = reg.event_id._id || reg.event_id.id;
      } else if (reg.event && typeof reg.event === 'object') {
        // Some APIs return the event nested under 'event' property
        regEventId = reg.event._id || reg.event.id;
      } else {
        regEventId = reg.event_id;
      }
      
      // Ensure both IDs are strings for comparison
      regEventId = String(regEventId);
      
      console.log(`Comparing registration event ID: ${regEventId} with target ID: ${eventIdToMatch}`);
      
      return regEventId === eventIdToMatch;
    });
    
    console.log(`Registration match found: ${!!matchingRegistration}`);
    if (matchingRegistration) {
      console.log('Matching registration:', JSON.stringify(matchingRegistration));
    }
    
    return matchingRegistration || null;
  } catch (error) {
    console.error(`Error checking registration for event ${eventId}:`, error);
    
    // Try to get registrations from localStorage directly as a last resort
    try {
      console.log('Attempting to use localStorage directly for checking registration');
      const cachedRegistrationsStr = localStorage.getItem('userRegistrations');
      if (cachedRegistrationsStr) {
        const cachedRegistrations = JSON.parse(cachedRegistrationsStr);
        
        // Normalize the event ID we're checking for
        const eventIdToMatch = typeof eventId === 'object' ? 
          (eventId._id || eventId.id) : 
          String(eventId);
        
        // Find matching registration
        const matchingRegistration = cachedRegistrations.find(reg => {
          let regEventId;
          
          if (typeof reg.event_id === 'object') {
            regEventId = reg.event_id._id || reg.event_id.id;
          } else if (reg.event && typeof reg.event === 'object') {
            regEventId = reg.event._id || reg.event.id;
          } else {
            regEventId = reg.event_id;
          }
          
          regEventId = String(regEventId);
          return regEventId === eventIdToMatch;
        });
        
        console.log(`Registration match found in localStorage: ${!!matchingRegistration}`);
        return matchingRegistration || null;
      }
    } catch (localStorageError) {
      console.error('Error accessing localStorage for registration check:', localStorageError);
    }
    
    // Don't throw the error, just return null to indicate not registered
    return null;
  }
};

/**
 * Updates the status of a registration
 * @param {string} registrationId - The ID of the registration to update
 * @param {string} newStatus - The new status (registered, attended, cancelled, etc.)
 * @returns {Promise<Object>} - The updated registration data
 */
export const updateRegistrationStatus = async (registrationId, newStatus) => {
  try {
    const response = await axios.put(`${API_URL}/registrations/${registrationId}`, {
      status: newStatus
    }, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating registration status for ID ${registrationId}:`, error);
    throw error;
  }
};

export const getEventAttendees = async (eventId) => {
  try {
    console.log(`Fetching detailed attendees for event: ${eventId}`);
    
    // Use api instance to include admin headers
    const response = await api.get(`/registrations/event/${eventId}/attendees`, {
      timeout: 15000 // 15 second timeout
    });
    
    console.log('Event attendees data received:', response.data);
    
    // Validate the response data
    if (!response.data || !response.data.attendees) {
      console.error('API returned invalid data for event attendees:', response.data);
      throw new Error('API returned invalid attendee data');
    }
    
    // Process any date fields for display
    if (Array.isArray(response.data.attendees)) {
      response.data.attendees = response.data.attendees.map(attendee => {
        // Format dates if they exist
        if (attendee.registration_date && !attendee.registration_date_formatted) {
          try {
            attendee.registration_date_formatted = new Date(attendee.registration_date)
              .toLocaleString('en-US', {
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
          } catch (e) {
            console.warn('Error formatting registration date:', e);
          }
        }
        
        if (attendee.check_in_time && !attendee.check_in_time_formatted) {
          try {
            attendee.check_in_time_formatted = new Date(attendee.check_in_time)
              .toLocaleString('en-US', {
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
          } catch (e) {
            console.warn('Error formatting check-in time:', e);
          }
        }
        
        return attendee;
      });
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching attendees for event ${eventId}:`, error);
    throw error;
  }
};

export const generateEventQRCode = async (eventId, type) => {
  try {
    console.log(`Generating QR code for event: ${eventId}, type: ${type}`);
    
    // Use api instance to include admin headers
    const response = await api.get(`/events/${eventId}/qrcode?type=${type}`);
    
    if (!response.data || !response.data.qr_code_url) {
      console.error('API returned invalid QR code data:', response.data);
      throw new Error('Failed to generate QR code');
    }
    
    return response.data.qr_code_url;
  } catch (error) {
    console.error(`Error generating QR code for event ${eventId}:`, error);
    throw error;
  }
};

export const generateAttendanceQRCode = async (eventId) => {
  try {
    // Use api instance to include admin headers
    const response = await api.get(`/events/${eventId}/attendance-qrcode`);
    
    if (!response.data || !response.data.qr_code_url) {
      throw new Error('Failed to generate attendance QR code');
    }
    
    return response.data.qr_code_url;
  } catch (error) {
    console.error(`Error generating attendance QR code for event ${eventId}:`, error);
    throw error;
  }
};

export const handleQuickRegistration = async (eventId, token) => {
  try {
    console.log(`Quick registering for event ID: ${eventId} with token ${token}`);
    const response = await axios.post(
      `${API_URL}/registrations/quick-register/${eventId}/${token}`, 
      {}, // Empty body
      {
        headers: getAuthHeader(),
        timeout: 10000
      }
    );
    
    console.log('Quick registration successful:', response.data);
    
    // Add the new registration to localStorage cache
    if (response.data) {
      try {
        // Get existing registrations from localStorage
        const cachedRegistrationsStr = localStorage.getItem('userRegistrations');
        const cachedRegistrations = cachedRegistrationsStr ? JSON.parse(cachedRegistrationsStr) : [];
        
        // Add new registration to cache
        cachedRegistrations.push(response.data);
        
        // Update localStorage
        localStorage.setItem('userRegistrations', JSON.stringify(cachedRegistrations));
        console.log('Updated localStorage with new registration from QR code');
      } catch (e) {
        console.error('Error updating registration cache:', e);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error quick registering for event ID ${eventId}:`, error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    throw error;
  }
};

export const handleQuickAttendance = async (attendanceToken) => {
  try {
    console.log(`Quick marking attendance with token: ${attendanceToken}`);
    const response = await axios.post(
      `${API_URL}/registrations/quick-attend/${attendanceToken}`, 
      {}, // Empty body
      {
        timeout: 10000
      }
      // No auth header needed for quick attendance
    );
    
    console.log('Quick attendance marking successful:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Error marking attendance with token ${attendanceToken}:`, error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    throw error;
  }
}; 