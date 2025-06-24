import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { API_URL } from '../config';
import cvsuLogo from '../assets/cvsu-logo.png';

const Questionnaire = () => {
  const { currentUser, updateCurrentUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    courseYearSection: '',
    address: '',
    transferSchool: '',
    transferCourse: '',
    reasons: [],
    otherReason: '',
    importantLesson: '',
    feedbacks: [
      { category: 'Instructors/Professors', feedback: '', suggestion: '' },
      { category: 'Curriculum', feedback: '', suggestion: '' },
      { category: 'Administration', feedback: '', suggestion: '' },
      { category: 'Employees and Staff', feedback: '', suggestion: '' },
      { category: 'Physical Facilities and Environment', feedback: '', suggestion: '' },
    ],
    counselorNote: ''
  });

  const handleReasonChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setFormData({
        ...formData,
        reasons: [...formData.reasons, value]
      });
    } else {
      setFormData({
        ...formData,
        reasons: formData.reasons.filter(reason => reason !== value)
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFeedbackChange = (index, field, value) => {
    const updatedFeedbacks = [...formData.feedbacks];
    updatedFeedbacks[index] = { 
      ...updatedFeedbacks[index], 
      [field]: value 
    };
    
    setFormData({
      ...formData,
      feedbacks: updatedFeedbacks
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Fix: Get the API base URL from window.location to avoid duplication
      const baseUrl = window.location.origin; // e.g. "http://localhost:8000"
      const apiUrl = `${baseUrl}/api/v1/users/questionnaire`;
      
      console.log("Submitting questionnaire to URL:", apiUrl);
      
      const response = await axios.post(
        apiUrl, 
        formData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (response.status === 200) {
        toast.success("Thank you for completing the exit interview form!");
        
        // Debug logs
        console.log("Before update - currentUser:", currentUser);
        
        // Update user state to mark questionnaire as completed
        if (currentUser) {
          try {
            // Wait for the update to complete (now it's async)
            await updateCurrentUser({
              hasCompletedQuestionnaire: true
            });
            
            console.log("After update - user data refreshed from server");
            
            // Brief delay to ensure state updates propagate
            setTimeout(() => {
              // Redirect based on user role
              const redirectPath = currentUser?.isAdmin ? '/admin' : '/alumni';
              window.location.href = redirectPath;
            }, 500);
          } catch (error) {
            console.error("Error updating user data:", error);
            // Fallback navigation
            navigate(currentUser?.isAdmin ? '/admin' : '/alumni');
          }
        } else {
          // Fallback if currentUser is somehow not available
          navigate('/alumni');
        }
      }
    } catch (error) {
      toast.error("Failed to submit form. Please try again.");
      console.error("Error submitting form:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md relative">
      <div className="absolute top-2 right-2 text-xs text-gray-500">OSAS-OF-14</div>
      <div className="flex items-center justify-center mb-6">
        <img 
          src={cvsuLogo} 
          alt="CVSU Logo" 
          className="h-20 mr-4" 
        />
        <div className="text-center">
          <p className="text-sm text-gray-600">Republic of the Philippines</p>
          <h2 className="text-xl font-semibold text-gray-800">CAVITE STATE UNIVERSITY</h2>
          <p className="text-gray-600">Carmona Campus</p>
          <p className="text-gray-500 text-sm">Market Road, Carmona, Cavite</p>
          <p className="text-gray-500 text-xs">(046) 430-8599; cvsu.carmonacampus@gmail.com</p>
          <p className="text-gray-500 text-xs">www.cvsu.edu.ph</p>
        </div>
      </div>
      
      <h1 className="text-xl font-bold text-center mb-6">EXIT INTERVIEW FORM FOR TRANSFERRING OTHER SCHOOL</h1>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex">
            <span className="mr-1">Name:</span>
            <input 
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="flex-grow border-b border-gray-300 focus:outline-none focus:border-black"
            />
          </div>
          <div className="flex">
            <span className="mr-1">Date:</span>
            <input 
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="flex-grow border-b border-gray-300 focus:outline-none focus:border-black"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex">
            <span className="mr-1">Course/Year/Section:</span>
            <input 
              type="text"
              name="courseYearSection"
              value={formData.courseYearSection}
              onChange={handleChange}
              className="flex-grow border-b border-gray-300 focus:outline-none focus:border-black"
            />
          </div>
          <div className="flex">
            <span className="mr-1">Address:</span>
            <input 
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="flex-grow border-b border-gray-300 focus:outline-none focus:border-black"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex">
            <span className="mr-1">What school will you transfer?</span>
            <input 
              type="text"
              name="transferSchool"
              value={formData.transferSchool}
              onChange={handleChange}
              className="flex-grow border-b border-gray-300 focus:outline-none focus:border-black"
            />
          </div>
          <div className="flex">
            <span className="mr-1">What course will you take there?</span>
            <input 
              type="text"
              name="transferCourse"
              value={formData.transferCourse}
              onChange={handleChange}
              className="flex-grow border-b border-gray-300 focus:outline-none focus:border-black"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="font-medium">What is/are your reasons for transferring to other school? (please check which is appropriate to you!)</p>
          <div className="grid md:grid-cols-2 gap-2 mt-2">
            <label className="flex items-center">
              <input 
                type="checkbox" 
                value="financial_problem" 
                onChange={handleReasonChange}
                className="mr-2" 
              />
              financial problem
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                value="poor_facilities" 
                onChange={handleReasonChange}
                className="mr-2" 
              />
              poor facilities
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                value="parents_wanted_another_course" 
                onChange={handleReasonChange}
                className="mr-2" 
              />
              parents wanted another course
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                value="poor_quality_of_teaching" 
                onChange={handleReasonChange}
                className="mr-2" 
              />
              poor quality of teaching
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                value="change_of_residency" 
                onChange={handleReasonChange}
                className="mr-2" 
              />
              change of residency
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                value="wanted_to_shift_course" 
                onChange={handleReasonChange}
                className="mr-2" 
              />
              wanted to shift course to other school
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                value="academic_failure" 
                onChange={handleReasonChange}
                className="mr-2" 
              />
              academic failure
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                value="behavioural_problem" 
                onChange={handleReasonChange}
                className="mr-2" 
              />
              behavioural problem
            </label>
          </div>
          <div className="mt-2">
            <label className="flex items-center">
              <input 
                type="checkbox" 
                value="encountered_a_problem" 
                onChange={handleReasonChange}
                className="mr-2" 
              />
              encountered a problem, specify:
              <input 
                type="text" 
                name="otherReason"
                value={formData.otherReason}
                onChange={handleChange}
                className="ml-2 flex-grow border-b border-gray-300 focus:outline-none focus:border-black"
              />
            </label>
          </div>
        </div>
        
        <div>
          <label htmlFor="importantLesson" className="block font-medium">
            What is the most important lesson in life that you learned inside CvSU – Carmona Campus?
          </label>
          <textarea 
            id="importantLesson"
            name="importantLesson"
            value={formData.importantLesson}
            onChange={handleChange}
            rows="2"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
          ></textarea>
        </div>
        
        <div>
          <p className="font-medium mb-2">Give your general feedback/evaluation and suggest improvement to the following:</p>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 border text-left">Category</th>
                  <th className="px-4 py-2 border text-left">Feedback/Evaluation</th>
                  <th className="px-4 py-2 border text-left">Suggest for Improvement</th>
                </tr>
              </thead>
              <tbody>
                {formData.feedbacks.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 border">{item.category}</td>
                    <td className="px-4 py-2 border">
                      <textarea 
                        rows="2"
                        value={item.feedback}
                        onChange={(e) => handleFeedbackChange(index, 'feedback', e.target.value)}
                        className="w-full border-gray-200 focus:border-green-500 focus:ring-green-500"
                      ></textarea>
                    </td>
                    <td className="px-4 py-2 border">
                      <textarea 
                        rows="2"
                        value={item.suggestion}
                        onChange={(e) => handleFeedbackChange(index, 'suggestion', e.target.value)}
                        className="w-full border-gray-200 focus:border-green-500 focus:ring-green-500"
                      ></textarea>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <label htmlFor="counselorNote" className="block font-medium">
            COUNSELOR'S NOTE during the INTERVIEW: <span className="text-gray-500 text-sm">(optional)</span>
          </label>
          <textarea 
            id="counselorNote"
            name="counselorNote"
            value={formData.counselorNote}
            onChange={handleChange}
            rows="3"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
          ></textarea>
        </div>
        
        <div className="flex justify-center pt-4">
          <button
            type="submit"
            className="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Submit
          </button>
        </div>
        
        <div className="text-right text-xs text-gray-400">V02-2019-01-26</div>
      </form>
    </div>
  );
};

export default Questionnaire; 