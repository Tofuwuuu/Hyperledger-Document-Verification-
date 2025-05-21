import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { getAllEvents, deleteEvent, generateEventQRCode, generateAttendanceQRCode } from '../../services/eventService';

const AdminEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [currentQRCode, setCurrentQRCode] = useState(null);
  const [currentEventName, setCurrentEventName] = useState("");
  const [qrCodeType, setQrCodeType] = useState("registration");
  const [qrCodeLoading, setQrCodeLoading] = useState(false);
  const [qrCodeError, setQrCodeError] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await getAllEvents(false); // Get all events including inactive ones
      setEvents(data);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event? This cannot be undone.')) {
      try {
        await deleteEvent(eventId);
        toast.success('Event deleted successfully');
        // Refresh events list
        fetchEvents();
      } catch (err) {
        toast.error('Failed to delete event. Please try again later.');
        console.error(err);
      }
    }
  };
  
  const handleGenerateQRCode = async (eventId, type = 'registration') => {
    try {
      console.log(`Starting QR code generation for event ${eventId} with type ${type}`);
      
      // Reset state
      setQrCodeError(null);
      setQrCodeLoading(true);
      setCurrentQRCode(null); // Reset QR code
      setShowQRModal(true);
      
      // Find event name for display
      const event = events.find(e => e._id === eventId);
      if (!event) {
        toast.error("Event not found");
        setQrCodeLoading(false);
        return;
      }
      
      console.log(`Event found: ${event.title}`);
      setCurrentEventName(event.title);
      setQrCodeType(type);
      
      let qrCodeUrl;
      
      if (type === 'registration') {
        console.log('Processing registration QR code');
        // Always generate a new QR code to avoid caching issues
        console.log('Generating new registration QR code');
        qrCodeUrl = await generateEventQRCode(eventId, 'registration');
        console.log('Registration QR code generated, length:', qrCodeUrl?.length);
        
        // Update the event in state with the new QR code
        setEvents(events.map(e => 
          e._id === eventId ? { ...e, qr_code_url: qrCodeUrl } : e
        ));
      } else if (type === 'attendance') {
        // For attendance QR code, we always generate a new one to ensure it's fresh
        console.log('Generating new attendance QR code');
        qrCodeUrl = await generateAttendanceQRCode(eventId);
        console.log('Attendance QR code generated, length:', qrCodeUrl?.length);
      }
      
      if (!qrCodeUrl) {
        console.error('QR code URL is empty or undefined');
        setQrCodeError('Failed to generate QR code - empty response');
        setQrCodeLoading(false);
        return;
      }
      
      console.log('Setting QR code in state');
      // Ensure QR code URL starts with data:image
      if (!qrCodeUrl.startsWith('data:image')) {
        if (qrCodeUrl.startsWith('{') || typeof qrCodeUrl === 'object') {
          // Try to extract from response object
          try {
            const qrObject = typeof qrCodeUrl === 'string' ? JSON.parse(qrCodeUrl) : qrCodeUrl;
            qrCodeUrl = qrObject.qr_code_url || qrObject.attendance_qr_url;
            console.log('Extracted QR code URL from object:', qrCodeUrl?.substring(0, 30) + '...');
          } catch (e) {
            console.error('Error parsing QR code JSON:', e);
          }
        }
      }
      
      setCurrentQRCode(qrCodeUrl);
      setQrCodeLoading(false);
    } catch (err) {
      console.error('Error generating QR code:', err);
      setQrCodeError(`Failed to generate ${qrCodeType} QR code: ${err.message}`);
      toast.error(`Failed to generate ${qrCodeType} QR code. Please try again later.`);
      setQrCodeLoading(false);
    }
  };
  
  const handleDownloadQRCode = () => {
    if (!currentQRCode) return;
    
    // Create a link element
    const link = document.createElement('a');
    link.href = currentQRCode;
    link.download = `event-${qrCodeType}-qr-${currentEventName.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && events.length === 0) {
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Events</h1>
        <Link
          to="/admin/events/new"
          className="bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
        >
          Create New Event
        </Link>
      </div>
      
      {events.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-600 mb-4">No events have been created yet.</p>
          <Link
            to="/admin/events/new"
            className="inline-block bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded transition duration-300"
          >
            Create Your First Event
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registrations
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.map((event) => (
                <tr key={event._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {event.image_url ? (
                        <div className="flex-shrink-0 h-10 w-10">
                          <img className="h-10 w-10 rounded-full object-cover" src={event.image_url} alt={event.title} />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-cvsu-green flex items-center justify-center">
                          <span className="text-white text-xs">EVENT</span>
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{event.title}</div>
                        <div className="text-sm text-gray-500">{event.location}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{format(new Date(event.start_date), 'MMM d, yyyy')}</div>
                    {event.end_date && (
                      <div className="text-sm text-gray-500">
                        to {format(new Date(event.end_date), 'MMM d, yyyy')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {event.registration_count || 0}
                        {event.max_attendees && (
                          <span> / {event.max_attendees}</span>
                        )}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                        <div 
                          className="bg-cvsu-green h-2.5 rounded-full" 
                          style={{ 
                            width: event.max_attendees 
                              ? `${Math.min(100, (event.registration_count / event.max_attendees) * 100)}%` 
                              : '100%' 
                          }}
                        ></div>
                      </div>
                      {event.max_attendees && (
                        <div className="text-xs text-gray-500 mt-1">
                          {Math.round((event.registration_count / event.max_attendees) * 100)}% filled
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      event.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {event.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link
                        to={`/admin/events/edit/${event._id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </Link>
                      <Link
                        to={`/admin/events/registrations/${event._id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="View and export registrations"
                      >
                        View Registrations
                      </Link>
                      <Link
                        to={`/admin/events/attendees/${event._id}`}
                        className="text-green-600 hover:text-green-900"
                      >
                        Attendees
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleGenerateQRCode(event._id, 'registration');
                        }}
                        className="text-green-600 hover:text-green-900"
                      >
                        Registration QR
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleGenerateQRCode(event._id, 'attendance');
                        }}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        Attendance QR
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteEvent(event._id);
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* QR Code Modal - Updated with better error handling and display */}
      {showQRModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="relative bg-white rounded-lg shadow-lg p-6 m-4 max-w-md mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Event {qrCodeType === 'registration' ? 'Registration' : 'Attendance'} QR Code
              </h3>
              <button 
                onClick={() => setShowQRModal(false)} 
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">
                {qrCodeType === 'registration' 
                  ? 'Display this QR code at your event. Attendees can scan it to instantly register.' 
                  : 'Display this QR code at your event. Registered attendees can scan it to mark their attendance.'}
              </p>
              
              <div className="mb-4 border p-2 inline-block bg-white" style={{ minWidth: '264px', minHeight: '264px' }}>
                {qrCodeLoading ? (
                  <div className="w-64 h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
                  </div>
                ) : qrCodeError ? (
                  <div className="w-64 h-64 flex flex-col items-center justify-center text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm">{qrCodeError}</p>
                  </div>
                ) : currentQRCode ? (
                  <>
                    <img 
                      src={currentQRCode} 
                      alt={`${qrCodeType} QR Code`} 
                      className="w-64 h-64 object-contain"
                      onError={(e) => {
                        console.error("Error loading QR code image:", e);
                        setQrCodeError("Failed to display QR code image");
                        e.target.style.display = 'none';
                      }}
                    />
                    {/* Fallback text - will show if image doesn't load but there's no error */}
                    {!currentQRCode.startsWith('data:image') && (
                      <div className="mt-2 text-xs text-red-500">
                        Warning: QR code format may be invalid. Try regenerating.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-gray-100">
                    <p className="text-gray-500">No QR code available</p>
                  </div>
                )}
              </div>
              
              <p className="font-medium">{currentEventName}</p>
              
              {currentQRCode && !qrCodeError && (
                <div className="mt-4 space-y-2">
                  <button 
                    onClick={handleDownloadQRCode}
                    className="bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
                  >
                    Download QR Code
                  </button>
                  <div>
                    <button 
                      onClick={() => {
                        // Regenerate the QR code
                        const event = events.find(e => e.title === currentEventName);
                        if (event) {
                          handleGenerateQRCode(event._id, qrCodeType);
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Regenerate QR Code
                    </button>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-3">
                {qrCodeType === 'registration'
                  ? 'Scan with a camera app to test. Anyone with this QR code can register for the event.'
                  : 'Only registered attendees can use this QR code to mark their attendance.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEventsPage; 