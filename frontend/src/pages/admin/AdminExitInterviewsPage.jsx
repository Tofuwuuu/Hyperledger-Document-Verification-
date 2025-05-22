import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { format } from 'date-fns';

const AdminExitInterviewsPage = () => {
  const [exitInterviews, setExitInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedInterview, setExpandedInterview] = useState(null);

  useEffect(() => {
    const fetchExitInterviews = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/admin/exit-interviews`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        console.log("Exit interviews data:", response.data);
        setExitInterviews(response.data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching exit interviews:', err);

        // For development purposes, use sample data when server returns an error
        // Remove this in production environment
        const sampleData = [{
          _id: "sample1",
          name: "John Doe",
          full_name: "John Doe",
          student_id: "21010001",
          email: "john.doe@example.com",
          course_year_section: "BSIT 4-1",
          address: "123 Main St, City",
          transfer_school: "Manila University",
          transfer_course: "Computer Science",
          reasons: ["financial_reasons", "personal_development"],
          otherReason: "Family relocation",
          important_lesson: "Time management and prioritization",
          feedbacks: [
            {
              category: "Facilities",
              feedback: "Computer labs need upgrading",
              suggestion: "Invest in newer computers and faster internet"
            },
            {
              category: "Faculty",
              feedback: "Most professors are helpful and knowledgeable",
              suggestion: "More industry exposure for students would be helpful"
            }
          ],
          counselorNote: "Student is transferring due to family circumstances."
        }];
        
        setError('Failed to load exit interviews. Showing sample data for development purposes.');
        setExitInterviews(sampleData);
        setLoading(false);
      }
    };

    fetchExitInterviews();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const toggleInterview = (id) => {
    if (expandedInterview === id) {
      setExpandedInterview(null);
    } else {
      setExpandedInterview(id);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Exit Interviews</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all exit interviews submitted by students transferring to other schools.
          </p>
          {error && (
            <div className="mt-2 p-2 bg-yellow-50 text-yellow-700 text-sm rounded-md">
              {error}
            </div>
          )}
        </div>
      </div>

      {exitInterviews.length === 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md p-6 text-center">
          <div className="text-gray-500 mb-4">No exit interviews found.</div>
          <p className="text-sm text-gray-400">
            When students complete exit interviews, they will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {exitInterviews.map((interview) => (
              <li key={interview._id}>
                <div className="block hover:bg-gray-50">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-cvsu-green truncate">
                          {interview.name || interview.full_name || 'Unknown Student'}
                        </p>
                        <p className="ml-4 text-xs text-gray-500">
                          ID: {interview.student_id || 'N/A'}
                        </p>
                        <p className="ml-4 text-xs text-gray-500">
                          {interview.courseYearSection || interview.course_year_section || 'N/A'}
                        </p>
                      </div>
                      <div className="ml-2 flex-shrink-0 flex">
                        <button
                          onClick={() => toggleInterview(interview._id)}
                          className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-cvsu-green text-white"
                        >
                          {expandedInterview === interview._id ? 'Hide Details' : 'View Details'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          Transfer to: {interview.transferSchool || interview.transfer_school || 'N/A'}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <p>
                          Email: {interview.email || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {expandedInterview === interview._id && (
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h4 className="font-medium text-gray-700">Student Information</h4>
                            <p className="text-sm text-gray-600">Name: {interview.name || interview.full_name || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Student ID: {interview.student_id || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Course/Year/Section: {interview.courseYearSection || interview.course_year_section || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Address: {interview.address || 'N/A'}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-700">Transfer Information</h4>
                            <p className="text-sm text-gray-600">Transfer School: {interview.transferSchool || interview.transfer_school || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Transfer Course: {interview.transferCourse || interview.transfer_course || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <h4 className="font-medium text-gray-700">Reasons for Transfer</h4>
                          {(Array.isArray(interview.reasons) && interview.reasons.length > 0) ? (
                            <ul className="list-disc pl-5 text-sm text-gray-600">
                              {interview.reasons.map((reason, idx) => (
                                <li key={idx}>{typeof reason === 'string' ? reason.replace(/_/g, ' ') : reason}</li>
                              ))}
                              {interview.otherReason && <li>Other: {interview.otherReason}</li>}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-600">No reasons provided</p>
                          )}
                        </div>

                        <div className="mb-4">
                          <h4 className="font-medium text-gray-700">Important Lesson</h4>
                          <p className="text-sm text-gray-600">{interview.importantLesson || interview.important_lesson || 'N/A'}</p>
                        </div>

                        <div className="mb-4">
                          <h4 className="font-medium text-gray-700">Feedbacks</h4>
                          {(Array.isArray(interview.feedbacks) && interview.feedbacks.length > 0) ? (
                            <div className="mt-2 overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Suggestion</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {interview.feedbacks.map((feedback, idx) => (
                                    <tr key={idx}>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{feedback.category || 'N/A'}</td>
                                      <td className="px-6 py-4 text-sm text-gray-500">{feedback.feedback || 'N/A'}</td>
                                      <td className="px-6 py-4 text-sm text-gray-500">{feedback.suggestion || 'N/A'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-600">No feedback provided</p>
                          )}
                        </div>

                        {interview.counselorNote && (
                          <div>
                            <h4 className="font-medium text-gray-700">Counselor's Note</h4>
                            <p className="text-sm text-gray-600">{interview.counselorNote}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminExitInterviewsPage; 