import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { getUpcomingEvents } from '../services/eventService';
import EventCard from '../components/EventCard';

const EventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const data = await getUpcomingEvents(10);
        setEvents(data);
        setError(null);
      } catch (err) {
        setError('Failed to load events. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cvsu-green"></div>
        <p className="ml-4 text-gray-600 animate-pulse">Loading events...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded relative">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2"> {error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero section */}
      <div className="relative bg-cover bg-center h-[300px]" style={{ backgroundImage: "url('/src/assets/graduation.jpg')" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-cvsu-green/90 to-cvsu-green/80"></div>
        <div className="absolute inset-0 bg-[url('/src/assets/pattern.svg')] opacity-10"></div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 h-full flex flex-col justify-center">
          <div className="max-w-3xl">
            <div className="animate-slideDown">
              <span className="inline-flex items-center rounded-full bg-cvsu-yellow/90 text-white px-4 py-1.5 text-sm font-medium mb-5 shadow-md backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-white mr-1.5 animate-pulse"></span>
                Stay Connected
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl drop-shadow-md animate-fadeIn">
              Upcoming <span className="text-cvsu-yellow">Events</span>
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 text-white/95 drop-shadow font-light backdrop-blur-[2px] pl-3 border-l-4 border-cvsu-yellow animate-slideUp">
              Join us for these exciting events and stay connected with the CVSU-Carmona community.
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
      </div>
      
      {/* Events list */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {events.length === 0 ? (
          <div className="bg-white shadow-lg rounded-xl p-8 text-center border border-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Upcoming Events</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              There are no upcoming events scheduled at the moment. Please check back later for new events.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map((event, index) => (
              <EventCard key={event._id} event={event} index={index} />
            ))}
          </div>
        )}
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
  
  .animate-fadeIn {
    animation: fadeIn 0.6s ease-out forwards;
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

export default EventsPage; 