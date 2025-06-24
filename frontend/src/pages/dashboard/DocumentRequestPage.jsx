import React, { useRef } from 'react';
import DocumentRequestForm from '../../components/DocumentRequestForm';
import DocumentRequestList from '../../components/DocumentRequestList';
import { DocumentTextIcon, HomeIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

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
    <div className="bg-gray-50 min-h-screen py-6">
      {/* Breadcrumbs */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li>
            <Link to="/dashboard" className="hover:text-gray-700 flex items-center">
              <HomeIcon className="h-4 w-4 mr-1 flex-shrink-0" />
              Dashboard
            </Link>
          </li>
          <li className="flex items-center">
            <ChevronRightIcon className="h-4 w-4 flex-shrink-0" />
            <span className="ml-2 text-gray-700 font-medium">Document Requests</span>
          </li>
        </ol>
      </nav>
      
      {/* Page header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-primary-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Document Requests</h1>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Request and manage your official university documents
            </p>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Request form */}
          <div className="lg:col-span-1">
            <DocumentRequestForm onRequestCreated={handleRequestCreated} />
          </div>
          
          {/* Request list */}
          <div className="lg:col-span-2">
            <DocumentRequestList ref={requestListRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentRequestPage; 