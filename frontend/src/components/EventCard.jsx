import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import PropTypes from 'prop-types';

const EventCard = ({ event, index = 0 }) => {
  // Animation delay based on index for staggered entrance
  const animationDelay = `${index * 150}ms`;

  return (
    <div 
      className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 group animate-fadeIn"
      style={{ animationDelay }}
    >
      <div className="relative">
        {event.image_url ? (
          <img 
            src={event.image_url} 
            alt={event.title} 
            className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-48 bg-cvsu-green flex items-center justify-center">
            <span className="text-white text-xl font-medium">CVSU Event</span>
          </div>
        )}
        
        {/* Date badge */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow">
          <div className="text-cvsu-green font-bold text-lg leading-none">
            {format(new Date(event.start_date), 'dd')}
          </div>
          <div className="text-gray-600 text-xs uppercase font-medium">
            {format(new Date(event.start_date), 'MMM')}
          </div>
        </div>
      </div>
      
      <div className="p-5">
        <h3 className="text-lg font-bold text-gray-800 mb-2 truncate group-hover:text-cvsu-green transition-colors duration-200">
          {event.title}
        </h3>
        
        <p className="text-gray-600 mb-4 text-sm overflow-hidden text-ellipsis line-clamp-2">{event.description}</p>
        
        <div className="space-y-3 mb-4">
          <div className="flex items-center text-gray-500 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-cvsu-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{format(new Date(event.start_date), 'MMM d, yyyy')}</span>
          </div>
          
          <div className="flex items-center text-gray-500 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-cvsu-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{event.location}</span>
          </div>
        </div>
        
        <Link 
          to={`/events/${event._id}`}
          className="inline-flex items-center justify-center w-full bg-cvsu-green hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded text-center transition-all duration-300 group-hover:shadow"
        >
          <span>View Details</span>
          <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H6"></path>
          </svg>
        </Link>
      </div>
    </div>
  );
};

EventCard.propTypes = {
  event: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    start_date: PropTypes.string.isRequired,
    location: PropTypes.string,
    image_url: PropTypes.string
  }).isRequired,
  index: PropTypes.number
};

export default EventCard; 