import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { API_URL } from '../../services/api';
import { Tabs, Tab } from '../../components/Tabs';
import { 
  BriefcaseIcon, 
  UserGroupIcon, 
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

const AdminRecruitmentPage = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('applications');
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalApplications: 0,
    pendingApplications: 0,
    approvedApplications: 0,
    rejectedApplications: 0,
    totalJobs: 0,
    activeJobs: 0
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    
    if (activeTab === 'applications') {
      await fetchApplications();
    } else if (activeTab === 'jobs') {
      await fetchJobs();
    }
    
    await fetchStats();
    setLoading(false);
  };

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      const response = await axios.get(`${API_URL}/recruitment/applications/admin`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setApplications(response.data);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load job applications');
    }
  };

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      const response = await axios.get(`${API_URL}/recruitment/jobs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setJobs(response.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      const response = await axios.get(`${API_URL}/recruitment/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Don't show error toast for stats
    } finally {
      setStatsLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId, status) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      await axios.put(
        `${API_URL}/recruitment/applications/${applicationId}/status`, 
        { status },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      toast.success(`Application status updated to ${status}`);
      
      // Refresh data
      fetchApplications();
      fetchStats();
    } catch (error) {
      console.error('Error updating application status:', error);
      toast.error('Failed to update application status');
    }
  };

  // Function to render the status badge with appropriate color
  const renderStatusBadge = (status) => {
    const statusColors = {
      applied: 'bg-blue-100 text-blue-800',
      reviewing: 'bg-yellow-100 text-yellow-800',
      shortlisted: 'bg-indigo-100 text-indigo-800',
      interviewed: 'bg-purple-100 text-purple-800',
      offered: 'bg-pink-100 text-pink-800',
      hired: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Recruitment Management</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center mb-2">
            <DocumentTextIcon className="h-5 w-5 text-blue-500 mr-2" />
            <h3 className="font-medium text-gray-700">Applications</h3>
          </div>
          <div className="flex justify-between">
            <p className="text-2xl font-bold text-gray-900">{statsLoading ? '...' : stats.totalApplications}</p>
            <div>
              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                {statsLoading ? '...' : stats.pendingApplications} pending
              </span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center mb-2">
            <BriefcaseIcon className="h-5 w-5 text-green-500 mr-2" />
            <h3 className="font-medium text-gray-700">Active Jobs</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{statsLoading ? '...' : stats.activeJobs}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center mb-2">
            <UserGroupIcon className="h-5 w-5 text-purple-500 mr-2" />
            <h3 className="font-medium text-gray-700">Hired Candidates</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{statsLoading ? '...' : stats.approvedApplications}</p>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <Tab id="applications" label="Applications">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cvsu-green"></div>
            </div>
          ) : applications.length > 0 ? (
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills Match</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {applications.map((application) => (
                      <tr key={application.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{application.alumni_name}</div>
                          <div className="text-xs text-gray-500">{application.alumni_email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{application.job_title}</div>
                          <div className="text-xs text-gray-500">{application.company_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {application.skill_match_score ? (
                            <div className="flex items-center">
                              <div className={`text-xs px-2 py-1 rounded-full ${
                                application.skill_match_score > 70 ? 'bg-green-100 text-green-800' :
                                application.skill_match_score > 40 ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {application.skill_match_score}% match
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">No data</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{format(new Date(application.created_at), 'MMM d, yyyy')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {renderStatusBadge(application.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex space-x-2">
                            {application.status !== 'hired' && (
                              <button
                                onClick={() => updateApplicationStatus(application.id, 'hired')}
                                className="text-green-600 hover:text-green-900"
                                title="Mark as hired"
                              >
                                <CheckCircleIcon className="h-5 w-5" />
                              </button>
                            )}
                            
                            {application.status !== 'rejected' && (
                              <button
                                onClick={() => updateApplicationStatus(application.id, 'rejected')}
                                className="text-red-600 hover:text-red-900"
                                title="Reject application"
                              >
                                <XCircleIcon className="h-5 w-5" />
                              </button>
                            )}
                            
                            <button
                              onClick={() => {
                                const newStatus = application.status === 'applied' ? 'reviewing' :
                                  application.status === 'reviewing' ? 'shortlisted' :
                                  application.status === 'shortlisted' ? 'interviewed' :
                                  application.status === 'interviewed' ? 'offered' :
                                  application.status === 'offered' ? 'hired' : 'applied';
                                
                                updateApplicationStatus(application.id, newStatus);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                              title="Advance to next stage"
                            >
                              Next Stage
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <p className="text-gray-600">No job applications found.</p>
            </div>
          )}
        </Tab>
        
        <Tab id="jobs" label="Jobs">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cvsu-green"></div>
            </div>
          ) : jobs.length > 0 ? (
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applications</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posted Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {jobs.map((job) => (
                      <tr key={job.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{job.title}</div>
                          <div className="text-xs text-gray-500">
                            {job.employment_type === 'full-time' ? 'Full time' : 
                             job.employment_type === 'part-time' ? 'Part time' : 
                             job.employment_type === 'contract' ? 'Contract' : 
                             job.employment_type === 'internship' ? 'Internship' : 
                             job.employment_type}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{job.company_name}</div>
                          <div className="text-xs text-gray-500">{job.location}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {job.skills && job.skills.map((skill, index) => (
                              <span key={index} className="px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-800 mb-1">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900">{job.applicant_count || 0}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            job.status === 'active' ? 'bg-green-100 text-green-800' : 
                            job.status === 'filled' ? 'bg-blue-100 text-blue-800' : 
                            job.status === 'closed' ? 'bg-red-100 text-red-800' : 
                            job.status === 'archived' ? 'bg-gray-300 text-gray-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{format(new Date(job.created_at), 'MMM d, yyyy')}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <p className="text-gray-600">No jobs found.</p>
            </div>
          )}
        </Tab>
      </Tabs>
    </div>
  );
};

export default AdminRecruitmentPage; 