import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { getUserRegistrations, cancelRegistration } from '../../services/eventService';

const MyRegistrationsPage = () => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const data = await getUserRegistrations();
      setRegistrations(data);
      setError(null);
    } catch (err) {
      setError('Failed to load your registrations. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const handleCancelRegistration = async (registrationId) => {
    if (window.confirm('Are you sure you want to cancel this registration?')) {
      try {
        await cancelRegistration(registrationId);
        toast.success('Registration cancelled successfully');
        // Refresh registrations
        fetchRegistrations();
      } catch (err) {
        toast.error('Failed to cancel registration. Please try again later.');
        console.error(err);
      }
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
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">My Event Registrations</h1>
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-600 mb-4">You haven't registered for any events yet.</p>
          <Link
            to="/events"
            className="inline-block bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded transition duration-300"
          >
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">My Event Registrations</h1>
      
      <div className="grid grid-cols-1 gap-6">
        {registrations.map((registration) => (
          <div key={registration._id} className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                <h2 className="text-xl font-semibold">{registration.event_title}</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  registration.status === 'attended' 
                    ? 'bg-green-100 text-green-800' 
                    : registration.status === 'cancelled' 
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="flex items-center text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <div className="font-semibold">Date</div>
                    <div>{format(new Date(registration.event_date), 'MMMM d, yyyy')}</div>
                  </div>
                </div>
                
                <div className="flex items-center text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <div className="font-semibold">Location</div>
                    <div>{registration.event_location}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row items-center justify-between">
                <div className="flex space-x-2 mb-4 md:mb-0">
                  <Link
                    to={`/events/${registration.event_id}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition duration-300"
                  >
                    Event Details
                  </Link>
                </div>
                
                {registration.status !== 'attended' && registration.status !== 'cancelled' && (
                  <button
                    onClick={() => handleCancelRegistration(registration._id)}
                    className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition duration-300"
                  >
                    Cancel Registration
                  </button>
                )}
              </div>
              
              {registration.check_in_time && (
                <div className="mt-4 px-4 py-2 bg-green-50 text-green-800 rounded">
                  <span className="font-semibold">Checked in at:</span> {format(new Date(registration.check_in_time), 'MMMM d, yyyy h:mm a')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyRegistrationsPage; 