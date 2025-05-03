import React, { useState } from 'react';
import PropTypes from 'prop-types';
import meetingService from '../services/meetingService';

const MeetingScheduler = ({ eventId, onScheduled }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    duration: 60
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'duration' ? parseInt(value, 10) : value
    });
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Meeting title is required');
      return false;
    }
    if (!formData.start_time) {
      setError('Start time is required');
      return false;
    }
    if (!formData.duration || formData.duration < 15) {
      setError('Duration must be at least 15 minutes');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Prepare meeting data
      const meetingData = {
        ...formData,
        event_id: eventId
      };
      
      // Call API to create meeting
      const response = await meetingService.createMeeting(meetingData);
      
      // Call onScheduled callback with new meeting data
      if (onScheduled) {
        onScheduled(response.data);
      }
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        start_time: '',
        duration: 60
      });
    } catch (err) {
      console.error('Failed to schedule meeting:', err);
      
      // Properly handle various error formats
      let errorMessage = 'Failed to schedule meeting. Please try again.';
      
      if (err.response) {
        const responseData = err.response.data;
        
        // Handle different error formats
        if (typeof responseData === 'string') {
          errorMessage = responseData;
        } else if (responseData.detail) {
          // FastAPI often returns errors in detail field
          if (typeof responseData.detail === 'string') {
            errorMessage = responseData.detail;
          } else if (Array.isArray(responseData.detail)) {
            // Handle validation errors array
            errorMessage = responseData.detail.map(err => err.msg).join(', ');
          }
        } else if (responseData.message) {
          errorMessage = responseData.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h3 className="text-xl font-semibold mb-4">Schedule Virtual Meeting</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Meeting Title*
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={formData.title}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Alumni Committee Meeting"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Brief description of the meeting..."
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
              Start Time*
            </label>
            <input
              id="start_time"
              name="start_time"
              type="datetime-local"
              value={formData.start_time}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)*
            </label>
            <select
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
              <option value="180">3 hours</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isLoading ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Scheduling...' : 'Schedule Meeting'}
          </button>
        </div>
      </form>
    </div>
  );
};

MeetingScheduler.propTypes = {
  eventId: PropTypes.string.isRequired,
  onScheduled: PropTypes.func
};

export default MeetingScheduler; 