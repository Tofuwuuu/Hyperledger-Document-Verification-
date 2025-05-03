import axios from 'axios';
import { API_URL } from '../config';

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
    const response = await axios.get(`${API_URL}/events/upcoming?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    throw error;
  }
};

export const getAllEvents = async (activeOnly = false) => {
  try {
    const response = await axios.get(`${API_URL}/events?active_only=${activeOnly}`, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching all events:', error);
    throw error;
  }
};

export const getEventById = async (eventId) => {
  try {
    const response = await axios.get(`${API_URL}/events/${eventId}`, {
      headers: getAuthHeader()
    });
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
    
    console.log('Sending cleaned event data:', JSON.stringify(cleanedData));
    
    // Set proper content type header and increase timeout
    const headers = {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    };
    
    const response = await axios.post(`${API_URL}/events`, cleanedData, {
      headers,
      timeout: 10000 // 10 second timeout
    });
    
    console.log('Event creation successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating event:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received:', error.request);
    }
    throw error;
  }
};

export const updateEvent = async (eventId, eventData) => {
  try {
    const response = await axios.put(`${API_URL}/events/${eventId}`, eventData, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating event with ID ${eventId}:`, error);
    throw error;
  }
};

export const deleteEvent = async (eventId) => {
  try {
    const response = await axios.delete(`${API_URL}/events/${eventId}`, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error(`Error deleting event with ID ${eventId}:`, error);
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
    
    const response = await axios.post(`${API_URL}/registrations`, payload, {
      headers: getAuthHeader()
    });
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
      error.userMessage = 'Failed to connect to the server. Please try again later.';
    }
    
    throw error;
  }
};

export const getUserRegistrations = async () => {
  try {
    console.log('Fetching user registrations...');
    
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    
    const response = await axios.get(`${API_URL}/registrations/user?_=${timestamp}`, {
      headers: {
        ...getAuthHeader(),
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log('User registrations fetched:', response.data);
    
    // Store registrations in localStorage for persistence between page refreshes
    if (response.data && Array.isArray(response.data)) {
      localStorage.setItem('userRegistrations', JSON.stringify(response.data));
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching user registrations:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    // Try to get registrations from localStorage if API call fails
    const cachedRegistrations = localStorage.getItem('userRegistrations');
    if (cachedRegistrations) {
      console.log('Using cached registrations from localStorage');
      try {
        const parsedRegistrations = JSON.parse(cachedRegistrations);
        return parsedRegistrations;
      } catch (parseError) {
        console.error('Error parsing cached registrations:', parseError);
      }
    }
    
    // Return empty array if no cached data or parsing fails
    return [];
  }
};

export const getEventRegistrations = async (eventId) => {
  try {
    console.log(`Making API call to fetch registrations for event ID: ${eventId}`);
    const response = await axios.get(`${API_URL}/registrations/event/${eventId}`, {
      headers: getAuthHeader(),
      timeout: 15000 // Increase timeout to 15 seconds
    });
    
    console.log(`Raw API response for event ${eventId} registrations:`, response);
    
    // Validate the response data
    if (response.data === undefined || response.data === null) {
      console.error('API returned invalid data for registrations:', response.data);
      throw new Error('API returned invalid data');
    }
    
    // Ensure response data is handled correctly based on its structure
    let registrations = Array.isArray(response.data) ? response.data : 
                        (response.data.registrations || response.data.data || []);
    
    console.log(`Retrieved ${registrations.length} registrations for event ${eventId}`);
    return registrations;
  } catch (error) {
    console.error(`Error fetching registrations for event with ID ${eventId}:`, error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Network issue likely.');
    }
    
    // Instead of throwing error, return empty array
    console.warn(`Returning empty array for event ${eventId} registrations due to error`);
    return [];
  }
};

export const getAllEventRegistrations = async () => {
  try {
    console.log("Making API call to fetch all registrations");
    
    // First, verify auth token is valid
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      throw new Error('You must be logged in to access registrations');
    }
    
    const response = await axios.get(`${API_URL}/registrations/all`, {
      headers: getAuthHeader(),
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
    
    // More detailed error logging
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      // If unauthorized (401) or forbidden (403), redirect to login
      if (error.response.status === 401 || error.response.status === 403) {
        console.error('Authentication error - redirecting to login');
        // Clear token and redirect
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        
        // If we're in a browser environment, redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    } else if (error.request) {
      console.error('No response received. Network issue likely.');
      console.error('Request details:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    
    // Throw error to handle in the component
    throw error;
  }
};

export const checkInUser = async (registrationId) => {
  try {
    const response = await axios.post(`${API_URL}/registrations/${registrationId}/check-in`, {}, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error(`Error checking in registration ID ${registrationId}:`, error);
    throw error;
  }
};

export const checkInByQR = async (qrCodeData) => {
  try {
    const response = await axios.post(`${API_URL}/registrations/check-in-by-qr?qr_code_data=${encodeURIComponent(qrCodeData)}`, {}, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Error checking in by QR code:', error);
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
    const response = await axios.get(`${API_URL}/registrations/event/${eventId}/attendees`, {
      headers: getAuthHeader(),
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
    console.error(`Error fetching event attendees for event ${eventId}:`, error);
    
    // More detailed error logging
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      // If unauthorized (401) or forbidden (403), redirect to login
      if (error.response.status === 401 || error.response.status === 403) {
        console.error('Authentication error - redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        
        // If we're in a browser environment, redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    } else if (error.request) {
      console.error('No response received. Network issue likely.');
    }
    
    // Throw error to handle in the component
    throw error;
  }
};

export const generateEventQRCode = async (eventId, type) => {
  try {
    console.log(`Generating QR code for event ID: ${eventId} of type: ${type}`);
    
    // Default to registration type if not specified
    const qrType = type || 'registration';
    
    // Use a timestamp to prevent caching
    const timestamp = new Date().getTime();
    
    // Create the API URL with cache-busting parameter
    const apiUrl = `${API_URL}/events/${eventId}/qrcode?type=${qrType}&_t=${timestamp}`;
    console.log(`Calling QR code API at: ${apiUrl}`);
    
    const response = await axios({
      method: 'get',
      url: apiUrl,
      headers: {
        ...getAuthHeader(),
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 30000, // Increased timeout to 30 seconds
      responseType: 'json'
    });
    
    console.log('QR code API response type:', typeof response.data);
    if (typeof response.data === 'object') {
      console.log('QR code API response keys:', Object.keys(response.data));
    }
    
    // Extract the QR code URL from the response
    let qrCodeUrl;
    
    if (typeof response.data === 'object' && response.data !== null) {
      // Handle object response
      qrCodeUrl = response.data.qr_code_url || response.data.attendance_qr_url;
      
      if (!qrCodeUrl) {
        // Try to find any property that might contain the QR code
        const possibleProps = ['qr_code', 'qrcode', 'qr_code_data', 'image', 'url'];
        for (const prop of possibleProps) {
          if (response.data[prop]) {
            qrCodeUrl = response.data[prop];
            console.log(`Found QR code in '${prop}' property`);
            break;
          }
        }
      }
    } else {
      // Handle string response (might be direct base64 data)
      qrCodeUrl = response.data;
    }
    
    // Validate the QR code URL
    if (!qrCodeUrl) {
      console.error('QR code URL not found in response:', response.data);
      throw new Error('QR code URL not found in response');
    }
    
    // Ensure the QR code URL is in the correct format
    if (typeof qrCodeUrl === 'string' && !qrCodeUrl.startsWith('data:image')) {
      if (qrCodeUrl.match(/^[A-Za-z0-9+/=]+$/)) {
        // Looks like a raw base64 string, convert to data URL
        qrCodeUrl = `data:image/png;base64,${qrCodeUrl}`;
        console.log('Converted raw base64 to data URL');
      }
    }
    
    console.log('QR code URL extracted successfully, type:', typeof qrCodeUrl);
    if (typeof qrCodeUrl === 'string') {
      console.log('QR code URL length:', qrCodeUrl.length);
      console.log('QR code URL prefix:', qrCodeUrl.substring(0, 30) + '...');
    }
    
    // Validate the QR code URL format
    if (typeof qrCodeUrl !== 'string' || !qrCodeUrl.startsWith('data:image')) {
      console.warn('QR code URL does not have expected format:', qrCodeUrl?.substring(0, 50) + '...');
    }
    
    return qrCodeUrl;
  } catch (error) {
    console.error(`Error generating QR code for event ID ${eventId}:`, error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error message:', error.message);
    }
    throw error;
  }
};

export const generateAttendanceQRCode = async (eventId) => {
  try {
    console.log(`Generating attendance QR code for event ID: ${eventId}`);
    return await generateEventQRCode(eventId, 'attendance');
  } catch (error) {
    console.error(`Error generating attendance QR code for event ID ${eventId}:`, error);
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