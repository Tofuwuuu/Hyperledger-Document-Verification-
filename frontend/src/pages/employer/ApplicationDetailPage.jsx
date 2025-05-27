import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { API_URL } from '../../services/api';

const ApplicationDetailPage = () => {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchApplicationDetails();
  }, [applicationId]);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      const response = await axios.get(`${API_URL}/recruitment/applications/${applicationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setApplication(response.data);
      setNotes(response.data.employer_notes || '');
      
      // Fetch job details
      if (response.data.job_id) {
        try {
          const jobResponse = await axios.get(`${API_URL}/recruitment/jobs/${response.data.job_id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          setJobDetails(jobResponse.data);
        } catch (jobError) {
          console.error('Error fetching job details:', jobError);
        }
      }
    } catch (error) {
      console.error('Error fetching application details:', error);
      
      if (error.response?.status === 404) {
        toast.error('Application not found');
        navigate('/employer/recruitment');
      } else {
        toast.error('Failed to load application details');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (newStatus) => {
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
      
      // Update local state
      setApplication(prev => ({ ...prev, status: newStatus }));
    } catch (error) {
      console.error('Error updating application status:', error);
      toast.error('Failed to update application status');
    }
  };

  const updateNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      await axios.put(
        `${API_URL}/recruitment/applications/${applicationId}`,
        { employer_notes: notes },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      toast.success('Notes updated successfully');
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Failed to update notes');
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cvsu-green"></div>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Application Not Found</h1>
          <p>The application you are looking for does not exist or you don't have permission to view it.</p>
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
          <h1 className="text-2xl font-bold text-gray-800">Application Details</h1>
          <div className="flex space-x-2">
            <button 
              onClick={() => navigate(`/employer/applications/${application.job_id}`)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded"
            >
              Back to Applications
            </button>
            <button 
              onClick={() => navigate('/employer/recruitment')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded"
            >
              Back to Recruitment
            </button>
          </div>
        </div>

        {/* Job Information */}
        {jobDetails && (
          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <h2 className="text-xl font-semibold mb-2">{jobDetails.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium">{jobDetails.location}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium capitalize">{jobDetails.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Posted</p>
                <p className="font-medium">{format(new Date(jobDetails.created_at), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Applicant Information */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Applicant Information</h2>
          <div className="bg-white border rounded-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{application.applicant_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{application.applicant_email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Applied On</p>
                <p className="font-medium">{format(new Date(application.created_at), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <div className="flex items-center mt-1">
                  <select
                    value={application.status}
                    onChange={(e) => updateApplicationStatus(e.target.value)}
                    className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeClass(application.status)}`}
                  >
                    <option value="applied">Applied</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="interviewed">Interviewed</option>
                    <option value="offered">Offered</option>
                    <option value="hired">Hired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cover Letter */}
        {application.cover_letter && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Cover Letter</h2>
            <div className="bg-white border rounded-md p-4 whitespace-pre-line">
              {application.cover_letter}
            </div>
          </div>
        )}

        {/* Resume */}
        {application.resume_url && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Resume</h2>
            <div className="bg-white border rounded-md p-4">
              <a 
                href={`${application.resume_url.startsWith('http') ? '' : API_URL}${application.resume_url}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-cvsu-green hover:underline flex items-center"
              >
                <span className="mr-2">View Resume</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* Employer Notes */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Notes</h2>
          <div className="bg-white border rounded-md p-4">
            <textarea
              className="w-full p-2 border rounded-md"
              rows={4}
              placeholder="Add notes about this applicant here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
            <div className="mt-2 flex justify-end">
              <button
                onClick={updateNotes}
                className="bg-cvsu-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationDetailPage; 