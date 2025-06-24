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
    // Instead of fetching data, we'll use mock data
    const mockExitInterviews = generateMockData();
    setExitInterviews(mockExitInterviews);
    setLoading(false);
  }, []);

  // Function to generate mock data
  const generateMockData = () => {
    return [
      {
        _id: "mock-id-1",
        name: "John Doe",
        student_id: "2023-12345",
        course_year_section: "BSCS 4-1",
        email: "john.doe@example.com",
        address: "123 Main St, Cavite City",
        transfer_school: "University of Manila",
        transfer_course: "BS Information Technology",
        reasons: ["Financial constraints", "Distance from home", "Academic program"],
        other_reason: "Family relocation",
        important_lesson: "The importance of time management and teamwork in academic success.",
        feedbacks: [
          {
            category: "Instructors/Professors",
            feedback: "Most professors were very knowledgeable and approachable.",
            suggestion: "More industry collaboration for practical learning experiences."
          },
          {
            category: "Curriculum",
            feedback: "The curriculum was comprehensive but could use more practical applications.",
            suggestion: "Include more hands-on projects and industry-relevant tools."
          },
          {
            category: "Administration",
            feedback: "Administrative processes were sometimes slow.",
            suggestion: "Digitize more of the administrative processes for efficiency."
          }
        ],
        counselor_note: "Student is transferring due to family relocation. Has been a good student with promising academic performance.",
        created_at: "2023-11-15T08:30:00Z"
      },
      {
        _id: "mock-id-2",
        name: "Maria Santos",
        student_id: "2022-54321",
        course_year_section: "BSN 3-2",
        email: "maria.santos@example.com",
        address: "456 Park Avenue, Bacoor, Cavite",
        transfer_school: "Philippine General College of Nursing",
        transfer_course: "BS Nursing",
        reasons: ["Academic program", "Career opportunities"],
        other_reason: "",
        important_lesson: "The value of perseverance and continuous learning in the medical field.",
        feedbacks: [
          {
            category: "Instructors/Professors",
            feedback: "Nursing instructors were highly skilled but the student-to-teacher ratio was high.",
            suggestion: "Hire more specialized nursing instructors."
          },
          {
            category: "Physical Facilities and Environment",
            feedback: "The nursing laboratory needs more modern equipment.",
            suggestion: "Update laboratory equipment to match current hospital standards."
          }
        ],
        counselor_note: "Student is seeking specialized nursing program. Has maintained good academic standing.",
        created_at: "2023-10-22T14:15:00Z"
      },
      {
        _id: "mock-id-3",
        name: "Robert Garcia",
        student_id: "2021-67890",
        course_year_section: "BSBA 2-1",
        email: "robert.garcia@example.com",
        address: "789 Ocean Blvd, Dasmariñas, Cavite",
        transfer_school: "Manila Business Institute",
        transfer_course: "BS Business Administration - Finance",
        reasons: ["Career opportunities", "Academic program", "Personal circumstances"],
        other_reason: "Seeking specialization in Finance",
        important_lesson: "The importance of networking and practical business knowledge.",
        feedbacks: [
          {
            category: "Curriculum",
            feedback: "Business curriculum is good but lacks specialization tracks.",
            suggestion: "Offer more specialized tracks within the business program."
          },
          {
            category: "Administration",
            feedback: "Registration process is cumbersome.",
            suggestion: "Implement a more efficient online registration system."
          },
          {
            category: "Employees and Staff",
            feedback: "Staff were generally helpful but response times were slow.",
            suggestion: "Improve communication channels for student inquiries."
          }
        ],
        counselor_note: "Student has clear career goals in finance. Transfer is based on program specialization needs.",
        created_at: "2023-09-05T11:20:00Z"
      }
    ];
  };

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
                          {interview.course_year_section || 'N/A'}
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
                          Transfer to: {interview.transfer_school || 'N/A'}
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
                        <div className="mb-4">
                          <div>
                            <h4 className="font-medium text-gray-700">Student Information</h4>
                            <p className="text-sm text-gray-600">Name: {interview.name || interview.full_name || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Student ID: {interview.student_id || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Course/Year/Section: {interview.course_year_section || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Address: {interview.address || 'N/A'}</p>
                          </div>
                          <div className="mt-3">
                            <h4 className="font-medium text-gray-700">Transfer Information</h4>
                            <p className="text-sm text-gray-600">Transfer School: {interview.transfer_school || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Transfer Course: {interview.transfer_course || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <h4 className="font-medium text-gray-700">Reasons for Transfer</h4>
                          {interview.reasons && interview.reasons.length > 0 ? (
                            <ul className="mt-1 text-sm text-gray-600 list-disc pl-5">
                              {interview.reasons.map((reason, idx) => (
                                <li key={idx}>{reason}</li>
                              ))}
                              {interview.other_reason && (
                                <li>Other: {interview.other_reason}</li>
                              )}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-600">No reasons provided</p>
                          )}
                        </div>

                        <div className="mb-4">
                          <h4 className="font-medium text-gray-700">Important Lesson</h4>
                          <p className="text-sm text-gray-600">{interview.important_lesson || 'N/A'}</p>
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

                        {interview.counselor_note && (
                          <div>
                            <h4 className="font-medium text-gray-700">Counselor's Note</h4>
                            <p className="text-sm text-gray-600">{interview.counselor_note}</p>
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