import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

const AccountRecoveryPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // email, questions, success
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Handle email submission
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    
    try {
      // Get security questions for this email
      const response = await authService.getSecurityQuestions(email);
      
      if (response.questions && response.questions.length > 0) {
        setQuestions(response.questions);
        // Initialize answers array with empty strings
        setAnswers(new Array(response.questions.length).fill(''));
        setStep('questions');
      } else {
        setError('No security questions found for this email. Please try password reset instead.');
      }
    } catch (err) {
      if (err.status === 404) {
        setError('No account found with this email address');
      } else if (err.status === 400) {
        setError('Security questions are not set up for this account. Please use password reset instead.');
      } else {
        setError(err.message || 'An error occurred. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Handle answer change
  const handleAnswerChange = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };
  
  // Handle questions submission
  const handleQuestionsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Check if at least 2 answers are provided
    const answeredCount = answers.filter(a => a.trim().length > 0).length;
    if (answeredCount < 2) {
      setError('Please answer at least 2 security questions');
      return;
    }
    
    setLoading(true);
    
    try {
      // Format answers for API
      const answersData = questions.map((q, index) => ({
        question_idx: q.index,
        answer: answers[index]
      })).filter(a => a.answer.trim().length > 0);
      
      const response = await authService.verifySecurityQuestions({
        email,
        answers: answersData
      });
      
      if (response.status === 'success' && response.reset_token) {
        // Redirect to password reset page with token
        navigate(`/reset-password?token=${response.reset_token}`);
      } else {
        setStep('success');
      }
    } catch (err) {
      if (err.status === 401) {
        setError('The answers provided do not match our records. Please try again.');
      } else {
        setError(err.message || 'An error occurred. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Account Recovery
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Recover your account using security questions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Enter the email address associated with your account
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cvsu-green hover:bg-cvsu-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Continue'}
                </button>
              </div>
              
              <div className="mt-4 text-center">
                <Link to="/reset-password" className="font-medium text-cvsu-green hover:text-green-700">
                  Try password reset instead
                </Link>
              </div>
            </form>
          )}
          
          {step === 'questions' && (
            <form onSubmit={handleQuestionsSubmit}>
              <div className="space-y-4">
                <p className="text-sm text-gray-700 mb-4">
                  Please answer at least 2 of your security questions to verify your identity:
                </p>
                
                {questions.map((question, index) => (
                  <div key={index} className="mb-4">
                    <label htmlFor={`question-${index}`} className="block text-sm font-medium text-gray-700">
                      {question.question}
                    </label>
                    <input
                      id={`question-${index}`}
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                      value={answers[index]}
                      onChange={(e) => handleAnswerChange(index, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  className="text-sm font-medium text-cvsu-green hover:text-green-700"
                  onClick={() => setStep('email')}
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cvsu-green hover:bg-cvsu-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Verify Answers'}
                </button>
              </div>
            </form>
          )}
          
          {step === 'success' && (
            <div className="text-center">
              <div className="rounded-md bg-green-50 p-4 mb-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Success</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>Your identity has been verified. You will be redirected to reset your password.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                type="button"
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cvsu-green hover:bg-cvsu-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                onClick={() => navigate('/login')}
              >
                Return to login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountRecoveryPage; 