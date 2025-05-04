import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { getEventById, getEventRegistrations, checkInUser, updateRegistrationStatus, updateEvent } from '../../services/eventService';
import { QrReader } from 'react-qr-reader';

const EventRegistrationsPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Add registration count stats
  const [registrationStats, setRegistrationStats] = useState({
    total: 0,
    registered: 0,
    attended: 0,
    cancelled: 0
  });

  const fetchEventDetails = async () => {
    try {
      console.log(`Fetching event details for event ID: ${eventId}`);
      const eventData = await getEventById(eventId);
      console.log("Event data retrieved:", eventData.title);
      
      console.log(`Fetching registrations for event ID: ${eventId}`);
      const registrationsData = await getEventRegistrations(eventId);
      console.log(`Received ${registrationsData.length} registrations for this event`);
      
      if (!registrationsData || registrationsData.length === 0) {
        console.warn(`No registrations found for event ID: ${eventId}`);
      } else {
        console.log("First registration:", registrationsData[0]);
      }
      
      // Set registrations data
      setRegistrations(registrationsData);
      
      // Calculate registration stats from the actual registrations
      const stats = {
        total: registrationsData.length,
        registered: registrationsData.filter(r => r.status === 'registered').length,
        attended: registrationsData.filter(r => r.status === 'attended').length,
        cancelled: registrationsData.filter(r => r.status === 'cancelled').length
      };
      
      console.log("Registration statistics:", stats);
      setRegistrationStats(stats);
      
      // Double-check if the event registration_count matches our registration length
      if (eventData.registration_count !== registrationsData.length) {
        console.warn(`Mismatch: Event registration_count (${eventData.registration_count}) ` +
                    `doesn't match registrations length (${registrationsData.length})`);
        
        // Update the event data with the correct count from our registrations
        try {
          // Create a copy of the event data with the corrected registration count
          const correctedEventData = {
            ...eventData,
            registration_count: registrationsData.length
          };
          
          // Save the corrected event in state
          setEvent(correctedEventData);
          
          // Attempt to update the event in the database
          console.log(`Attempting to fix registration count for event ID: ${eventId}`);
          await updateEvent(eventId, { registration_count: registrationsData.length });
          console.log(`Successfully updated event registration count to ${registrationsData.length}`);
        } catch (updateErr) {
          console.error('Failed to update event registration count:', updateErr);
          // Still use the corrected data locally even if the API update fails
          setEvent(eventData);
        }
      } else {
        // No mismatch, just set the event data as is
        setEvent(eventData);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching event details:', err);
      setError('Failed to load event details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
    }
  }, [eventId]);

  const handleCheckIn = async (registrationId) => {
    try {
      await checkInUser(registrationId);
      toast.success('Attendee checked in successfully');
      // Refresh registrations
      fetchEventDetails();
    } catch (err) {
      toast.error('Failed to check in attendee. Please try again.');
      console.error(err);
    }
  };
  
  const handleStatusChange = async (registrationId, newStatus) => {
    try {
      await updateRegistrationStatus(registrationId, newStatus);
      toast.success(`Registration status updated to ${newStatus}`);
      // Refresh registrations
      fetchEventDetails();
    } catch (err) {
      toast.error('Failed to update registration status. Please try again.');
      console.error(err);
    }
  };

  const handleQrScan = async (data) => {
    if (data) {
      try {
        // Close scanner after successful scan
        setShowScanner(false);
        
        // Check in using the QR code data
        await checkInUser(data);
        toast.success('Attendee checked in successfully via QR code');
        
        // Refresh registrations
        fetchEventDetails();
      } catch (err) {
        toast.error('Failed to check in attendee with QR code. Please try again.');
        console.error(err);
      }
    }
  };

  const handleQrError = (err) => {
    console.error(err);
    toast.error('QR scanner error. Please try again.');
  };

  const filteredRegistrations = registrations.filter(registration => {
    if (filterStatus === 'all') return true;
    return registration.status === filterStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error || 'Event not found'}</span>
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Registrations: {event.title}</h1>
        <div className="flex space-x-2">
          <Link
            to={`/admin/events/attendees/${eventId}`}
            className="bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
          >
            View Attendees
          </Link>
          <Link
            to="/admin/events"
            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
          >
            Back to Events
          </Link>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col">
            <div className="mb-2">
              <span className="text-gray-600 font-medium">Event Date:</span> {format(new Date(event.start_date), 'MMMM d, yyyy')}
            </div>
            <div className="mb-2">
              <span className="text-gray-600 font-medium">Location:</span> {event.location}
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-3">Registration Statistics:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{registrationStats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-indigo-600">{registrationStats.registered}</div>
                <div className="text-sm text-gray-600">Registered</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{registrationStats.attended}</div>
                <div className="text-sm text-gray-600">Attended</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{registrationStats.cancelled}</div>
                <div className="text-sm text-gray-600">Cancelled</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div className="flex space-x-2 mb-4 md:mb-0">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded ${
                filterStatus === 'all' 
                  ? 'bg-cvsu-green text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('registered')}
              className={`px-4 py-2 rounded ${
                filterStatus === 'registered' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Registered
            </button>
            <button
              onClick={() => setFilterStatus('attended')}
              className={`px-4 py-2 rounded ${
                filterStatus === 'attended' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Attended
            </button>
            <button
              onClick={() => setFilterStatus('cancelled')}
              className={`px-4 py-2 rounded ${
                filterStatus === 'cancelled' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Cancelled
            </button>
          </div>
          
          <button
            onClick={() => setShowScanner(!showScanner)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            {showScanner ? 'Close QR Scanner' : 'Scan QR Code'}
          </button>
        </div>
        
        {showScanner && (
          <div className="mb-4 max-w-md mx-auto">
            <div className="bg-white shadow-md rounded-lg p-4">
              <h3 className="text-lg font-medium mb-2 text-center">Scan Attendee QR Code</h3>
              <QrReader
                delay={300}
                onError={handleQrError}
                onScan={handleQrScan}
                style={{ width: '100%' }}
              />
              <p className="text-sm text-gray-500 mt-2 text-center">
                Position the QR code in the center of the camera view
              </p>
            </div>
          </div>
        )}
      </div>
      
      {filteredRegistrations.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-600">No registrations found with the selected filter.</p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attendee
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registration Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-in Time
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRegistrations.map((registration) => (
                <tr key={registration._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{registration.user_name}</div>
                    <div className="text-sm text-gray-500">{registration.user_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(new Date(registration.registration_date), 'MMM d, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      registration.status === 'attended' 
                        ? 'bg-green-100 text-green-800' 
                        : registration.status === 'cancelled' 
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {registration.check_in_time ? (
                      format(new Date(registration.check_in_time), 'MMM d, yyyy h:mm a')
                    ) : (
                      'Not checked in'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      {registration.status !== 'attended' && (
                        <button
                          onClick={() => handleCheckIn(registration._id)}
                          className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-3 rounded text-sm"
                        >
                          Check In
                        </button>
                      )}
                      
                      <select
                        value={registration.status}
                        onChange={(e) => handleStatusChange(registration._id, e.target.value)}
                        className="bg-white border border-gray-300 text-gray-700 py-1 px-3 rounded text-sm"
                      >
                        <option value="registered">Registered</option>
                        <option value="attended">Attended</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no-show">No Show</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-6">
        <Link
          to="/admin/events"
          className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
        >
          Back to Events
        </Link>
      </div>
    </div>
  );
};

export default EventRegistrationsPage; 