import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { API_URL } from '../../services/api';
import { BriefcaseIcon, CheckCircleIcon, FunnelIcon } from '@heroicons/react/24/outline';

const RecruitmentPage = () => {
  const { currentUser, authToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [applyingToJobId, setApplyingToJobId] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alumniSkills, setAlumniSkills] = useState([]);
  const [showOnlyMatching, setShowOnlyMatching] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);

  useEffect(() => {
    fetchJobs();
    fetchMyApplications();
    fetchAlumniProfile();
  }, []);
  
  // Fetch alumni profile to get skills
  const fetchAlumniProfile = async () => {
    try {
      setFetchingProfile(true);
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      const userId = currentUser.id || currentUser._id;
      const response = await axios.get(`${API_URL}/alumni/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const alumniData = response.data;
      
      // Parse skills from profile
      let skills = [];
      
      // Extract skills from the skills text field (comma-separated)
      if (alumniData.skills && typeof alumniData.skills === 'string') {
        skills = alumniData.skills.split(',').map(skill => skill.trim().toLowerCase());
      }
      
      // Add skills from competencies_from_college array
      if (alumniData.competencies_from_college && Array.isArray(alumniData.competencies_from_college)) {
        skills = [...skills, ...alumniData.competencies_from_college.map(skill => skill.toLowerCase())];
      }
      
      // Remove duplicates
      skills = [...new Set(skills)];
      
      setAlumniSkills(skills);
      console.log('Alumni skills loaded:', skills);
      
    } catch (error) {
      console.error('Error fetching alumni profile:', error);
      // Don't show an error toast as this is a background feature
    } finally {
      setFetchingProfile(false);
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      
      // Get token from localStorage
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
      
      // Filter only active jobs
      const activeJobs = response.data.filter(job => job.status === 'active');
      
      // Calculate skill match percentage for each job
      const jobsWithMatchScore = activeJobs.map(job => {
        const jobSkills = job.skills || [];
        
        // If job has no skills, match score is 0
        if (jobSkills.length === 0 || alumniSkills.length === 0) {
          return { ...job, matchScore: 0, matchedSkills: [] };
        }
        
        // Find skills that match (case-insensitive)
        const matchedSkills = jobSkills.filter(skill => 
          alumniSkills.some(alumniSkill => 
            alumniSkill.toLowerCase() === skill.toLowerCase()
          )
        );
        
        // Calculate match percentage
        const matchScore = Math.round((matchedSkills.length / jobSkills.length) * 100);
        
        return {
          ...job,
          matchScore,
          matchedSkills
        };
      });
      
      // Sort jobs by match score (highest first)
      jobsWithMatchScore.sort((a, b) => b.matchScore - a.matchScore);
      
      setJobs(jobsWithMatchScore);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load job opportunities');
    } finally {
      setLoading(false);
    }
  };
  
  // Filter jobs based on showOnlyMatching state
  const filteredJobs = showOnlyMatching 
    ? jobs.filter(job => job.matchScore > 0)
    : jobs;

  const fetchMyApplications = async () => {
    try {
      setApplicationsLoading(true);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      const response = await axios.get(`${API_URL}/recruitment/applications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setApplications(response.data);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load your applications');
    } finally {
      setApplicationsLoading(false);
    }
  };

  const handleApply = (jobId) => {
    // Check if user has already applied to this job
    const hasApplied = applications.some(app => app.job_id === jobId);
    
    if (hasApplied) {
      toast.warning('You have already applied to this job');
      return;
    }
    
    setApplyingToJobId(jobId);
    setCoverLetter('');
  };

  const submitApplication = async (e) => {
    e.preventDefault();
    
    if (!applyingToJobId) return;
    
    try {
      setSubmitting(true);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      const applicationData = {
        job_id: applyingToJobId,
        applicant_id: currentUser.id || currentUser._id,
        cover_letter: coverLetter
      };
      
      await axios.post(`${API_URL}/recruitment/applications`, applicationData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('Application submitted successfully');
      
      // Reset form and close modal
      setCoverLetter('');
      setApplyingToJobId(null);
      
      // Refresh applications list
      fetchMyApplications();
      // Also refresh jobs to update applicant counts
      fetchJobs();
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelApplication = () => {
    setApplyingToJobId(null);
    setCoverLetter('');
  };

  // Check if user has already applied to a specific job
  const hasAppliedToJob = (jobId) => {
    return applications.some(app => app.job_id === jobId);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Job Opportunities</h1>

      {applications.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">My Applications</h2>
          
          {applicationsLoading ? (
            <div className="bg-white shadow rounded-lg p-4 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cvsu-green"></div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{application.job_title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{application.company_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{format(new Date(application.created_at), 'MMM d, yyyy')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full 
                          ${application.status === 'applied' ? 'bg-blue-100 text-blue-800' : 
                          application.status === 'reviewing' ? 'bg-yellow-100 text-yellow-800' : 
                          application.status === 'shortlisted' ? 'bg-indigo-100 text-indigo-800' : 
                          application.status === 'interviewed' ? 'bg-purple-100 text-purple-800' : 
                          application.status === 'offered' ? 'bg-pink-100 text-pink-800' : 
                          application.status === 'hired' ? 'bg-green-100 text-green-800' : 
                          application.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'}`}>
                          {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Available Positions</h2>
          
          {/* Skills Matching Filter */}
          <div className="flex items-center">
            <button 
              onClick={() => setShowOnlyMatching(!showOnlyMatching)}
              className={`flex items-center px-3 py-1.5 rounded text-sm ${
                showOnlyMatching 
                  ? 'bg-cvsu-green text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              <FunnelIcon className="h-4 w-4 mr-1" />
              {showOnlyMatching ? 'Showing matching jobs' : 'Show matching jobs'}
            </button>
          </div>
        </div>
        
        {/* Skills Match Summary */}
        {!fetchingProfile && alumniSkills.length > 0 && (
          <div className="bg-blue-50 mb-4 p-3 rounded-lg">
            <div className="flex items-start">
              <BriefcaseIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
              <div>
                <p className="text-sm text-blue-700">
                  <strong>Skills Matching:</strong> We found {jobs.filter(job => job.matchScore > 0).length} jobs matching your skills.
                </p>
                <div className="mt-1">
                  <p className="text-xs text-blue-600">Your skills: {alumniSkills.join(', ')}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cvsu-green"></div>
          </div>
        ) : filteredJobs.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredJobs.map((job) => (
              <div key={job.id} className={`bg-white shadow rounded-lg overflow-hidden border ${
                job.matchScore > 70 ? 'border-green-300' : 
                job.matchScore > 40 ? 'border-blue-300' : 
                job.matchScore > 0 ? 'border-gray-300' : 
                'border-gray-200'
              }`}>
                <div className="p-5">
                  {/* Match score indicator for matched jobs */}
                  {job.matchScore > 0 && (
                    <div className="flex items-center mb-2">
                      <div className={`text-xs px-2 py-1 rounded-full font-medium flex items-center ${
                        job.matchScore > 70 ? 'bg-green-100 text-green-800' :
                        job.matchScore > 40 ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        {job.matchScore}% skills match
                      </div>
                    </div>
                  )}
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{job.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{job.company_name}</p>
                  
                  <div className="mb-3">
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Location:</span> {job.location}
                      {job.is_remote && <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">Remote</span>}
                    </p>
                  </div>
                  
                  <div className="mb-3">
                    <span className="text-xs inline-block bg-gray-100 rounded px-2 py-1 text-gray-700">
                      {job.employment_type === 'full-time' ? 'Full time' : 
                       job.employment_type === 'part-time' ? 'Part time' : 
                       job.employment_type === 'contract' ? 'Contract' : 
                       job.employment_type === 'internship' ? 'Internship' : 
                       job.employment_type}
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-xs text-gray-500">
                      Posted: {format(new Date(job.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  
                  {job.skills && job.skills.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Skills:</p>
                      <div className="flex flex-wrap gap-1">
                        {job.skills.map((skill, index) => {
                          const isMatched = job.matchedSkills && job.matchedSkills.some(
                            s => s.toLowerCase() === skill.toLowerCase()
                          );
                          
                          return (
                            <span 
                              key={index} 
                              className={`px-2 py-1 text-xs rounded-md ${
                                isMatched 
                                  ? 'bg-green-100 text-green-800 border border-green-300' 
                                  : 'bg-blue-100 text-blue-800'
                              } mb-1`}
                            >
                              {skill}{isMatched && ' ✓'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4">
                    {hasAppliedToJob(job.id) ? (
                      <button 
                        className="w-full px-4 py-2 bg-gray-100 text-gray-500 rounded font-medium text-sm cursor-not-allowed"
                        disabled
                      >
                        Applied
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleApply(job.id)}
                        className={`w-full px-4 py-2 text-white rounded font-medium text-sm ${
                          job.matchScore > 50 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-cvsu-green hover:bg-green-700'
                        }`}
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <p className="text-gray-600">No job opportunities available at the moment.</p>
            <p className="text-sm text-gray-500 mt-2">Please check back later for new openings.</p>
          </div>
        )}
      </div>

      {/* Application Modal */}
      {applyingToJobId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Submit Application</h3>
            <p className="text-sm text-gray-600 mb-4">
              You are applying for: <span className="font-medium">{jobs.find(job => job.id === applyingToJobId)?.title}</span>
            </p>
            
            {/* Display skill match info if available */}
            {jobs.find(job => job.id === applyingToJobId)?.matchScore > 0 && (
              <div className="mb-4 bg-blue-50 p-3 rounded">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Skills Match:</span> {jobs.find(job => job.id === applyingToJobId)?.matchScore}%
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Matching skills: {jobs.find(job => job.id === applyingToJobId)?.matchedSkills.join(', ')}
                </p>
              </div>
            )}
            
            <form onSubmit={submitApplication}>
              <div className="mb-4">
                <label htmlFor="cover-letter" className="block text-sm font-medium text-gray-700 mb-1">
                  Cover Letter (Optional)
                </label>
                <textarea
                  id="cover-letter"
                  rows={6}
                  className="w-full border rounded-md p-2"
                  placeholder="Tell the employer why you're a good fit for this position..."
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={cancelApplication}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cvsu-green hover:bg-green-700 text-white rounded disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruitmentPage; 