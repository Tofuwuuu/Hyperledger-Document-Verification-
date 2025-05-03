import React, { useRef } from 'react';
import DocumentRequestForm from '../../components/DocumentRequestForm';
import DocumentRequestList from '../../components/DocumentRequestList';

const DocumentRequestPage = () => {
  const requestListRef = useRef(null);

  const handleRequestCreated = (data, shouldRefresh) => {
    // Check if we should refresh the list
    if (shouldRefresh && requestListRef.current && requestListRef.current.fetchRequests) {
      // Use the ref's fetchRequests method if available
      requestListRef.current.fetchRequests();
    } else {
      // Fallback to clicking the refresh button
      const refreshButton = document.querySelector('[data-testid="refresh-button"]');
      if (refreshButton) {
        refreshButton.click();
      }
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Document Requests</h1>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="py-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <DocumentRequestForm onRequestCreated={handleRequestCreated} />
            </div>
            <div className="lg:col-span-2">
              <DocumentRequestList ref={requestListRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentRequestPage; 