import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { getUpcomingEvents } from '../services/eventService';
import { CalendarDaysIcon, MapPinIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

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
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="h-56 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </section>
    );
  }

  if (error || events.length === 0) {
    return null; // Don't show anything if there are no events or there's an error
  }

  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-cvsu-green">Upcoming Events</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">Meet, learn, and reconnect</h2>
          </div>
          <Link to="/events" className="hidden items-center text-sm font-semibold text-cvsu-green hover:text-cvsu-green/80 sm:inline-flex">
            View all events
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {events.map((event) => (
            <article key={event._id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              {event.image_url ? (
                <img 
                  src={event.image_url} 
                  alt={event.title} 
                  className="h-44 w-full object-cover"
                />
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-cvsu-green">
                  <span className="text-lg font-bold text-white">CVSU Event</span>
                </div>
              )}
              <div className="p-5">
                <h3 className="truncate text-lg font-bold text-slate-950">{event.title}</h3>
                <div className="mt-4 flex items-center text-sm text-slate-600">
                  <CalendarDaysIcon className="mr-2 h-4 w-4 text-cvsu-green" />
                  {format(new Date(event.start_date), 'MMMM d, yyyy')}
                </div>
                <div className="mt-2 flex items-center text-sm text-slate-600">
                  <MapPinIcon className="mr-2 h-4 w-4 text-cvsu-green" />
                  {event.location}
                </div>
                <Link 
                  to={`/events/${event._id}`}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-cvsu-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cvsu-green/90"
                >
                  View details
                </Link>
              </div>
            </article>
          ))}
        </div>
        <Link to="/events" className="mt-6 inline-flex items-center text-sm font-semibold text-cvsu-green hover:text-cvsu-green/80 sm:hidden">
          View all events
          <ArrowRightIcon className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </section>
  );
};

export default UpcomingEvents; 
