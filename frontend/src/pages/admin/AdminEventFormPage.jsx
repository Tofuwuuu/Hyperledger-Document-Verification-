import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getEventById, createEvent, updateEvent } from '../../services/eventService';
import axios from 'axios';
import { API_URL } from '../../config';

const AdminEventFormPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!eventId;
  
  const [loading, setLoading] = useState(isEditMode);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    image_url: '',
    registration_url: '',
    category: '',
    department: '',
    is_active: true,
    max_attendees: '',
    registration_deadline: '',
    requires_approval: false
  });

  useEffect(() => {
    const loadData = async () => {
      // Fetch CSRF token for form submission with retry logic
      let retryCount = 0;
      const maxRetries = 2;
      let csrfSuccess = false;
      
      while (!csrfSuccess && retryCount <= maxRetries) {
        try {
          console.log(`Fetching CSRF token for event form (attempt ${retryCount + 1}/${maxRetries + 1})`);
          const response = await axios.get(`${API_URL}/auth/csrf-token`, { 
            withCredentials: true,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (response.data && response.data.csrf_token) {
            localStorage.setItem('csrf_token', response.data.csrf_token);
            console.log('CSRF token obtained and stored:', response.data.csrf_token);
            csrfSuccess = true;
          } else {
            console.warn('CSRF token response did not contain token');
            retryCount++;
            if (retryCount <= maxRetries) await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
          }
        } catch (error) {
          console.error('Error fetching CSRF token:', error);
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(`Retrying CSRF token fetch in 1 second...`);
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
          }
        }
      }
      
      if (!csrfSuccess) {
        console.warn('Failed to obtain CSRF token after multiple attempts');
      }

      // Load event data if editing
      if (eventId) {
        try {
          setLoading(true);
          const event = await getEventById(eventId);
          
          // Format dates for date inputs
          const formatDateForInput = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toISOString().split('T')[0]; // YYYY-MM-DD format
          };
          
          setFormData({
            ...event,
            start_date: formatDateForInput(event.start_date),
            end_date: formatDateForInput(event.end_date),
            registration_deadline: formatDateForInput(event.registration_deadline),
            max_attendees: event.max_attendees || ''
          });
          
          setError(null);
        } catch (err) {
          setError('Failed to load event. Please try again later.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadData();
  }, [eventId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle checkbox inputs
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
      return;
    }
    
    // Handle number inputs
    if (type === 'number') {
      setFormData({ ...formData, [name]: value === '' ? '' : Number(value) });
      return;
    }
    
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Helper function to convert date strings to ISO format with time
      const formatDateForAPI = (dateString) => {
        if (!dateString) return null;
        // Set the time to noon (12:00) to avoid timezone issues
        const date = new Date(dateString + 'T12:00:00');
        return date.toISOString();
      };
      
      // Prepare data for API
      const eventData = {
        ...formData,
        // Convert date strings to proper ISO datetime format
        start_date: formatDateForAPI(formData.start_date),
        end_date: formatDateForAPI(formData.end_date),
        registration_deadline: formatDateForAPI(formData.registration_deadline),
        max_attendees: formData.max_attendees === '' ? null : Number(formData.max_attendees),
        // Set empty strings to null
        image_url: formData.image_url || null,
        registration_url: formData.registration_url || null
      };
      
      if (isEditMode) {
        await updateEvent(eventId, eventData);
        toast.success('Event updated successfully');
      } else {
        await createEvent(eventData);
        toast.success('Event created successfully');
      }
      
      navigate('/admin/events');
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${isEditMode ? 'update' : 'create'} event. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
        <button
          onClick={() => navigate('/admin/events')}
          className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
        >
          Back to Events
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{isEditMode ? 'Edit Event' : 'Create New Event'}</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Title*
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
                placeholder="Enter event title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location*
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
                placeholder="Enter event location"
              />
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Description*
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
              placeholder="Enter event description"
            ></textarea>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date*
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Deadline
              </label>
              <input
                type="date"
                name="registration_deadline"
                value={formData.registration_deadline}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
                placeholder="E.g., Seminar, Workshop, Social"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
                placeholder="E.g., Computer Science, Engineering"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Attendees
              </label>
              <input
                type="number"
                name="max_attendees"
                value={formData.max_attendees}
                onChange={handleChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
                placeholder="Leave blank for unlimited"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL
              </label>
              <input
                type="url"
                name="image_url"
                value={formData.image_url}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
                placeholder="Enter URL for event image"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                External Registration URL
              </label>
              <input
                type="url"
                name="registration_url"
                value={formData.registration_url}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green"
                placeholder="Optional external registration link"
              />
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                Event is active (visible to users)
              </label>
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="requires_approval"
                name="requires_approval"
                checked={formData.requires_approval}
                onChange={handleChange}
                className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
              />
              <label htmlFor="requires_approval" className="ml-2 block text-sm text-gray-700">
                Registration requires admin approval
              </label>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/admin/events')}
              className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
              disabled={loading}
            >
              {loading ? 'Saving...' : isEditMode ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminEventFormPage; 