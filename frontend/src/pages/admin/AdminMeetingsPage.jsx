import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import meetingService from '../../services/meetingService';
import { Tab } from '@headlessui/react';
import {
  VideoCameraIcon,
  CalendarIcon,
  ClockIcon, 
  UserGroupIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const AdminMeetingsPage = () => {
  const [meetings, setMeetings] = useState({
    all: [],
    active: [],
    scheduled: [],
    completed: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // Key to force refresh
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Fetch all meetings - in a real app, this would use a dedicated admin endpoint
  const fetchAllMeetings = async () => {
    setLoading(true);
    try {
      // This is a simulated call - in a real implementation, you'd have an admin-specific endpoint
      // that returns all meetings across all events
      const events = await fetch('/api/v1/events').then(res => res.json());
      
      const allMeetings = [];
      
      // For each event, get its meetings
      for (const event of events) {
        try {
          const response = await meetingService.getEventMeetings(event._id);
          if (response.data && Array.isArray(response.data)) {
            // Add event title to each meeting for better context
            const eventMeetings = response.data.map(meeting => ({
              ...meeting,
              event_title: event.title
            }));
            allMeetings.push(...eventMeetings);
          }
        } catch (err) {
          console.error(`Failed to fetch meetings for event ${event._id}:`, err);
        }
      }
      
      // Filter meetings into different categories
      const activeMeetings = allMeetings.filter(m => m.status === 'active');
      const scheduledMeetings = allMeetings.filter(m => m.status === 'scheduled');
      const completedMeetings = allMeetings.filter(m => m.status === 'completed' || m.status === 'cancelled');
      
      setMeetings({
        all: allMeetings,
        active: activeMeetings,
        scheduled: scheduledMeetings,
        completed: completedMeetings
      });
      
    } catch (err) {
      console.error('Error fetching meetings:', err);
      setError('Failed to load meetings. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMeetings();
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  const handleDeleteClick = (meeting) => {
    setMeetingToDelete(meeting);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!meetingToDelete) return;
    
    try {
      // In a real implementation, you'd call an API to delete the meeting
      await fetch(`/api/v1/meetings/${meetingToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('Meeting deleted successfully');
      handleRefresh();
    } catch (err) {
      console.error('Error deleting meeting:', err);
      toast.error('Failed to delete meeting');
    } finally {
      setShowDeleteModal(false);
      setMeetingToDelete(null);
    }
  };

  const handleShowAnalytics = async (meetingId) => {
    try {
      // This would be a real API call in a complete implementation
      const response = await fetch(`/api/v1/meetings/${meetingId}/analytics`);
      const data = await response.json();
      
      setAnalyticsData(data);
      setShowAnalyticsModal(true);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      toast.error('Failed to load analytics data');
    }
  };

  const renderMeetingsList = (meetingsList) => {
    if (meetingsList.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">No meetings found in this category</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Meeting
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Participants
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {meetingsList.map((meeting) => (
              <tr key={meeting._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-purple-100 rounded-md flex items-center justify-center">
                      <VideoCameraIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{meeting.title}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {meeting.description || 'No description'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{meeting.event_title}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {meetingService.formatMeetingDate(meeting.start_time)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Duration: {meeting.duration} minutes
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    meeting.status === 'active' ? 'bg-green-100 text-green-800' : 
                    meeting.status === 'scheduled' ? 'bg-blue-100 text-blue-800' : 
                    meeting.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {meetingService.getMeetingStatusText(meeting.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <UserGroupIcon className="h-4 w-4 mr-1 text-gray-400" />
                    {meeting.participants?.length || 0} participants
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    {meeting.status === 'active' && (
                      <button 
                        onClick={() => window.open(`/meetings/join/${meeting._id}`, '_blank')}
                        className="text-green-600 hover:text-green-900 flex items-center"
                      >
                        <span>Join</span>
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleShowAnalytics(meeting._id)}
                      className="text-blue-600 hover:text-blue-900 flex items-center"
                    >
                      <ChartBarIcon className="h-4 w-4 mr-1" />
                      <span>Analytics</span>
                    </button>
                    
                    <Link
                      to={`/admin/meetings/edit/${meeting._id}`}
                      className="text-indigo-600 hover:text-indigo-900 flex items-center"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      <span>Edit</span>
                    </Link>
                    
                    <button 
                      onClick={() => handleDeleteClick(meeting)}
                      className="text-red-600 hover:text-red-900 flex items-center"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      <span>Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading && Object.values(meetings).every(arr => arr.length === 0)) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meeting Management</h1>
        <div className="flex space-x-4">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </button>
          
          <Link
            to="/admin/meetings/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <VideoCameraIcon className="h-4 w-4 mr-2" />
            Create Meeting
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg leading-6 font-medium text-gray-900">Meeting Statistics</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Overview of all virtual meetings</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                    <VideoCameraIcon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Meetings</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">{meetings.all.length}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                    <CalendarIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Meetings</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">{meetings.active.length}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                    <ClockIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Scheduled Meetings</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">{meetings.scheduled.length}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                    <UserGroupIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Participants</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {meetings.all.reduce((total, meeting) => 
                            total + (meeting.participants?.length || 0), 0)}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tab.Group>
        <Tab.List className="flex p-1 space-x-1 bg-blue-50 rounded-xl mb-6">
          <Tab
            className={({ selected }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60 ${
                selected
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-blue-500 hover:bg-white/[0.12] hover:text-blue-700'
              }`
            }
          >
            All Meetings ({meetings.all.length})
          </Tab>
          <Tab
            className={({ selected }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60 ${
                selected
                  ? 'bg-white text-green-700 shadow'
                  : 'text-green-500 hover:bg-white/[0.12] hover:text-green-700'
              }`
            }
          >
            Active ({meetings.active.length})
          </Tab>
          <Tab
            className={({ selected }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60 ${
                selected
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-blue-500 hover:bg-white/[0.12] hover:text-blue-700'
              }`
            }
          >
            Scheduled ({meetings.scheduled.length})
          </Tab>
          <Tab
            className={({ selected }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60 ${
                selected
                  ? 'bg-white text-gray-700 shadow'
                  : 'text-gray-500 hover:bg-white/[0.12] hover:text-gray-700'
              }`
            }
          >
            Completed ({meetings.completed.length})
          </Tab>
        </Tab.List>
        <Tab.Panels className="bg-white shadow overflow-hidden rounded-lg">
          <Tab.Panel>{renderMeetingsList(meetings.all)}</Tab.Panel>
          <Tab.Panel>{renderMeetingsList(meetings.active)}</Tab.Panel>
          <Tab.Panel>{renderMeetingsList(meetings.scheduled)}</Tab.Panel>
          <Tab.Panel>{renderMeetingsList(meetings.completed)}</Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <TrashIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Meeting</h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete this meeting? This action cannot be undone.
                        {meetingToDelete && (
                          <span className="block font-medium mt-1">
                            "{meetingToDelete.title}" on {meetingService.formatMeetingDate(meetingToDelete.start_time)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button" 
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={confirmDelete}
                >
                  Delete
                </button>
                <button 
                  type="button" 
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && analyticsData && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Meeting Analytics</h3>
                  <button
                    type="button"
                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={() => setShowAnalyticsModal(false)}
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-500">Total Participants</h4>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{analyticsData.totalParticipants}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-500">Average Duration</h4>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{analyticsData.averageDurationMinutes} min</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-500">Maximum Concurrent Users</h4>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{analyticsData.maxConcurrentUsers}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-500">Recordings</h4>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{analyticsData.recordingsCount}</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Participant Timeline</h4>
                  <div className="bg-gray-50 p-4 rounded-lg h-48 flex items-center justify-center">
                    <p className="text-gray-500">Timeline visualization would go here</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Top Participants</h4>
                  <ul className="divide-y divide-gray-200 bg-gray-50 rounded-lg">
                    {analyticsData.topParticipants.map((participant, index) => (
                      <li key={index} className="px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 text-sm font-medium">{participant.name.charAt(0)}</span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">{participant.name}</p>
                            <p className="text-sm text-gray-500">{participant.email}</p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">{participant.durationMinutes} minutes</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button" 
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowAnalyticsModal(false)}
                >
                  Close
                </button>
                <button 
                  type="button" 
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    // In a real implementation, this would download a CSV or PDF report
                    toast.info('Analytics report download would start here');
                  }}
                >
                  Export Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMeetingsPage; 