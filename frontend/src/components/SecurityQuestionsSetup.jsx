import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Predefined security questions for users to choose from
const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "In what city were you born?",
  "What is your mother's maiden name?",
  "What high school did you attend?",
  "What was the make of your first car?",
  "What was your childhood nickname?",
  "What is the name of your favorite childhood teacher?",
  "What is your favorite movie?",
  "What was the first concert you attended?",
  "What is the name of the street you grew up on?"
];

const SecurityQuestionsSetup = () => {
  const { authService } = useAuth();
  const [questions, setQuestions] = useState([
    { question: SECURITY_QUESTIONS[0], answer: '' },
    { question: SECURITY_QUESTIONS[1], answer: '' },
    { question: '', answer: '' } // Custom question option
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Handle question change
  const handleQuestionChange = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index].question = value;
    setQuestions(newQuestions);
  };
  
  // Handle answer change
  const handleAnswerChange = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index].answer = value;
    setQuestions(newQuestions);
  };
  
  // Add another question field
  const addQuestion = () => {
    if (questions.length < 5) {
      setQuestions([...questions, { question: '', answer: '' }]);
    }
  };
  
  // Remove a question field
  const removeQuestion = (index) => {
    if (questions.length > 2) {
      const newQuestions = [...questions];
      newQuestions.splice(index, 1);
      setQuestions(newQuestions);
    }
  };
  
  // Save security questions
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate questions
    const validQuestions = questions.filter(q => 
      q.question.trim().length > 0 && q.answer.trim().length > 0
    );
    
    if (validQuestions.length < 2) {
      setError('Please provide at least 2 security questions with answers');
      return;
    }
    
    setLoading(true);
    
    try {
      await authService.setSecurityQuestions({
        questions: validQuestions
      });
      
      setSuccess('Security questions saved successfully');
      // Reset form for custom questions
      const updatedQuestions = questions.map(q => {
        if (!SECURITY_QUESTIONS.includes(q.question)) {
          return { ...q, answer: '' };
        }
        return q;
      });
      setQuestions(updatedQuestions);
    } catch (err) {
      setError(err.message || 'Failed to save security questions');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h2 className="text-lg font-medium mb-4">Security Questions</h2>
      <p className="text-gray-600 mb-4">
        Set up security questions to help recover your account if you forget your password.
        These will be used to verify your identity.
      </p>
      
      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-2 bg-green-50 text-green-600 text-sm rounded">
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {questions.map((q, index) => (
            <div key={index} className="border border-gray-200 rounded-md p-4">
              <div className="mb-3">
                <label htmlFor={`question-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                  Security Question {index + 1}
                </label>
                <select
                  id={`question-${index}`}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                  value={q.question}
                  onChange={(e) => handleQuestionChange(index, e.target.value)}
                  required
                >
                  <option value="">Select a question</option>
                  {SECURITY_QUESTIONS.map((question, qIndex) => (
                    <option 
                      key={qIndex} 
                      value={question}
                      disabled={questions.some((q, i) => i !== index && q.question === question)}
                    >
                      {question}
                    </option>
                  ))}
                  <option value="custom">Custom question...</option>
                </select>
                
                {q.question === 'custom' && (
                  <input
                    type="text"
                    className="mt-2 w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                    placeholder="Enter your custom security question"
                    value={q.customQuestion || ''}
                    onChange={(e) => {
                      const newQuestions = [...questions];
                      newQuestions[index].customQuestion = e.target.value;
                      newQuestions[index].question = e.target.value;
                      setQuestions(newQuestions);
                    }}
                    required
                  />
                )}
              </div>
              
              <div>
                <label htmlFor={`answer-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                  Answer
                </label>
                <input
                  id={`answer-${index}`}
                  type="text"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                  value={q.answer}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  required
                />
              </div>
              
              {questions.length > 2 && (
                <button
                  type="button"
                  className="mt-2 text-sm text-red-600 hover:text-red-800"
                  onClick={() => removeQuestion(index)}
                >
                  Remove question
                </button>
              )}
            </div>
          ))}
          
          {questions.length < 5 && (
            <button
              type="button"
              className="inline-flex items-center text-sm text-cvsu-green hover:text-cvsu-green-dark"
              onClick={addQuestion}
            >
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add another question
            </button>
          )}
        </div>
        
        <div className="mt-6">
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cvsu-green hover:bg-cvsu-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Security Questions'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SecurityQuestionsSetup; 