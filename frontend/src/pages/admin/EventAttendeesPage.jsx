import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  getEventAttendees,
  checkInUser, 
  updateRegistrationStatus 
} from '../../services/eventService';
import axios from 'axios';
import { API_URL } from '../../config';
import { 
  DocumentCheckIcon, 
  UserGroupIcon, 
  ChevronLeftIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const EventAttendeesPage = () => {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [statistics, setStatistics] = useState({
    total: 0,
    attended: 0,
    registered: 0,
    cancelled: 0,
    attendance_rate: 0
  });
  const [attendees, setAttendees] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('user_name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  useEffect(() => {
    fetchEventAttendees();
    
    // Set up automatic refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing attendee data...');
      fetchEventAttendees(false); // Pass false to avoid showing loading indicator
    }, 30000); // 30 seconds
    
    // Clean up interval on component unmount
    return () => clearInterval(refreshInterval);
  }, [eventId]);

  const fetchEventAttendees = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const data = await getEventAttendees(eventId);
      
      setEventData(data.event);
      setStatistics(data.statistics);
      setAttendees(data.attendees);
      setLastRefreshTime(new Date());
      
      if (showLoading) {
        setLoading(false);
      }
    } catch (err) {
      console.error("Error fetching event attendees:", err);
      setError("Failed to load event attendees. Please try again.");
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleCheckIn = async (registrationId) => {
    try {
      await checkInUser(registrationId);
      toast.success('Attendee checked in successfully');
      fetchEventAttendees(); // Refresh data
    } catch (err) {
      toast.error('Failed to check in attendee');
      console.error(err);
    }
  };

  const handleStatusChange = async (registrationId, newStatus) => {
    try {
      await updateRegistrationStatus(registrationId, newStatus);
      toast.success(`Status updated to ${newStatus}`);
      fetchEventAttendees(); // Refresh data
    } catch (err) {
      toast.error('Failed to update status');
      console.error(err);
    }
  };

  const handleBatchCheckIn = async () => {
    if (selectedAttendees.length === 0) {
      toast.warning('Please select attendees to check in');
      return;
    }

    try {
      setLoading(true);
      
      // Process attendees one by one
      for (const attendeeId of selectedAttendees) {
        await checkInUser(attendeeId);
      }
      
      toast.success(`${selectedAttendees.length} attendees checked in successfully`);
      setSelectedAttendees([]); // Clear selection
      fetchEventAttendees(); // Refresh data
    } catch (err) {
      toast.error('Failed to check in some attendees');
      console.error(err);
      setLoading(false);
    }
  };

  const handleSelectAttendee = (attendeeId) => {
    if (selectedAttendees.includes(attendeeId)) {
      setSelectedAttendees(selectedAttendees.filter(id => id !== attendeeId));
    } else {
      setSelectedAttendees([...selectedAttendees, attendeeId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedAttendees.length === filteredAttendees.length) {
      setSelectedAttendees([]); // Deselect all
    } else {
      setSelectedAttendees(filteredAttendees.map(a => a._id)); // Select all
    }
  };

  const exportToCsv = () => {
    if (attendees.length === 0) {
      toast.warning('No data to export');
      return;
    }

    // Create CSV content
    const headers = [
      'Name', 'Email', 'Student ID', 'Department', 'Status', 
      'Registration Date', 'Check-in Time'
    ];
    
    const csvRows = [
      headers.join(','),
      ...filteredAttendees.map(a => {
        return [
          `"${a.user_name.replace(/"/g, '""')}"`,
          `"${a.user_email.replace(/"/g, '""')}"`,
          `"${a.user_student_id || ''}"`,
          `"${a.user_department || ''}"`,
          `"${a.status || 'registered'}"`,
          `"${a.registration_date_formatted || ''}"`,
          `"${a.check_in_time_formatted || ''}"`,
        ].join(',');
      })
    ];
    
    const csvContent = csvRows.join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${eventData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_attendees.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort and filter attendees
  const getFilteredAndSortedAttendees = () => {
    // Filter by status and search query
    let filtered = [...attendees];
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === filterStatus);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => {
        return (
          (a.user_name && a.user_name.toLowerCase().includes(query)) ||
          (a.user_email && a.user_email.toLowerCase().includes(query)) ||
          (a.user_student_id && a.user_student_id.toLowerCase().includes(query)) ||
          (a.user_department && a.user_department.toLowerCase().includes(query))
        );
      });
    }
    
    // Sort attendees
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle undefined values
      if (aValue === undefined) aValue = '';
      if (bValue === undefined) bValue = '';
      
      // For string values, use localeCompare
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      // For non-string values, use comparison operators
      return sortDirection === 'asc' 
        ? (aValue > bValue ? 1 : -1)
        : (aValue < bValue ? 1 : -1);
    });
    
    return filtered;
  };

  const filteredAttendees = getFilteredAndSortedAttendees();

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort indicator arrow
  const getSortIndicator = (field) => {
    if (sortField !== field) return null;
    
    return sortDirection === 'asc' 
      ? <span className="ml-1">↑</span>
      : <span className="ml-1">↓</span>;
  };

  // Add this before the return statement
  const formatLastRefreshTime = () => {
    return lastRefreshTime.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <h2 className="font-bold text-lg mb-2">Error</h2>
          <p>{error}</p>
          <button 
            onClick={fetchEventAttendees}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header & Navigation */}
      <div className="mb-6">
        <Link 
          to="/admin/events" 
          className="text-blue-600 hover:text-blue-800 flex items-center mb-2"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back to Events
        </Link>
        <h1 className="text-2xl font-bold mb-1">{eventData?.title}</h1>
        <p className="text-gray-500">
          {eventData?.start_date && new Date(eventData.start_date).toLocaleDateString()} | {eventData?.location}
        </p>
      </div>
      
      {/* Statistics */}
      <div className="bg-white shadow-md rounded-lg p-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Attendance Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{statistics.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-indigo-600">{statistics.registered}</div>
              <div className="text-sm text-gray-600">Registered</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{statistics.attended}</div>
              <div className="text-sm text-gray-600">Attended</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{statistics.cancelled}</div>
              <div className="text-sm text-gray-600">Cancelled</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">{statistics.attendance_rate}%</div>
              <div className="text-sm text-gray-600">Attendance Rate</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
        <div className="flex flex-wrap gap-2">
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
        
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search attendees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cvsu-green"
          />
          
          <button
            onClick={exportToCsv}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-1" />
            Export CSV
          </button>
          
          {selectedAttendees.length > 0 && (
            <button
              onClick={handleBatchCheckIn}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
            >
              <DocumentCheckIcon className="h-5 w-5 mr-1" />
              Check In ({selectedAttendees.length})
            </button>
          )}
        </div>
      </div>
      
      {/* Render action buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          to={`/admin/events/registrations/${eventId}`}
          className="flex items-center px-4 py-2 rounded font-medium bg-gray-600 hover:bg-gray-700 text-white"
        >
          <UserGroupIcon className="h-5 w-5 mr-2" />
          Registrations
        </Link>
        
        <Link
          to="/admin/events"
          className="flex items-center px-4 py-2 rounded font-medium bg-gray-500 hover:bg-gray-600 text-white"
        >
          <ChevronLeftIcon className="h-5 w-5 mr-2" />
          Back to Events
        </Link>
        
        <span className="text-xs text-gray-500 self-center ml-2">
          Last refreshed: {formatLastRefreshTime()}
        </span>
      </div>
      
      {/* Attendees Table */}
      {filteredAttendees.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No attendees found</h3>
          <p className="mt-1 text-gray-500">
            {searchQuery ? "Try a different search term" : "There are no attendees in this category"}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedAttendees.length === filteredAttendees.length && filteredAttendees.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                    />
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => toggleSort('user_name')}
                >
                  <span className="flex items-center">
                    Attendee {getSortIndicator('user_name')}
                  </span>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => toggleSort('user_student_id')}
                >
                  <span className="flex items-center">
                    Student ID {getSortIndicator('user_student_id')}
                  </span>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => toggleSort('user_department')}
                >
                  <span className="flex items-center">
                    Department {getSortIndicator('user_department')}
                  </span>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => toggleSort('status')}
                >
                  <span className="flex items-center">
                    Status {getSortIndicator('status')}
                  </span>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => toggleSort('registration_date')}
                >
                  <span className="flex items-center">
                    Registration {getSortIndicator('registration_date')}
                  </span>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => toggleSort('check_in_time')}
                >
                  <span className="flex items-center">
                    Check-in {getSortIndicator('check_in_time')}
                  </span>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAttendees.map((attendee) => (
                <tr key={attendee._id} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedAttendees.includes(attendee._id)}
                      onChange={() => handleSelectAttendee(attendee._id)}
                      className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {attendee.user_profile_pic ? (
                          <img 
                            className="h-10 w-10 rounded-full" 
                            src={attendee.user_profile_pic} 
                            alt={attendee.user_name} 
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                            {attendee.user_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {attendee.user_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {attendee.user_email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{attendee.user_student_id || "—"}</div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{attendee.user_department || "—"}</div>
                    {attendee.user_year_level && (
                      <div className="text-xs text-gray-500">Year {attendee.user_year_level}</div>
                    )}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      attendee.status === 'attended' 
                        ? 'bg-green-100 text-green-800' 
                        : attendee.status === 'cancelled' 
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {attendee.status?.charAt(0).toUpperCase() + attendee.status?.slice(1) || "Registered"}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {attendee.registration_date_formatted || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {attendee.check_in_time_formatted || "Not checked in"}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex space-x-2">
                      {attendee.status !== 'attended' && (
                        <button
                          onClick={() => handleCheckIn(attendee._id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Check In
                        </button>
                      )}
                      <div className="relative inline-block text-left">
                        <select
                          value={attendee.status || 'registered'}
                          onChange={(e) => handleStatusChange(attendee._id, e.target.value)}
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

export default EventAttendeesPage; 