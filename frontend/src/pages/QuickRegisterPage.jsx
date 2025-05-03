import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { handleQuickRegistration, getEventById } from '../services/eventService';
import { useAuth } from '../context/AuthContext';

const QuickRegisterPage = () => {
  const { eventId, token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // If not authenticated, redirect to login page with return URL
    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(`/quick-register/${eventId}/${token}`);
      navigate(`/login?returnUrl=${returnUrl}`);
      return;
    }

    // Fetch event details
    const fetchEventDetails = async () => {
      try {
        const eventData = await getEventById(eventId);
        setEvent(eventData);
        setError(null);
      } catch (err) {
        console.error('Error fetching event details:', err);
        setError('Event not found or has been removed.');
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [eventId, token, isAuthenticated, navigate]);

  const handleRegistration = async () => {
    if (!isAuthenticated || !currentUser) {
      toast.error('You must be logged in to register');
      return;
    }

    setRegistering(true);
    try {
      await handleQuickRegistration(eventId, token);
      setSuccess(true);
      toast.success('Successfully registered for the event!');
    } catch (err) {
      console.error('Registration error:', err);
      
      // Extract error message if available
      let errorMessage = 'Failed to register for the event. Please try again.';
      if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = err.response.data.detail;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setRegistering(false);
    }
  };

  // Handle automatic registration when the component loads
  useEffect(() => {
    if (!loading && event && isAuthenticated && !registering && !success && !error) {
      handleRegistration();
    }
  }, [loading, event, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
          </div>
          <h2 className="text-xl font-semibold text-center text-gray-800">
            Processing Registration...
          </h2>
          <p className="text-gray-600 text-center mt-2">
            Please wait while we verify the event information.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="flex justify-center mb-4 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-center text-gray-800">
            Registration Error
          </h2>
          <p className="text-red-600 text-center mt-2">
            {error}
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => navigate('/events')}
              className="bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
            >
              Explore Other Events
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="flex justify-center mb-4 text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-center text-gray-800">
            Registration Successful!
          </h2>
          <p className="text-gray-600 text-center mt-2">
            You have been registered for <span className="font-medium">{event?.title}</span>.
          </p>
          <div className="mt-6 flex justify-center space-x-4">
            <button
              onClick={() => navigate('/dashboard/registrations')}
              className="bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
            >
              View My Registrations
            </button>
            <button
              onClick={() => navigate(`/events/${eventId}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
            >
              Event Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <div className="flex justify-center mb-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
        </div>
        <h2 className="text-xl font-semibold text-center text-gray-800">
          Registering for Event...
        </h2>
        <p className="text-gray-600 text-center mt-2">
          Please wait while we process your registration.
        </p>
      </div>
    </div>
  );
};

export default QuickRegisterPage; 