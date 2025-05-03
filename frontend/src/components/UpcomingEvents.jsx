import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { getUpcomingEvents } from '../services/eventService';

const UpcomingEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const data = await getUpcomingEvents(3); // Get top 3 upcoming events
        setEvents(data);
        setError(null);
      } catch (err) {
        setError('Failed to load events');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  if (error || events.length === 0) {
    return null; // Don't show anything if there are no events or there's an error
  }

  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-cvsu-green">Upcoming Events</h2>
          <Link to="/events" className="text-blue-600 hover:text-blue-800">View all events</Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event._id} className="bg-white shadow-md rounded-lg overflow-hidden">
              {event.image_url ? (
                <img 
                  src={event.image_url} 
                  alt={event.title} 
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-cvsu-green flex items-center justify-center">
                  <span className="text-white text-xl">CVSU Event</span>
                </div>
              )}
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-2 truncate">{event.title}</h3>
                <div className="flex items-center text-gray-500 mb-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {format(new Date(event.start_date), 'MMMM d, yyyy')}
                </div>
                <div className="flex items-center text-gray-500 mb-3 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {event.location}
                </div>
                <Link 
                  to={`/events/${event._id}`}
                  className="block w-full bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded text-center transition duration-300 text-sm"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UpcomingEvents; 