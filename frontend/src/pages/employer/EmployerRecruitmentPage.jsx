import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const EmployerRecruitmentPage = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

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
          
          <div className="border rounded-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="job-title" className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  id="job-title"
                  className="form-input w-full rounded-md"
                  placeholder="e.g. Software Engineer"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="job-location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  id="job-location"
                  className="form-input w-full rounded-md"
                  placeholder="e.g. Carmona, Cavite"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label htmlFor="job-description" className="block text-sm font-medium text-gray-700 mb-1">
                Job Description
              </label>
              <textarea
                id="job-description"
                rows={4}
                className="form-textarea w-full rounded-md"
                placeholder="Describe the job responsibilities and requirements"
                disabled={loading}
              ></textarea>
            </div>
            
            <div className="mb-4">
              <h3 className="font-medium mb-2">Required Skills</h3>
              <div className="border p-3 rounded bg-gray-50">
                <p className="text-gray-500 text-sm italic">Coming soon - Select from a list of skills or add custom requirements</p>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                className="bg-cvsu-green hover:bg-green-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Posting...' : 'Post Job (Coming Soon)'}
              </button>
            </div>
          </div>
        </div>
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
              placeholder="e.g. Java, Project Management, Data Analysis"
              disabled={loading}
            />
            <button
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded"
              disabled={loading}
            >
              Search
            </button>
          </div>
        </div>
        
        <div className="mt-6">
          <h3 className="font-medium mb-2">Matching Candidates</h3>
          <div className="border rounded-md p-6 bg-gray-50 text-center text-gray-500">
            <p>No search results yet. Search for skills to find matching candidates.</p>
            <p className="text-sm italic mt-2">Candidate matching feature coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployerRecruitmentPage; 