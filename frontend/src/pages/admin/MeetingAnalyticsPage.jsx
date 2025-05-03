import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { format, parseISO, subDays } from 'date-fns';
import { ArrowLeftIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

const MeetingAnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('week'); // week, month, year
  const [analyticsData, setAnalyticsData] = useState({
    meetingCount: 0,
    participantCount: 0,
    averageDuration: 0,
    completionRate: 0,
    meetingsPerDay: [],
    participantsPerMeeting: [],
    meetingsByDuration: {
      labels: ['<30 min', '30-60 min', '1-2 hours', '>2 hours'],
      data: [0, 0, 0, 0]
    },
    topMeetings: []
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeframe]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // In a real application, this would be an API call
      // For demonstration purposes, we'll use mock data
      const response = await fetch(`/api/v1/admin/analytics/meetings?timeframe=${timeframe}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
      toast.error('Failed to load analytics data');
      
      // Simulate data for development purposes
      simulateMockData();
    } finally {
      setLoading(false);
    }
  };

  const simulateMockData = () => {
    // Generate dates for the last 7, 30, or 365 days based on timeframe
    const days = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 365;
    const meetingsPerDay = [];
    let totalMeetings = 0;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const count = Math.floor(Math.random() * 5) + 1; // 1-5 meetings per day
      totalMeetings += count;
      meetingsPerDay.push({
        date: format(date, 'yyyy-MM-dd'),
        count
      });
    }
    
    // Generate participant data for each meeting
    const participantsPerMeeting = Array.from({ length: totalMeetings }, () => ({
      meeting_id: `meeting-${Math.random().toString(36).substr(2, 9)}`,
      title: `Meeting ${Math.floor(Math.random() * 100)}`,
      participants: Math.floor(Math.random() * 20) + 5, // 5-25 participants
    }));
    
    // Sort by participants count to get top meetings
    const topMeetings = [...participantsPerMeeting]
      .sort((a, b) => b.participants - a.participants)
      .slice(0, 5);
    
    // Calculate meeting durations
    const durationBuckets = [0, 0, 0, 0]; // <30 min, 30-60 min, 1-2 hours, >2 hours
    
    participantsPerMeeting.forEach(() => {
      const duration = Math.floor(Math.random() * 180) + 15; // 15-195 minutes
      if (duration < 30) durationBuckets[0]++;
      else if (duration < 60) durationBuckets[1]++;
      else if (duration < 120) durationBuckets[2]++;
      else durationBuckets[3]++;
    });
    
    setAnalyticsData({
      meetingCount: totalMeetings,
      participantCount: participantsPerMeeting.reduce((sum, m) => sum + m.participants, 0),
      averageDuration: Math.floor(Math.random() * 60) + 30, // 30-90 minutes
      completionRate: Math.floor(Math.random() * 30) + 70, // 70-100%
      meetingsPerDay,
      participantsPerMeeting,
      meetingsByDuration: {
        labels: ['<30 min', '30-60 min', '1-2 hours', '>2 hours'],
        data: durationBuckets
      },
      topMeetings
    });
  };

  // Chart data for meetings per day
  const meetingsPerDayData = {
    labels: analyticsData.meetingsPerDay.map(d => {
      const date = parseISO(d.date);
      return format(date, timeframe === 'year' ? 'MMM yy' : 'MM/dd');
    }),
    datasets: [
      {
        label: 'Meetings',
        data: analyticsData.meetingsPerDay.map(d => d.count),
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1
      }
    ]
  };

  // Chart data for meeting durations
  const durationData = {
    labels: analyticsData.meetingsByDuration.labels,
    datasets: [
      {
        label: 'Meetings by Duration',
        data: analyticsData.meetingsByDuration.data,
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Meetings Over Time'
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Link 
          to="/admin/meetings" 
          className="inline-flex items-center text-indigo-600 hover:text-indigo-900"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Meetings
        </Link>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-purple-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">
                Meeting Analytics
              </h1>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setTimeframe('week')}
                className={`px-3 py-1 text-sm rounded-md ${
                  timeframe === 'week'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setTimeframe('month')}
                className={`px-3 py-1 text-sm rounded-md ${
                  timeframe === 'month'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setTimeframe('year')}
                className={`px-3 py-1 text-sm rounded-md ${
                  timeframe === 'year'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Year
              </button>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 mx-6 mt-4">
            <p>{error}</p>
          </div>
        )}
        
        <div className="p-6">
          {/* Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="text-xl font-semibold text-gray-700">Total Meetings</div>
              <div className="text-3xl font-bold text-indigo-600 mt-2">{analyticsData.meetingCount}</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="text-xl font-semibold text-gray-700">Total Participants</div>
              <div className="text-3xl font-bold text-indigo-600 mt-2">{analyticsData.participantCount}</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="text-xl font-semibold text-gray-700">Avg. Duration</div>
              <div className="text-3xl font-bold text-indigo-600 mt-2">{analyticsData.averageDuration} min</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="text-xl font-semibold text-gray-700">Completion Rate</div>
              <div className="text-3xl font-bold text-indigo-600 mt-2">{analyticsData.completionRate}%</div>
            </div>
          </div>
          
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Meetings Over Time</h3>
              <div className="h-72">
                <Bar data={meetingsPerDayData} options={chartOptions} />
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Meeting Durations</h3>
              <div className="h-72 flex justify-center">
                <Pie data={durationData} />
              </div>
            </div>
          </div>
          
          {/* Top Meetings Table */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Top 5 Meetings by Participants</h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Meeting Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participants
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analyticsData.topMeetings.map((meeting) => (
                    <tr key={meeting.meeting_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {meeting.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {meeting.participants}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link to={`/admin/meetings/${meeting.meeting_id}`} className="text-indigo-600 hover:text-indigo-900">
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {analyticsData.topMeetings.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No meeting data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingAnalyticsPage; 