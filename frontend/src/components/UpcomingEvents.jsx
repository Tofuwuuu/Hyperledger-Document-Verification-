import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { getUpcomingEvents } from '../services/eventService';
import EventCard from './EventCard';

const UpcomingEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        console.log('UpcomingEvents: Fetching upcoming events...');
        setLoading(true);
        const data = await getUpcomingEvents(5); // Get top 5 upcoming events
        console.log('UpcomingEvents: Received events data:', data);
        setEvents(data);
        setError(null);
        
        // Trigger animation after data is loaded
        setTimeout(() => setShowAnimation(true), 100);
      } catch (err) {
        console.error('UpcomingEvents: Error fetching events:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-cvsu-green"></div>
        <p className="mt-4 text-gray-600 animate-pulse">Loading upcoming events...</p>
      </div>
    );
  }

  if (error || events.length === 0) {
    console.log('UpcomingEvents: No events or error condition. Error:', error, 'Events length:', events.length);
    return null; // Don't show anything if there are no events or there's an error
  }

  console.log('UpcomingEvents: Rendering events section with', events.length, 'events');
  return (
    <div className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12">
          <div>
            <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-cvsu-green mb-3">
              <span className="flex h-2 w-2 rounded-full bg-cvsu-green mr-1.5 animate-pulse"></span>
              Stay Connected
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Upcoming Events</h2>
            <p className="mt-2 text-gray-600 max-w-2xl">
              Join us for these upcoming events and stay connected with the CVSU-Carmona community
            </p>
          </div>
          
          <Link 
            to="/events" 
            className="mt-4 md:mt-0 inline-flex items-center text-cvsu-green hover:text-green-700 font-semibold group"
          >
            View all events
            <svg 
              className="ml-2 w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-200" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
            </svg>
          </Link>
        </div>
        
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 ${showAnimation ? 'animate-fade-in' : 'opacity-0'}`}>
          {events.map((event, index) => (
            <EventCard key={event._id} event={event} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Add necessary CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fade-in > * {
    animation: fadeIn 0.6s ease-out forwards;
    opacity: 0;
  }

  /* Line clamp fallback */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;
document.head.appendChild(style);

export default UpcomingEvents; 