import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import meetingService from '../services/meetingService';

const MeetingList = ({ eventId, onJoinMeeting, isAdmin }) => {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setIsLoading(true);
        const response = await meetingService.getEventMeetings(eventId);
        setMeetings(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch meetings:', err);
        setError('Failed to load meetings. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    if (eventId) {
      fetchMeetings();
    }
  }, [eventId]);

  const handleJoinClick = (meeting) => {
    if (onJoinMeeting) {
      onJoinMeeting(meeting);
    }
  };

  const renderMeetingTime = (meeting) => {
    return meetingService.formatMeetingDate(meeting.start_time);
  };

  const renderMeetingStatus = (meeting) => {
    const statusClasses = {
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    const statusClass = statusClasses[meeting.status] || 'bg-gray-100 text-gray-800';

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass}`}>
        {meetingService.getMeetingStatusText(meeting.status)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-6">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {error}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg text-center">
        <p className="text-gray-600">No virtual meetings scheduled for this event yet.</p>
        {isAdmin && (
          <p className="text-sm text-gray-500 mt-2">
            Use the scheduler above to create a virtual meeting.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => (
        <div 
          key={meeting._id} 
          className="bg-white shadow-sm rounded-lg p-4 border border-gray-200"
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-lg font-medium">{meeting.title}</h4>
              <p className="text-sm text-gray-600 mt-1">
                {renderMeetingTime(meeting)}
              </p>
              {meeting.description && (
                <p className="text-sm text-gray-700 mt-2">{meeting.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {renderMeetingStatus(meeting)}
            </div>
          </div>
          
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Duration: {meeting.duration} minutes
            </div>
            <button
              onClick={() => handleJoinClick(meeting)}
              disabled={meeting.status === 'completed' || meeting.status === 'cancelled'}
              className={`px-4 py-2 rounded-md text-white ${
                meeting.status === 'completed' || meeting.status === 'cancelled'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : meetingService.isMeetingActive(meeting)
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {meetingService.isMeetingActive(meeting) ? 'Join Now' : 'Join Meeting'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

MeetingList.propTypes = {
  eventId: PropTypes.string.isRequired,
  onJoinMeeting: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool
};

MeetingList.defaultProps = {
  isAdmin: false
};

export default MeetingList; 