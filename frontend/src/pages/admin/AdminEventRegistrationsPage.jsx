import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { getAllEventRegistrations, checkInUser, updateRegistrationStatus } from '../../services/eventService';

const AdminEventRegistrationsPage = () => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [registrationStats, setRegistrationStats] = useState({
    total: 0,
    registered: 0,
    attended: 0,
    cancelled: 0
  });

  const calculateRegistrationStats = (registrations) => {
    console.log("Calculating stats for registrations:", registrations);
    
    // Default to 0 for all stats
    let stats = {
      total: 0,
      registered: 0,
      attended: 0,
      cancelled: 0
    };
    
    // Only process if we have valid registrations array
    if (Array.isArray(registrations) && registrations.length > 0) {
      stats.total = registrations.length;
      
      // Count each status
      registrations.forEach(reg => {
        const status = reg.status?.toLowerCase() || 'registered'; // Default to registered if status is missing
        
        if (status === 'registered') {
          stats.registered++;
        } else if (status === 'attended') {
          stats.attended++;
        } else if (status === 'cancelled') {
          stats.cancelled++;
        } else {
          console.warn(`Unknown registration status: ${status}`);
          // Count unknown statuses as registered for the total count
          stats.registered++;
        }
      });
      
      console.log("Calculated registration stats:", stats);
    } else {
      console.warn("No registrations found or invalid registrations data:", registrations);
    }
    
    return stats;
  };

  const fetchRegistrations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log("Fetching event registrations...");
      const data = await getAllEventRegistrations();
      console.log("Registrations data received:", data);
      
      // Ensure we have a valid array of registrations
      if (Array.isArray(data)) {
        setRegistrations(data);
        setRegistrationStats(calculateRegistrationStats(data));
      } else {
        console.error("API did not return a valid array for registrations");
        setRegistrations([]);
        setRegistrationStats({
          total: 0,
          registered: 0,
          attended: 0,
          cancelled: 0
        });
        setError("Failed to load registrations. API returned invalid data format.");
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error fetching registrations:", err);
      setError("Failed to load registrations. Please try again.");
      setLoading(false);
      
      // Even on error, initialize stats to prevent UI from showing NaN
      setRegistrationStats({
        total: 0,
        registered: 0,
        attended: 0,
        cancelled: 0
      });
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const handleCheckIn = async (registrationId) => {
    try {
      await checkInUser(registrationId);
      toast.success('Attendee checked in successfully');
      // Refresh registrations list
      fetchRegistrations();
    } catch (err) {
      toast.error('Failed to check in attendee. Please try again later.');
      console.error(err);
    }
  };
  
  const handleStatusChange = async (registrationId, newStatus) => {
    try {
      await updateRegistrationStatus(registrationId, newStatus);
      toast.success(`Registration status updated to ${newStatus}`);
      // Refresh registrations list
      fetchRegistrations();
    } catch (err) {
      toast.error('Failed to update registration status. Please try again later.');
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
      const headers = ['Event', 'Name', 'Email', 'Student ID', 'Registration Date', 'Status', 'Check-in Time'];
      
      // Format the data
      const csvData = dataToExport.map(reg => {
        const checkInTime = reg.check_in_time ? 
          format(new Date(reg.check_in_time), 'MMM d, yyyy h:mm a') : 'Not checked in';
        
        return [
          `"${(reg.event_title || 'Unknown Event').replace(/"/g, '""')}"`,
          `"${(reg.user_name || 'Unknown').replace(/"/g, '""')}"`,
          `"${(reg.user_email || 'N/A').replace(/"/g, '""')}"`,
          `"${(reg.user_student_id || 'N/A').replace(/"/g, '""')}"`,
          format(new Date(reg.registration_date), 'MMM d, yyyy'),
          reg.status.charAt(0).toUpperCase() + reg.status.slice(1),
          `"${checkInTime}"`
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
      
      // Create filename with date
      const today = format(new Date(), 'yyyy-MM-dd');
      link.setAttribute('download', `event_registrations_${today}.csv`);
      
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
    // Validate the registration object has required properties
    if (!registration || typeof registration !== 'object') {
      console.warn('Invalid registration object found:', registration);
      return false;
    }
    
    // Skip registrations without a status if filter is not 'all'
    if (filterStatus !== 'all' && !registration.status) {
      console.warn('Registration missing status:', registration);
      return false;
    }
    
    // Apply status filter
    if (filterStatus === 'all') return true;
    
    // Case-insensitive status comparison
    return registration.status?.toLowerCase() === filterStatus.toLowerCase();
  });

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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">All Event Registrations</h1>
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
          <button
            onClick={() => {
              // Redirect to all events page
              window.location.href = '/admin/events';
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            Go to Events
          </button>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-4 mb-6">
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
      
      <div className="mb-6">
        <div className="flex space-x-2 mb-4">
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
      
      {filteredRegistrations.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-600 mb-4">No registrations found with the selected filter.</p>
          <button 
            onClick={fetchRegistrations}
            className="bg-cvsu-green hover:bg-green-700 text-white py-2 px-4 rounded focus:outline-none"
          >
            Refresh Data
          </button>
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
                  Attendee
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registration Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-in
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
                    <Link to={`/admin/events/attendees/${registration.event_id}`} className="text-blue-600 hover:underline">
                      {registration.event_title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {registration.user_name && registration.user_name !== "Unknown User" 
                        ? registration.user_name 
                        : registration.user_email || "Unknown User"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {registration.user_email && <div>{registration.user_email}</div>}
                      {registration.user_student_id && <div>ID: {registration.user_student_id}</div>}
                    </div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <div className="relative inline-block text-left">
                        <select
                          value={registration.status}
                          onChange={(e) => handleStatusChange(registration._id, e.target.value)}
                          className="rounded border border-gray-300 text-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cvsu-green"
                        >
                          <option value="registered">Registered</option>
                          <option value="attended">Attended</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminEventRegistrationsPage; 