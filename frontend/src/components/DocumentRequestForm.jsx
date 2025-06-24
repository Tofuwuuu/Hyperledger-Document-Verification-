import React, { useState } from 'react';
import { documentRequestService } from '../services/api';
import { toast as toastify } from 'react-toastify';
import { Link } from 'react-router-dom';
import { InformationCircleIcon, DocumentTextIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';

const DocumentRequestForm = ({ onRequestCreated }) => {
  const [documentType, setDocumentType] = useState('good_moral');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProfileError, setShowProfileError] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setShowProfileError(false);
    setShowSuccessMessage(false);

    try {
      const response = await documentRequestService.createDocumentRequest(documentType, purpose);
      
      if (response.success) {
        toastify.success('Your document request has been submitted successfully');
        
        // Show success message
        setShowSuccessMessage(true);
        
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

  // Document type descriptions
  const documentDescriptions = {
    good_moral: "A certificate attesting to your good moral character during your stay at the university.",
    certification: "A general certification documenting your status as a graduate of the university.",
    enrollment: "A certificate confirming your enrollment status at the university."
  };

  return (
    <div className="bg-white p-6 shadow rounded-lg border border-gray-200">
      <div className="flex items-center space-x-2 mb-6">
        <DocumentTextIcon className="h-6 w-6 text-primary-600" />
        <h2 className="text-xl font-semibold text-gray-900">Request a Document</h2>
      </div>
      
      {showSuccessMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Your request has been submitted successfully!
              </p>
              <p className="mt-1 text-sm text-green-700">
                You can check the status in the document list.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {showProfileError && (
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <InformationCircleIcon className="h-5 w-5 text-blue-500" />
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
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 mb-1">
            Document Type
          </label>
          <select
            id="documentType"
            name="documentType"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            required
          >
            <option value="good_moral">Good Moral Certificate</option>
            <option value="certification">General Certification</option>
            <option value="enrollment">Enrollment Certificate</option>
          </select>
          <p className="mt-2 text-sm text-gray-500">
            {documentDescriptions[documentType]}
          </p>
        </div>
        
        <div>
          <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
            Purpose (Optional)
          </label>
          <textarea
            id="purpose"
            name="purpose"
            rows={3}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Why do you need this document?"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
          <p className="mt-2 text-sm text-gray-500">
            Providing a purpose helps us process your request more efficiently.
          </p>
        </div>
        
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full inline-flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900'
            } transition-colors`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              'Submit Request'
            )}
          </button>
        </div>
      </form>
      
      <div className="mt-6 rounded-md bg-gray-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <InformationCircleIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-800">Processing Information</h3>
            <div className="mt-2 text-sm text-gray-600">
              <ul className="list-disc space-y-1 pl-5">
                <li>Document requests are typically processed within 1-3 business days.</li>
                <li>Once completed, you will receive a notification and can download your document.</li>
                <li>For urgent requests, please contact the registrar's office directly.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentRequestForm; 