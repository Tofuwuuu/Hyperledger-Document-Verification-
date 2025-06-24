import api from './api';
import meetingConfig from './meetingConfig';

// Meeting services for Jitsi integration
const meetingService = {
  // Create a new meeting
  createMeeting: async (meetingData) => {
    return api.post('/meetings/meetings', meetingData);
  },
  
  // Get a meeting by ID
  getMeeting: async (meetingId) => {
    return api.get(`/meetings/meetings/${meetingId}`);
  },
  
  // Update meeting details
  updateMeeting: async (meetingId, updateData) => {
    return api.put(`/meetings/meetings/${meetingId}`, updateData);
  },
  
  // Get all meetings for an event
  getEventMeetings: async (eventId) => {
    return api.get(`/meetings/events/${eventId}/meetings`);
  },
  
  // Generate JWT token for meeting
  generateToken: async (tokenData) => {
    return api.post('/meetings/meetings/generate-token', tokenData);
  },
  
  // Record joining a meeting
  joinMeeting: async (meetingId) => {
    return api.post(`/meetings/meetings/${meetingId}/join`);
  },
  
  // Record leaving a meeting
  leaveMeeting: async (meetingId) => {
    return api.post(`/meetings/meetings/${meetingId}/leave`);
  },
  
  // Start recording a meeting
  startRecording: async (meetingId) => {
    try {
      const response = await api.post(`/meetings/meetings/${meetingId}/recording/start`);
      return response.data;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  },
  
  // Stop recording a meeting
  stopRecording: async (meetingId) => {
    try {
      const response = await api.post(`/meetings/meetings/${meetingId}/recording/stop`);
      return response.data;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  },
  
  // Get recording status
  getRecordingStatus: async (meetingId) => {
    try {
      const response = await api.get(`/meetings/meetings/${meetingId}/recording`);
      return response.data;
    } catch (error) {
      console.error('Failed to get recording status:', error);
      throw error;
    }
  },
  
  // Poll recording status at regular intervals
  pollRecordingStatus: (meetingId, callback, intervalMs = 5000) => {
    const intervalId = setInterval(async () => {
      try {
        const status = await meetingService.getRecordingStatus(meetingId);
        callback(status);
        
        // If recording completed or failed, stop polling
        if (status.recording_status === 'completed' || status.recording_status === 'failed') {
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Error polling recording status:', error);
        callback({ success: false, error: error.message });
      }
    }, intervalMs);
    
    // Return the interval ID for cleanup
    return intervalId;
  },
  
  // Format meeting date for display
  formatMeetingDate: (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  // Get meeting status display text
  getMeetingStatusText: (status) => {
    const statusMap = {
      scheduled: 'Scheduled',
      active: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    
    return statusMap[status] || 'Unknown';
  },
  
  // Check if a meeting is happening now or in the near future (15 min window)
  isMeetingActive: (meeting) => {
    if (!meeting) return false;
    
    const now = new Date();
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(startTime.getTime() + (meeting.duration * 60 * 1000));
    
    // Meeting is active if current time is between start and end
    // OR start time is within the next 15 minutes
    const fifteenMinFromNow = new Date(now.getTime() + (15 * 60 * 1000));
    
    return (
      (now >= startTime && now <= endTime) || 
      (startTime > now && startTime <= fifteenMinFromNow)
    );
  },
  
  // Generate a meeting URL for direct access (fallback)
  generateDirectUrl: (roomName) => {
    return meetingConfig.generateDirectUrl(roomName);
  },
  
  // Get recording status text
  getRecordingStatusText: (status) => {
    const statusMap = {
      not_started: 'Not Started',
      in_progress: 'Recording...',
      completed: 'Completed',
      failed: 'Failed'
    };
    
    return statusMap[status] || 'Unknown';
  }
};

export default meetingService; 