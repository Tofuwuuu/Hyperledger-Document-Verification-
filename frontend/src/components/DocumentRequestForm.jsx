import React, { useEffect, useState } from 'react';
import { documentRequestService } from '../services/api';
import { toast as toastify } from 'react-toastify';

const DocumentRequestForm = ({ onRequestCreated }) => {
  const [documentType, setDocumentType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [availableTypes, setAvailableTypes] = useState([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [typesError, setTypesError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAvailableTypes = async () => {
    setIsLoadingTypes(true);
    setTypesError('');

    const response = await documentRequestService.getAvailableDocumentTypes();
    if (response.success) {
      const types = Array.isArray(response.data) ? response.data : [];
      setAvailableTypes(types);
      if (documentType && !types.some((type) => type.id === documentType)) {
        setDocumentType('');
      }
    } else {
      setAvailableTypes([]);
      setDocumentType('');
      setTypesError(response.error || 'Failed to load available document types');
    }

    setIsLoadingTypes(false);
  };

  useEffect(() => {
    fetchAvailableTypes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!documentType) {
      toastify.error('Please select an available document type');
      return;
    }

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
              disabled={isLoadingTypes || availableTypes.length === 0}
              required
            >
              <option value="">
                {isLoadingTypes
                  ? 'Loading available documents...'
                  : availableTypes.length === 0
                    ? 'No approved blockchain documents available'
                    : 'Select a document type'}
              </option>
              {availableTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
            {typesError && (
              <p className="mt-2 text-sm text-red-600">{typesError}</p>
            )}
            {!isLoadingTypes && !typesError && availableTypes.length === 0 && (
              <p className="mt-2 text-sm text-gray-500">
                Upload a document and wait for admin approval before requesting it.
              </p>
            )}
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
              disabled={isSubmitting || isLoadingTypes || availableTypes.length === 0}
              className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                isSubmitting || isLoadingTypes || availableTypes.length === 0 ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
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
