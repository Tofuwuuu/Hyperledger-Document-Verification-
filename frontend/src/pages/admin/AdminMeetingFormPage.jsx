import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import meetingService from '../../services/meetingService';
import { 
  ArrowLeftIcon, 
  ClockIcon, 
  VideoCameraIcon, 
  ShieldCheckIcon,
  UserGroupIcon, 
  LockClosedIcon
} from '@heroicons/react/24/outline';

const AdminMeetingFormPage = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(meetingId);
  
  const [loading, setLoading] = useState(isEditMode);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({
    event_id: '',
    title: '',
    description: '',
    start_time: '',
    duration: 60,
    security: {
      requirePassword: false,
      enableLobby: true,
      membersOnly: true,
      allowRecording: true,
      maxParticipants: 25
    }
  });
  
  // Fetch meeting data if in edit mode
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Fetch events for dropdown
        const response = await fetch('/api/v1/events');
        const data = await response.json();
        setEvents(data);
      } catch (err) {
        console.error('Error fetching events:', err);
        toast.error('Failed to load events');
      }
    };
    
    const fetchMeeting = async () => {
      try {
        if (isEditMode) {
          setLoading(true);
          const response = await meetingService.getMeeting(meetingId);
          const meetingData = response.data;
          
          // Format date for datetime-local input
          const startTime = new Date(meetingData.start_time);
          const formattedStartTime = startTime.toISOString().slice(0, 16); // Format as YYYY-MM-DDTHH:MM
          
          // Prepare security settings (with defaults if missing)
          const security = {
            requirePassword: meetingData.config?.require_password || false,
            enableLobby: meetingData.config?.enable_lobby || true,
            membersOnly: meetingData.config?.members_only || true,
            allowRecording: meetingData.config?.auto_record || true,
            maxParticipants: meetingData.config?.max_participants || 25
          };
          
          setFormData({
            event_id: meetingData.event_id,
            title: meetingData.title,
            description: meetingData.description || '',
            start_time: formattedStartTime,
            duration: meetingData.duration,
            security
          });
        }
      } catch (err) {
        console.error('Error fetching meeting:', err);
        setError('Failed to load meeting details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
    if (isEditMode) {
      fetchMeeting();
    }
  }, [meetingId, isEditMode]);
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('security.')) {
      // Handle security settings
      const securityField = name.split('.')[1];
      setFormData({
        ...formData,
        security: {
          ...formData.security,
          [securityField]: type === 'checkbox' ? checked : value
        }
      });
    } else {
      // Handle regular form fields
      setFormData({
        ...formData,
        [name]: type === 'number' ? parseInt(value, 10) : value
      });
    }
  };
  
  const validateForm = () => {
    if (!formData.event_id) {
      setError('Please select an event');
      return false;
    }
    if (!formData.title.trim()) {
      setError('Meeting title is required');
      return false;
    }
    if (!formData.start_time) {
      setError('Start time is required');
      return false;
    }
    if (formData.duration < 15) {
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
    
    setLoading(true);
    
    try {
      // Prepare data for API
      const apiData = {
        ...formData,
        // Convert security settings to API format
        config: {
          members_only: formData.security.membersOnly,
          require_password: formData.security.requirePassword,
          enable_lobby: formData.security.enableLobby,
          auto_record: formData.security.allowRecording,
          max_participants: formData.security.maxParticipants
        }
      };
      
      // Remove the security field as it's not needed in the API
      delete apiData.security;
      
      if (isEditMode) {
        // Update existing meeting
        await meetingService.updateMeeting(meetingId, apiData);
        toast.success('Meeting updated successfully');
      } else {
        // Create new meeting
        await meetingService.createMeeting(apiData);
        toast.success('Meeting created successfully');
      }
      
      // Redirect to meetings list
      navigate('/admin/meetings');
    } catch (err) {
      console.error('Failed to save meeting:', err);
      setError('Failed to save meeting. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Link 
          to="/admin/meetings" 
          className="inline-flex items-center text-indigo-600 hover:text-indigo-900"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Meetings
        </Link>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex items-center">
            <VideoCameraIcon className="h-8 w-8 text-purple-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'Edit Meeting' : 'Create New Meeting'}
            </h1>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 mx-6 mt-4">
            <p>{error}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-6">
              <label htmlFor="event_id" className="block text-sm font-medium text-gray-700">
                Event*
              </label>
              <div className="mt-1">
                <select
                  id="event_id"
                  name="event_id"
                  value={formData.event_id}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select an event</option>
                  {events.map(event => (
                    <option key={event._id} value={event._id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="sm:col-span-6">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Meeting Title*
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="title"
                  id="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Alumni Committee Meeting"
                  required
                />
              </div>
            </div>
            
            <div className="sm:col-span-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <div className="mt-1">
                <textarea
                  id="description"
                  name="description"
                  rows="3"
                  value={formData.description}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Brief description of the meeting..."
                />
              </div>
            </div>
            
            <div className="sm:col-span-3">
              <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
                Start Time*
              </label>
              <div className="mt-1">
                <input
                  type="datetime-local"
                  name="start_time"
                  id="start_time"
                  value={formData.start_time}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>
            
            <div className="sm:col-span-3">
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                Duration (minutes)*
              </label>
              <div className="mt-1">
                <select
                  id="duration"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
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
          </div>
          
          {/* Security Settings Section */}
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <ShieldCheckIcon className="h-5 w-5 text-indigo-600 mr-2" />
              Security Settings
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure security options for this meeting
            </p>
            
            <div className="mt-4 space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="security.membersOnly"
                    name="security.membersOnly"
                    type="checkbox"
                    checked={formData.security.membersOnly}
                    onChange={handleChange}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="security.membersOnly" className="font-medium text-gray-700">
                    Members Only
                  </label>
                  <p className="text-gray-500">Only authenticated users can join the meeting</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="security.enableLobby"
                    name="security.enableLobby"
                    type="checkbox"
                    checked={formData.security.enableLobby}
                    onChange={handleChange}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="security.enableLobby" className="font-medium text-gray-700">
                    Enable Lobby
                  </label>
                  <p className="text-gray-500">Participants must be admitted by a moderator</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="security.requirePassword"
                    name="security.requirePassword"
                    type="checkbox"
                    checked={formData.security.requirePassword}
                    onChange={handleChange}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="security.requirePassword" className="font-medium text-gray-700">
                    Require Password
                  </label>
                  <p className="text-gray-500">Generate a password for this meeting</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="security.allowRecording"
                    name="security.allowRecording"
                    type="checkbox"
                    checked={formData.security.allowRecording}
                    onChange={handleChange}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="security.allowRecording" className="font-medium text-gray-700">
                    Allow Recording
                  </label>
                  <p className="text-gray-500">Moderators can record this meeting</p>
                </div>
              </div>
              
              <div className="sm:col-span-3">
                <label htmlFor="security.maxParticipants" className="block text-sm font-medium text-gray-700">
                  Maximum Participants
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="security.maxParticipants"
                    id="security.maxParticipants"
                    value={formData.security.maxParticipants}
                    onChange={handleChange}
                    min="1"
                    max="100"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <Link
              to="/admin/meetings"
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={loading}
            >
              {loading ? 'Saving...' : isEditMode ? 'Update Meeting' : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminMeetingFormPage; 