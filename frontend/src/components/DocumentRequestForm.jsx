import React, { useState } from 'react';
import { documentRequestService } from '../services/api';
import { DOCUMENT_TYPE_OPTIONS } from '../constants/documentTypes';
import { toast as toastify } from 'react-toastify';

const DocumentRequestForm = ({ onRequestCreated }) => {
  const [documentType, setDocumentType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await documentRequestService.createDocumentRequest(documentType, purpose);
      
      if (response.success) {
        toastify.success('Your document request has been submitted successfully');
        
        // Reset form
        setDocumentType('');
        setPurpose('');
        
        // Notify parent component and trigger refresh
        if (onRequestCreated) {
          onRequestCreated(response.data, true); // Pass true to indicate refresh needed
        }
      } else {
        toastify.error(response.error || 'Failed to submit request');
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
      <p className="mb-4 text-sm text-gray-600">
        Requests can only be released from documents you already uploaded, admin approved, and recorded on the blockchain.
      </p>
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
              <option value="">Select a document type</option>
              {DOCUMENT_TYPE_OPTIONS.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
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
