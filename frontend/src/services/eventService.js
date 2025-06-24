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
export const getUpcomingEvents = async () => {
  try {
    const response = await api.get('/events/upcoming');
    return response.data;
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    throw error;
  }
};

export const getAllEvents = async (activeOnly = true) => {
  try {
    const response = await api.get(`/events?active_only=${activeOnly}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

export const getEventById = async (eventId) => {
  try {
    const response = await api.get(`/events/${eventId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching event ${eventId}:`, error);
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
    
    // Use the api instance instead of direct axios call for consistency
    const response = await api.post('/events', cleanedData, {
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
    const response = await api.put(`/events/${eventId}`, eventData);
    return response.data;
  } catch (error) {
    console.error(`Error updating event with ID ${eventId}:`, error);
    throw error;
  }
};

export const deleteEvent = async (eventId) => {
  try {
    const response = await api.delete(`/events/${eventId}`);
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
    
    // Simplified payload - the backend will extract user_id from the auth token
    const payload = { event_id: eventId };
    console.log('Request payload:', JSON.stringify(payload));
    
    const response = await api.post('/registrations', payload);
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
    
    // Check if user is logged in first
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('User is not authenticated, returning empty registrations array');
      return [];
    }
    
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
    
    // Validate response data is an array
    const registrationsData = Array.isArray(response.data) ? response.data : [];
    
    // Store registrations in localStorage for persistence between page refreshes
    if (registrationsData.length > 0) {
      localStorage.setItem('userRegistrations', JSON.stringify(registrationsData));
      console.log(`Stored ${registrationsData.length} registrations in localStorage`);
    }
    
    return registrationsData;
  } catch (error) {
    console.error('Error fetching user registrations:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      // If unauthorized (401) or forbidden (403), clear localStorage
      if (error.response.status === 401 || error.response.status === 403) {
        console.warn('Authentication error, clearing cached registrations');
        localStorage.removeItem('userRegistrations');
        return [];
      }
    }
    
    // Try to get registrations from localStorage if API call fails
    const cachedRegistrations = localStorage.getItem('userRegistrations');
    if (cachedRegistrations) {
      console.log('Using cached registrations from localStorage');
      try {
        const parsedRegistrations = JSON.parse(cachedRegistrations);
        return Array.isArray(parsedRegistrations) ? parsedRegistrations : [];
      } catch (parseError) {
        console.error('Error parsing cached registrations:', parseError);
        localStorage.removeItem('userRegistrations');
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
    
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('User is not authenticated, skipping registration check');
      return null;
    }
    
    // Get all user registrations
    const registrations = await getUserRegistrations();
    console.log(`Received ${registrations.length} user registrations to check against`);
    
    if (registrations.length === 0) {
      console.log('No registrations found, user is not registered for this event');
      return null;
    }
    
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

// Consolidated QR code generation function
export const generateEventQRCode = async (eventId, type = 'registration') => {
  try {
    console.log(`Generating ${type} QR code for event: ${eventId}`);
    
    // Use API instance for consistency and proper auth handling
    const response = await api.get(`/events/${eventId}/qrcode?type=${type}`);
    
    // Check for response data structure and handle accordingly
    if (response.data && response.data.qr_code_url) {
      return response.data.qr_code_url;
    } else {
      console.error('Invalid QR code response format:', response.data);
      throw new Error('Invalid QR code response format');
    }
  } catch (error) {
    console.error(`Error generating ${type} QR code:`, error);
    throw error;
  }
};

// For backward compatibility, keep this function, but implement it using the consolidated function
export const generateAttendanceQRCode = async (eventId) => {
  // Simply delegate to the main function with the appropriate type
  return generateEventQRCode(eventId, 'attendance');
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
    
    // Make sure token is properly encoded in the URL
    const encodedToken = encodeURIComponent(attendanceToken);
    console.log(`Encoded token for URL: ${encodedToken}`);
    
    // Try different approaches to update attendance
    let response = null;
    let success = false;
    
    // Direct approach - use the correct endpoint: /quick-attend/{token}
    try {
      console.log('Attempting direct quick-attend API call...');
      response = await axios.post(
        `${API_URL}/quick-attend/${encodedToken}`, 
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 20000 // 20 second timeout
        }
      );
      
      console.log('Quick attendance marking successful:', response.data);
      success = true;
      
    } catch (firstError) {
      console.error(`First attempt failed with token ${encodedToken}:`, firstError);
      
      // Try direct method endpoint
      try {
        console.log('Trying direct method endpoint...');
        const directData = {
          event_id: attendanceToken.split('/')[0],
          token: attendanceToken.split('/')[1]
        };
        
        response = await axios.post(
          `${API_URL}/quick-attend/direct`,
          directData,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 20000
          }
        );
        
        console.log('Direct method successful:', response.data);
        success = true;
      } catch (directError) {
        console.error('Direct method failed:', directError);
      }
    }
    
    // If all API approaches failed, create a local record
    if (!success) {
      console.log('All API approaches failed, simulating attendance');
      response = {
        data: {
          success: true,
          message: "Attendance recorded successfully (local record)!",
          event_title: "Event",
          event_date: new Date().toISOString(),
          event_location: "Campus",
          timestamp: new Date().toISOString(),
          local_only: true
        }
      };
      
      // Save record to localStorage for later sync
      try {
        const storedRecords = localStorage.getItem('attendance_records') || '[]';
        const records = JSON.parse(storedRecords);
        
        records.push({
          token: attendanceToken,
          timestamp: new Date().toISOString(),
          retry_count: 0
        });
        
        localStorage.setItem('attendance_records', JSON.stringify(records));
        console.log('Saved attendance record to localStorage for later sync');
      } catch (storageErr) {
        console.error('Failed to save to localStorage:', storageErr);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error marking attendance with token ${attendanceToken}:`, error);
    throw error;
  }
}; 