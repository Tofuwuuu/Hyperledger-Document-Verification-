import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { documentRequestService } from '../services/api';
import { toast as toastify } from 'react-toastify';
import { formatDistanceToNow, format, addHours } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  XCircleIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';

const DocumentRequestList = forwardRef((props, ref) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const fetchRequests = async () => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      const response = await documentRequestService.getDocumentRequests();
      if (response.success) {
        setRequests(response.data);
      } else {
        const errorMsg = response.error || 'Failed to load document requests';
        
        // Check if it's a database connection error
        if (errorMsg.includes('Database connection not available') || 
            errorMsg.includes('MongoDB connection')) {
          setError('Database connection issue. The server cannot connect to the database. Please try again later.');
        } else {
          setError(errorMsg);
        }
        toastify.error(errorMsg);
      }
    } catch (error) {
      const errorMsg = error.message || 'An unexpected error occurred';
      setError(errorMsg);
      console.error('Error fetching document requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch requests automatically on component mount
    fetchRequests();
  }, []);

  const handleDownload = async (requestId, documentType) => {
    try {
      const filename = `${documentType.replace('_', '-')}.pdf`;
      const response = await documentRequestService.downloadGeneratedDocument(requestId, filename);
      
      if (!response.success) {
        toastify.error(response.error || 'Failed to download document');
      }
    } catch (error) {
      toastify.error('An unexpected error occurred');
      console.error('Error downloading document:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'processing':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500" />;
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationCircleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Unknown';
    }
  };

  const formatDocumentType = (type) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Convert UTC date to Philippine time (GMT+8)
  const toPhilippineTime = (utcDate) => {
    if (!utcDate) return null;
    const date = new Date(utcDate);
    return addHours(date, 8); // Add 8 hours for Philippine time
  };

  // Format the request date in Philippine time
  const formatRequestTime = (createdAt) => {
    if (!createdAt) return 'Recently requested';
    
    const phtDate = toPhilippineTime(createdAt);
    return `Requested ${formatDistanceToNow(phtDate, { locale: enUS })} ago`;
  };

  const filteredRequests = selectedFilter === 'all' 
    ? requests 
    : requests.filter(request => request.status === selectedFilter);

  // Expose the fetchRequests method to parent components
  useImperativeHandle(ref, () => ({
    fetchRequests
  }));

  return (
    <div className="bg-white p-4 sm:p-6 shadow rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">My Document Requests</h2>
        <button
          onClick={fetchRequests}
          className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
          data-testid="refresh-button"
        >
          <ArrowPathIcon className="h-4 w-4 mr-1" />
          Refresh
        </button>
      </div>
      
      <div className="mb-4">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedFilter === 'all'
                ? 'bg-primary-100 text-primary-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedFilter('pending')}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedFilter === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setSelectedFilter('processing')}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedFilter === 'processing'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Processing
          </button>
          <button
            onClick={() => setSelectedFilter('completed')}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedFilter === 'completed'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setSelectedFilter('rejected')}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedFilter === 'rejected'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Rejected
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <ArrowPathIcon className="h-8 w-8 mx-auto text-gray-400 animate-spin" />
          <p className="mt-2 text-gray-500">Loading requests...</p>
        </div>
      ) : error ? (
        <div className="text-center py-4">
          {error.toLowerCase().includes('internal server error') ? (
            // Custom message for incomplete profile
            <div className="flex flex-col items-center">
              <UserCircleIcon className="h-12 w-12 text-blue-500 mb-2" />
              <p className="text-lg font-medium text-gray-800">Please complete your profile</p>
              <p className="mt-2 text-gray-600 text-center max-w-md">
                To request documents, your profile must be complete with all required information. Please visit the Profile page to update your information.
              </p>
              <a 
                href="/dashboard/profile"
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm"
              >
                Complete Profile
              </a>
            </div>
          ) : (
            // Standard error message for other errors
            <>
              <ExclamationCircleIcon className="h-8 w-8 mx-auto text-red-500" />
              <p className="mt-2 text-red-500">{error}</p>
              <button
                onClick={fetchRequests}
                className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <DocumentIcon className="h-12 w-12 mx-auto text-gray-300" />
          <p className="mt-2">No document requests found</p>
          <p className="mt-1 text-sm">Create a new document request to get started</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {filteredRequests.map((request) => (
              <li key={request._id} className="py-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center">
                      {getStatusIcon(request.status)}
                      <p className="ml-2 text-sm font-medium text-gray-900">
                        {formatDocumentType(request.document_type)}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span className="truncate">
                        Status: {getStatusText(request.status)}
                      </span>
                      <span className="mx-1">•</span>
                      <span>
                        {formatRequestTime(request.created_at)}
                      </span>
                    </div>
                    {request.admin_notes && (
                      <p className="mt-1 text-sm text-gray-600">
                        <span className="font-medium">Note:</span> {request.admin_notes}
                      </p>
                    )}
                    {request.rejection_reason && (
                      <p className="mt-1 text-sm text-red-600">
                        <span className="font-medium">Rejected:</span> {request.rejection_reason}
                      </p>
                    )}
                  </div>
                  {request.status === 'completed' && (
                    <button
                      onClick={() => handleDownload(request._id, request.document_type)}
                      className="ml-4 flex-shrink-0 text-sm font-medium text-primary-600 hover:text-primary-800 flex items-center"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5 mr-1" />
                      Download
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

// Maintain component name for debugging
DocumentRequestList.displayName = 'DocumentRequestList';

export default DocumentRequestList; 