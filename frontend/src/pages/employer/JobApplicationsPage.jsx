import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { API_URL } from '../../services/api';

const JobApplicationsPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    fetchJobDetails();
    fetchApplications();
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      const response = await axios.get(`${API_URL}/recruitment/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setJob(response.data);
    } catch (error) {
      console.error('Error fetching job details:', error);
      
      if (error.response?.status === 404) {
        toast.error('Job not found');
        navigate('/employer/recruitment');
      } else {
        toast.error('Failed to load job details');
      }
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      const response = await axios.get(`${API_URL}/recruitment/applications?job_id=${jobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setApplications(response.data);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      await axios.put(
        `${API_URL}/recruitment/applications/${applicationId}`,
        { status: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      toast.success(`Application status updated to ${newStatus}`);
      
      // Update local state to avoid refetching
      setApplications(applications.map(app => 
        app.id === applicationId ? { ...app, status: newStatus } : app
      ));
    } catch (error) {
      console.error('Error updating application status:', error);
      toast.error('Failed to update application status');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'applied':
        return 'bg-blue-100 text-blue-800';
      case 'reviewing':
        return 'bg-yellow-100 text-yellow-800';
      case 'shortlisted':
        return 'bg-indigo-100 text-indigo-800';
      case 'interviewed':
        return 'bg-purple-100 text-purple-800';
      case 'offered':
        return 'bg-pink-100 text-pink-800';
      case 'hired':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!job && !loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Job Not Found</h1>
          <p>The job you are looking for does not exist or you don't have permission to view it.</p>
          <button 
            onClick={() => navigate('/employer/recruitment')}
            className="mt-4 bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
          >
            Back to Recruitment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Applications</h1>
          <button 
            onClick={() => navigate('/employer/recruitment')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded"
          >
            Back to Recruitment
          </button>
        </div>

        {job && (
          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <h2 className="text-xl font-semibold mb-2">{job.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium">{job.location}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium capitalize">{job.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Posted</p>
                <p className="font-medium">{format(new Date(job.created_at), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cvsu-green"></div>
          </div>
        ) : applications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied On</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {applications.map((application) => (
                  <tr key={application.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{application.applicant_name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{application.applicant_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {format(new Date(application.created_at), 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={application.status}
                        onChange={(e) => updateApplicationStatus(application.id, e.target.value)}
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(application.status)}`}
                      >
                        <option value="applied">Applied</option>
                        <option value="reviewing">Reviewing</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="interviewed">Interviewed</option>
                        <option value="offered">Offered</option>
                        <option value="hired">Hired</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/employer/applications/detail/${application.id}`)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border rounded-md p-8 bg-gray-50 text-center">
            <p className="text-gray-600 mb-4">No applications received yet for this job.</p>
            <p className="text-sm text-gray-500">
              Applications will appear here once candidates apply for this position.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobApplicationsPage; 