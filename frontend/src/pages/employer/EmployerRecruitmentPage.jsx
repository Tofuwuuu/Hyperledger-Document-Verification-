import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { API_URL } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const EmployerRecruitmentPage = () => {
  const { currentUser, authToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [jobFormData, setJobFormData] = useState({
    title: '',
    description: '',
    location: '',
    skills: [],
    requirements: [],
    responsibilities: [],
    employment_type: 'full-time',
    is_remote: false
  });
  const [skillInput, setSkillInput] = useState('');
  const [searchSkillInput, setSearchSkillInput] = useState('');
  const [activeJobs, setActiveJobs] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const navigate = useNavigate();

  // Load active jobs on component mount
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setJobsLoading(true);
      
      // Get the token directly from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      // Create API config with token
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };
      
      // Now fetch jobs using the recruitment API endpoint
      const response = await axios.get(`${API_URL}/recruitment/jobs`, config);
      
      console.log('Jobs fetched successfully:', response.data.length);
      setActiveJobs(response.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      
      // More detailed error handling
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        
        if (error.response.status === 403) {
          toast.error('You do not have permission to view job postings. Please ensure you are logged in as an employer.');
        } else if (error.response.status === 400) {
          toast.error(`Failed to load job postings: ${error.response.data?.detail || 'Bad request'}`);
          
          // If it's the invalid employer ID error, suggest logging out and back in
          if (error.response.data?.detail === 'Invalid employer ID format') {
            toast.info('Try logging out and logging back in to refresh your session.');
          }
        } else {
          toast.error(`Failed to load job postings: ${error.response.data?.detail || 'Unknown error'}`);
        }
      } else {
        toast.error('Failed to load job postings. Network error or server unavailable.');
      }
    } finally {
      setJobsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setJobFormData(prev => ({
      ...prev,
      [id.replace('job-', '')]: value
    }));
  };

  const handleSkillInputChange = (e) => {
    setSkillInput(e.target.value);
  };

  const handleSkillInputKeyDown = (e) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      addSkill();
    }
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      setJobFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skillInput.trim()]
      }));
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove) => {
    setJobFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!jobFormData.title.trim()) {
      toast.error('Job title is required');
      return;
    }
    
    if (!jobFormData.description.trim()) {
      toast.error('Job description is required');
      return;
    }
    
    if (!jobFormData.location.trim()) {
      toast.error('Job location is required');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get the token directly from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      // Create job using the recruitment API endpoint
      const response = await axios.post(`${API_URL}/recruitment/jobs`, jobFormData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Job created successfully:', response.data);
      toast.success('Job posting created successfully');
      
      // Reset form
      setJobFormData({
        title: '',
        description: '',
        location: '',
        skills: [],
        requirements: [],
        responsibilities: [],
        employment_type: 'full-time',
        is_remote: false
      });
      setSkillInput('');
      
      // Refresh jobs list
      fetchJobs();
      
    } catch (error) {
      console.error('Error creating job posting:', error);
      
      // More detailed error handling
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        
        if (error.response.status === 403) {
          toast.error('You do not have permission to create job postings. Please ensure you are logged in as an employer.');
        } else {
          toast.error(`Failed to create job posting: ${error.response.data?.detail || 'Unknown error'}`);
        }
      } else {
        toast.error('Failed to create job posting. Network error or server unavailable.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchSkillInput.trim()) {
      toast.warning('Please enter at least one skill to search');
      return;
    }
    
    try {
      setSearchLoading(true);
      setHasSearched(true);
      
      // Get the token directly from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      // Use the new recruitment API endpoint for candidate search
      const response = await axios.get(`${API_URL}/recruitment/search/candidates?skills=${encodeURIComponent(searchSkillInput)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setSearchResults(response.data);
      
    } catch (error) {
      console.error('Error searching alumni:', error);
      
      // More detailed error handling
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        
        if (error.response.status === 403) {
          toast.error('You do not have permission to search alumni. Please ensure you are logged in as an employer.');
        } else {
          toast.error(`Failed to search alumni: ${error.response.data?.detail || 'Unknown error'}`);
        }
      } else {
        toast.error('Failed to search alumni. Network error or server unavailable.');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job posting?')) {
      return;
    }
    
    try {
      // Get the token directly from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      // Use the recruitment API endpoint for deleting jobs
      await axios.delete(`${API_URL}/recruitment/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('Job posting deleted successfully');
      
      // Update local state to remove the deleted job
      setActiveJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
      
    } catch (error) {
      console.error('Error deleting job posting:', error);
      
      // More detailed error handling
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        
        if (error.response.status === 403) {
          toast.error('You do not have permission to delete this job posting.');
        } else if (error.response.status === 404) {
          toast.error('Job posting not found. It may have already been deleted.');
          // Refresh jobs list to ensure accurate display
          fetchJobs();
        } else if (error.response.status === 400 && error.response.data?.detail === 'Invalid job ID format') {
          toast.error('Invalid job ID format. The job posting cannot be deleted.');
        } else {
          toast.error(`Failed to delete job posting: ${error.response.data?.detail || 'Unknown error'}`);
        }
      } else {
        toast.error('Failed to delete job posting. Network error or server unavailable.');
      }
    }
  };

  const handleUpdateJobStatus = async (jobId, newStatus) => {
    try {
      // Get the token directly from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      // Update job status using the new recruitment API endpoint
      await axios.put(
        `${API_URL}/recruitment/jobs/${jobId}`,
        { status: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      toast.success(`Job status updated to ${newStatus}`);
      
      // Refresh jobs list
      fetchJobs();
      
    } catch (error) {
      console.error('Error updating job status:', error);
      
      // More detailed error handling
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        
        if (error.response.status === 403) {
          toast.error('You do not have permission to update this job posting.');
        } else {
          toast.error(`Failed to update job status: ${error.response.data?.detail || 'Unknown error'}`);
        }
      } else {
        toast.error('Failed to update job status. Network error or server unavailable.');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Talent Recruitment</h1>
        
        <div className="mb-6 bg-blue-50 p-4 rounded-md">
          <p className="text-blue-700">
            Find the right talent for your organization. Search for alumni with matching skills and qualifications.
          </p>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Post a Job Opening</h2>
          <p className="mb-4 text-gray-600">
            Create job postings to attract qualified alumni from Cavite State University - Carmona Campus.
          </p>
          
          <form onSubmit={handleSubmit} className="border rounded-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="job-title" className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title*
                </label>
                <input
                  type="text"
                  id="job-title"
                  className="form-input w-full rounded-md"
                  placeholder="e.g. Software Engineer"
                  value={jobFormData.title}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="job-location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location*
                </label>
                <input
                  type="text"
                  id="job-location"
                  className="form-input w-full rounded-md"
                  placeholder="e.g. Carmona, Cavite"
                  value={jobFormData.location}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label htmlFor="job-description" className="block text-sm font-medium text-gray-700 mb-1">
                Job Description*
              </label>
              <textarea
                id="job-description"
                rows={4}
                className="form-textarea w-full rounded-md"
                placeholder="Describe the job responsibilities and requirements"
                value={jobFormData.description}
                onChange={handleInputChange}
                required
                disabled={loading}
              ></textarea>
            </div>
            
            <div className="mb-4">
              <label htmlFor="job-employment_type" className="block text-sm font-medium text-gray-700 mb-1">
                Employment Type
              </label>
              <select
                id="job-employment_type"
                className="form-select w-full rounded-md"
                value={jobFormData.employment_type}
                onChange={handleInputChange}
                disabled={loading}
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
                <option value="temporary">Temporary</option>
              </select>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Required Skills</label>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {jobFormData.skills.map((skill, index) => (
                  <div key={index} className="bg-gray-100 rounded-full px-3 py-1 text-sm flex items-center">
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="ml-2 text-gray-500 hover:text-gray-700"
                      disabled={loading}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input flex-grow rounded-md"
                  placeholder="Add a skill (e.g. Java, Python)"
                  value={skillInput}
                  onChange={handleSkillInputChange}
                  onKeyDown={handleSkillInputKeyDown}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
                  disabled={loading || !skillInput.trim()}
                >
                  Add
                </button>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-cvsu-green hover:bg-green-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Posting...' : 'Post Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Your Job Openings</h2>
        
        {jobsLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cvsu-green"></div>
          </div>
        ) : activeJobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posted</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicants</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{job.title}</div>
                      <div className="text-xs text-gray-500">{job.employment_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{job.location}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {format(new Date(job.created_at), 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="relative">
                        <select
                          value={job.status}
                          onChange={(e) => handleUpdateJobStatus(job.id, e.target.value)}
                          className={`px-2 text-xs leading-5 font-semibold rounded-full 
                            ${job.status === 'active' ? 'bg-green-100 text-green-800' : 
                            job.status === 'filled' ? 'bg-blue-100 text-blue-800' : 
                            job.status === 'closed' ? 'bg-red-100 text-red-800' : 
                            job.status === 'archived' ? 'bg-gray-300 text-gray-800' : 
                            'bg-gray-100 text-gray-800'}`}
                        >
                          <option value="active">Active</option>
                          <option value="filled">Filled</option>
                          <option value="closed">Closed</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.applicant_count || 0} applicants
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => navigate(`/employer/applications/${job.id}`)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        View Applications
                      </button>
                      <button 
                        onClick={() => handleDeleteJob(job.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border rounded-md p-8 bg-gray-50 text-center">
            <p className="text-gray-600 mb-4">You haven't posted any job openings yet.</p>
            <p className="text-sm text-gray-500">
              Create your first job posting using the form above to attract qualified alumni.
            </p>
          </div>
        )}
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Search For Candidates</h2>
        <p className="mb-4 text-gray-600">
          Find alumni who match your required skills and qualifications.
        </p>
        
        <div className="mb-4">
          <label htmlFor="skill-search" className="block text-sm font-medium text-gray-700 mb-1">
            Search by Skills
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="skill-search"
              className="form-input flex-grow rounded-md"
              placeholder="e.g. Java, Project Management, Data Analysis (comma-separated)"
              value={searchSkillInput}
              onChange={(e) => setSearchSkillInput(e.target.value)}
              disabled={searchLoading}
            />
            <button
              className="bg-cvsu-green hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              onClick={handleSearch}
              disabled={searchLoading || !searchSkillInput.trim()}
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
        
        <div className="mt-6">
          <h3 className="font-medium mb-2">Matching Candidates</h3>
          
          {hasSearched ? (
            searchResults.length > 0 ? (
              <div className="border rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matching Skills</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match %</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {searchResults.map((candidate) => (
                      <tr key={candidate.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                          <div className="text-xs text-gray-500">{candidate.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{candidate.program || 'N/A'}</div>
                          {candidate.graduation_year && (
                            <div className="text-xs text-gray-500">Class of {candidate.graduation_year}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills.map((skill) => (
                              <span key={skill} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {candidate.match_percentage}%
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border rounded-md p-6 bg-gray-50 text-center text-gray-500">
                <p>No matching candidates found.</p>
                <p className="text-sm italic mt-2">Try different skills or broader search terms.</p>
              </div>
            )
          ) : (
            <div className="border rounded-md p-6 bg-gray-50 text-center text-gray-500">
              <p>Enter skills above and click Search to find matching candidates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployerRecruitmentPage; 