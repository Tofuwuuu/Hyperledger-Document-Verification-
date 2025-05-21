import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { getEventById, getEventRegistrations, updateRegistrationStatus, updateEvent } from '../../services/eventService';

const EventRegistrationsPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  
  // Function to export registrations to CSV
  const exportToCSV = () => {
    try {
      // Filter registrations based on current filter
      const dataToExport = filteredRegistrations;
      
      if (dataToExport.length === 0) {
        toast.warning('No registrations to export');
        return;
      }
      
      // Define CSV header row
      const headers = ['Name', 'Email', 'Student ID', 'Registration Date', 'Status', 'Check-in Time'];
      
      // Format the data
      const csvData = dataToExport.map(reg => {
        const checkInTime = reg.check_in_time ? 
          format(new Date(reg.check_in_time), 'MMM d, yyyy h:mm a') : 'Not checked in';
        
        return [
          reg.user_name || 'Unknown',
          reg.user_email || 'N/A',
          reg.user_student_id || reg.student_id || 'N/A',
          format(new Date(reg.registration_date), 'MMM d, yyyy'),
          reg.status.charAt(0).toUpperCase() + reg.status.slice(1),
          checkInTime
        ];
      });
      
      // Combine header and data
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n');
      
      // Create a Blob and link to download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      // Create filename with event name and date
      const eventName = event.title.replace(/\s+/g, '_');
      const today = format(new Date(), 'yyyy-MM-dd');
      link.setAttribute('download', `${eventName}_registrations_${today}.csv`);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Registration data exported to CSV');
    } catch (err) {
      console.error('Error exporting to CSV:', err);
      toast.error('Failed to export registrations. Please try again.');
    }
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
          <button
            onClick={exportToCSV}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
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
        </div>
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