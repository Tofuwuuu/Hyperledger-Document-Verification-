import React, { useState } from 'react';
import { documentRequestService } from '../services/api';
import { toast as toastify } from 'react-toastify';
import { Link } from 'react-router-dom';

const DocumentRequestForm = ({ onRequestCreated }) => {
  const [documentType, setDocumentType] = useState('good_moral');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProfileError, setShowProfileError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setShowProfileError(false);

    try {
      const response = await documentRequestService.createDocumentRequest(documentType, purpose);
      
      if (response.success) {
        toastify.success('Your document request has been submitted successfully');
        
        // Reset form
        setDocumentType('good_moral');
        setPurpose('');
        
        // Notify parent component and trigger refresh
        if (onRequestCreated) {
          onRequestCreated(response.data, true); // Pass true to indicate refresh needed
        }
      } else {
        const errorMsg = response.error || 'Failed to submit request';
        
        // Check if it's an internal server error (likely due to incomplete profile)
        if (errorMsg.toLowerCase().includes('internal server error')) {
          toastify.error('Please complete your profile before requesting documents');
          setShowProfileError(true);
        } else {
          toastify.error(errorMsg);
        }
      }
    } catch (error) {
      toastify.error('An unexpected error occurred');
      console.error('Error creating document request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 shadow rounded-lg">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Request a Document</h2>
      
      {showProfileError && (
        <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                You need to complete your profile before requesting documents.
                <Link to="/dashboard/profile" className="font-medium text-blue-700 underline ml-1">
                  Complete your profile here
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="documentType" className="block text-sm font-medium text-gray-700">
              Document Type
            </label>
            <select
              id="documentType"
              name="documentType"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              required
            >
              <option value="good_moral">Good Moral Certificate</option>
              <option value="certification">General Certification</option>
              <option value="enrollment">Enrollment Certificate</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">
              Purpose (Optional)
            </label>
            <textarea
              id="purpose"
              name="purpose"
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Why do you need this document?"
              className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                isSubmitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default DocumentRequestForm; 