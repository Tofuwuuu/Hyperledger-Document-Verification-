import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { getEventById, registerForEvent, checkUserEventRegistration, cancelRegistration } from '../services/eventService';
import { useAuth } from '../context/AuthContext';
import MeetingScheduler from '../components/MeetingScheduler';
import MeetingList from '../components/MeetingList';
import JitsiMeeting from '../components/JitsiMeeting';

const EventDetailPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [userRegistration, setUserRegistration] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Define fetchEventDetails outside useEffect so it can be called from other functions
  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const data = await getEventById(eventId);
      setEvent(data);
      setError(null);
      
      // If user is authenticated, check if already registered
      if (isAuthenticated && currentUser) {
        console.log(`Authenticated user ${currentUser.username} checking registration for event ${eventId}`);
        const registration = await checkUserEventRegistration(eventId);
        console.log(`Registration check result:`, registration);
        setIsRegistered(!!registration);
        setUserRegistration(registration);
        
        // Check if user is admin
        const userIsAdmin = currentUser.is_admin === true;
        console.log('User is admin:', userIsAdmin);
        setIsAdmin(userIsAdmin);
      } else {
        // Reset registration state if not authenticated
        setIsRegistered(false);
        setUserRegistration(null);
        setIsAdmin(false);
      }
    } catch (err) {
      setError('Failed to load event details. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId && isAuthenticated) {
      fetchEventDetails();
    }
    
    // Add currentUser as dependency to re-check registration when user logs in/out
  }, [eventId, isAuthenticated, currentUser]);

  const handleRegister = async () => {
    if (!isAuthenticated) {
      // Save the event page to redirect back after login
      sessionStorage.setItem('redirectAfterLogin', `/events/${eventId}`);
      navigate('/login');
      return;
    }

    try {
      setRegistering(true);
      console.log(`Attempting to register for event ${eventId}`);
      const registration = await registerForEvent(eventId);
      console.log('Registration successful, response:', registration);
      toast.success('You have successfully registered for this event!');
      
      // Update registration status
      setIsRegistered(true);
      setUserRegistration(registration);
      
      // Refresh event details to update the registration count
      const updatedEvent = await getEventById(eventId);
      setEvent(updatedEvent);
      
      // Double-check registration status to ensure UI consistency
      const confirmedRegistration = await checkUserEventRegistration(eventId);
      console.log('Confirmed registration after register:', confirmedRegistration);
      
      if (!confirmedRegistration) {
        console.warn('Registration succeeded but checkUserEventRegistration returned null. Forcing isRegistered state to true.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      
      // Display specific error message from the server if available
      if (err.userMessage) {
        toast.error(err.userMessage);
      } else if (err.response && err.response.status === 400 && err.response.data.detail === "Event has reached maximum capacity") {
        toast.error('This event has reached its maximum capacity.');
      } else {
        toast.error('Failed to register for the event. Please try again later.');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!userRegistration) return;
    
    if (window.confirm('Are you sure you want to cancel your registration for this event?')) {
      try {
        setCancelling(true);
        await cancelRegistration(userRegistration._id);
        toast.success('Your registration has been cancelled.');
        
        // Update registration status
        setIsRegistered(false);
        setUserRegistration(null);
        
        // Refresh event details to update the registration count
        const updatedEvent = await getEventById(eventId);
        setEvent(updatedEvent);
      } catch (err) {
        console.error(err);
        toast.error('Failed to cancel registration. Please try again later.');
      } finally {
        setCancelling(false);
      }
    }
  };

  const handleMeetingScheduled = (meeting) => {
    fetchEventDetails();
  };
  
  const handleJoinMeeting = (meeting) => {
    setCurrentMeeting(meeting);
    setShowMeeting(true);
  };
  
  const handleCloseMeeting = () => {
    setShowMeeting(false);
    setCurrentMeeting(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error || 'Event not found'}</span>
        </div>
      </div>
    );
  }

  const isRegistrationFull = event.max_attendees && event.registration_count >= event.max_attendees;
  const isRegistrationClosed = event.registration_deadline && new Date() > new Date(event.registration_deadline);
  const canRegister = event.is_active && !isRegistrationFull && !isRegistrationClosed && !isRegistered;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
        {event.image_url ? (
          <div className="w-full h-64 md:h-80 bg-cover bg-center" style={{ backgroundImage: `url(${event.image_url})` }}></div>
        ) : (
          <div className="w-full h-64 md:h-80 bg-cvsu-green flex items-center justify-center">
            <span className="text-white text-3xl font-semibold">CVSU Event</span>
          </div>
        )}
        
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
          
          <div className="mb-6">
            <span className="inline-block bg-cvsu-green text-white text-sm font-semibold px-3 py-1 rounded-full mr-2">
              {event.category || 'General'}
            </span>
            {event.department && (
              <span className="inline-block bg-gray-200 text-gray-700 text-sm font-semibold px-3 py-1 rounded-full">
                {event.department}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                <div className="font-semibold">Date</div>
                <div>{format(new Date(event.start_date), 'MMMM d, yyyy')}</div>
                {event.end_date && (
                  <div>to {format(new Date(event.end_date), 'MMMM d, yyyy')}</div>
                )}
              </div>
            </div>
            
            <div className="flex items-center text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <div className="font-semibold">Location</div>
                <div>{event.location}</div>
              </div>
            </div>
          </div>
          
          {event.registration_deadline && (
            <div className="mb-6 px-4 py-3 bg-yellow-50 text-yellow-800 border-l-4 border-yellow-400">
              <div className="font-semibold">Registration Deadline</div>
              <div>{format(new Date(event.registration_deadline), 'MMMM d, yyyy')}</div>
            </div>
          )}
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Description</h2>
            <p className="text-gray-700 whitespace-pre-line">{event.description}</p>
          </div>
          
          <div className="flex items-center justify-between mb-6">
            <div className="text-gray-600">
              <span className="font-semibold">Registrations:</span> {event.registration_count}
              {event.max_attendees && (
                <span> / {event.max_attendees}</span>
              )}
            </div>
            
            {event.registration_url && (
              <a 
                href={event.registration_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                External Registration Link
              </a>
            )}
          </div>
          
          <div className="flex justify-center">
            {isRegistered ? (
              <div className="flex flex-col md:flex-row w-full md:w-auto gap-4">
                <div className="bg-blue-100 border border-blue-400 text-blue-700 px-6 py-3 rounded-lg font-semibold w-full text-center flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>You are registered for this event</span>
                </div>
                <button
                  onClick={handleCancelRegistration}
                  disabled={cancelling}
                  className="py-3 px-6 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition duration-300 w-full md:w-auto"
                >
                  {cancelling ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Cancelling...
                    </span>
                  ) : (
                    'Cancel Registration'
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={handleRegister}
                disabled={!canRegister || registering}
                className={`py-3 px-6 rounded-lg font-semibold text-white ${
                  canRegister 
                    ? 'bg-cvsu-green hover:bg-green-700' 
                    : 'bg-gray-400 cursor-not-allowed'
                } transition duration-300 w-full md:w-auto`}
              >
                {registering ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Registering...
                  </span>
                ) : (
                  <span>
                    {isRegistrationFull
                      ? 'Event Full'
                      : isRegistrationClosed
                      ? 'Registration Closed'
                      : 'Register for This Event'}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {event && (
        <div className="mt-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">Virtual Meetings</h2>
            
            {/* Meeting scheduler for admins */}
            {isAdmin && (
              <MeetingScheduler 
                eventId={event._id} 
                onScheduled={handleMeetingScheduled} 
              />
            )}
            
            {/* Meeting list */}
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-4">Available Meetings</h3>
              <MeetingList 
                eventId={event._id} 
                onJoinMeeting={handleJoinMeeting}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Meeting modal */}
      {showMeeting && currentMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">{currentMeeting.title}</h3>
              <button 
                onClick={handleCloseMeeting}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-[500px]">
              <JitsiMeeting 
                roomName={currentMeeting.room_name}
                displayName={currentUser?.full_name || 'Alumni Participant'}
                onClose={handleCloseMeeting}
                meetingId={currentMeeting._id}
                isAdmin={currentUser?.is_admin === true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetailPage; 