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
  UserCircleIcon,
  CalendarIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const DocumentRequestList = forwardRef((props, ref) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [requestsPerPage] = useState(5);

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
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationCircleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <ClockIcon className="h-3 w-3 mr-1" />Pending
        </span>;
      case 'processing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <ArrowPathIcon className="h-3 w-3 mr-1 animate-spin" />Processing
        </span>;
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircleIcon className="h-3 w-3 mr-1" />Completed
        </span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircleIcon className="h-3 w-3 mr-1" />Rejected
        </span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <ExclamationCircleIcon className="h-3 w-3 mr-1" />Unknown
        </span>;
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

  // Format exact date for detail view
  const formatExactDate = (createdAt) => {
    if (!createdAt) return 'N/A';
    
    const phtDate = toPhilippineTime(createdAt);
    return format(phtDate, 'MMMM d, yyyy h:mm a', { locale: enUS });
  };

  const filteredRequests = selectedFilter === 'all' 
    ? requests 
    : requests.filter(request => request.status === selectedFilter);

  // Handle request item click to show details
  const handleRequestClick = (request) => {
    setSelectedRequest(request);
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
  };

  // Pagination logic
  const indexOfLastRequest = currentPage * requestsPerPage;
  const indexOfFirstRequest = indexOfLastRequest - requestsPerPage;
  const currentRequests = filteredRequests.slice(indexOfFirstRequest, indexOfLastRequest);
  const totalPages = Math.ceil(filteredRequests.length / requestsPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

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
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          data-testid="refresh-button"
        >
          <ArrowPathIcon className="h-4 w-4 mr-1" />
          Refresh
        </button>
      </div>
      
      <div className="mb-6 bg-gray-50 p-3 rounded-lg">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'all'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'pending'
                ? 'bg-yellow-500 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setSelectedFilter('processing')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'processing'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Processing
          </button>
          <button
            onClick={() => setSelectedFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'completed'
                ? 'bg-green-500 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setSelectedFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'rejected'
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Rejected
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <ArrowPathIcon className="h-10 w-10 mx-auto text-primary-500 animate-spin" />
          <p className="mt-3 text-gray-600 font-medium">Loading your requests...</p>
        </div>
      ) : error ? (
        <div className="text-center py-4">
          {error.toLowerCase().includes('internal server error') ? (
            // Custom message for incomplete profile
            <div className="flex flex-col items-center py-6">
              <UserCircleIcon className="h-14 w-14 text-blue-500 mb-3" />
              <p className="text-lg font-medium text-gray-800">Please complete your profile</p>
              <p className="mt-2 text-gray-600 text-center max-w-md">
                To request documents, your profile must be complete with all required information. Please visit the Profile page to update your information.
              </p>
              <a 
                href="/dashboard/profile"
                className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors"
              >
                Complete Profile
              </a>
            </div>
          ) : (
            // Standard error message for other errors
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <ExclamationCircleIcon className="h-10 w-10 mx-auto text-red-500 mb-2" />
              <p className="mt-2 text-red-600 font-medium">{error}</p>
              <button
                onClick={fetchRequests}
                className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <DocumentIcon className="h-14 w-14 mx-auto text-gray-300 mb-2" />
          <p className="mt-2 text-lg font-medium text-gray-700">No document requests found</p>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            {selectedFilter === 'all' 
              ? "You haven't made any document requests yet. Create a new request to get started."
              : `You don't have any ${selectedFilter} requests.`}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <ul className="space-y-4">
            {currentRequests.map((request) => (
              <li 
                key={request._id} 
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleRequestClick(request)}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center mb-2">
                      <DocumentTextIcon className="h-5 w-5 text-gray-500 mr-2" />
                      <p className="text-base font-medium text-gray-900">
                        {formatDocumentType(request.document_type)}
                      </p>
                      <div className="ml-2">
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <CalendarIcon className="h-4 w-4 text-gray-400 mr-1" />
                      <span>{formatRequestTime(request.created_at)}</span>
                    </div>
                    
                    {request.admin_notes && (
                      <p className="mt-2 text-sm text-gray-600 bg-blue-50 p-2 rounded-md">
                        <span className="font-medium">Note:</span> {request.admin_notes}
                      </p>
                    )}
                    {request.rejection_reason && (
                      <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-md">
                        <span className="font-medium">Rejected:</span> {request.rejection_reason}
                      </p>
                    )}
                  </div>
                  
                  <div className="ml-4 flex flex-shrink-0 items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestClick(request);
                      }}
                      className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      <InformationCircleIcon className="h-4 w-4 mr-1" />
                      Details
                    </button>
                    
                    {request.status === 'completed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(request._id, request.document_type);
                        }}
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } border border-gray-300`}
                >
                  Previous
                </button>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`relative ml-3 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } border border-gray-300`}
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{indexOfFirstRequest + 1}</span> to{' '}
                    <span className="font-medium">
                      {indexOfLastRequest > filteredRequests.length
                        ? filteredRequests.length
                        : indexOfLastRequest}
                    </span>{' '}
                    of <span className="font-medium">{filteredRequests.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center rounded-l-md px-2 py-2 ${
                        currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      } border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:z-10`}
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    
                    {/* Page numbers */}
                    {[...Array(totalPages).keys()].map(number => (
                      <button
                        key={number + 1}
                        onClick={() => paginate(number + 1)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${
                          currentPage === number + 1
                            ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        } border focus:outline-none focus:ring-1 focus:ring-primary-500 focus:z-10`}
                      >
                        {number + 1}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center rounded-r-md px-2 py-2 ${
                        currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      } border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:z-10`}
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Request Detail Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            
            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  onClick={closeModal}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                      Document Request Details
                    </h3>
                    
                    <div className="mb-6 flex justify-center">
                      <div className={`inline-flex items-center px-4 py-2 rounded-full ${
                        selectedRequest.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : selectedRequest.status === 'processing'
                          ? 'bg-blue-100 text-blue-800'
                          : selectedRequest.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {getStatusIcon(selectedRequest.status)}
                        <span className="ml-2 font-medium">{getStatusText(selectedRequest.status)}</span>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Document Type</h4>
                          <p className="mt-1 text-sm font-semibold text-gray-900">{formatDocumentType(selectedRequest.document_type)}</p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Request Date</h4>
                          <p className="mt-1 text-sm text-gray-900">{formatExactDate(selectedRequest.created_at)}</p>
                        </div>
                        
                        {selectedRequest.purpose && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Purpose</h4>
                            <p className="mt-1 text-sm text-gray-900">{selectedRequest.purpose}</p>
                          </div>
                        )}
                        
                        {selectedRequest.admin_notes && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Admin Notes</h4>
                            <p className="mt-1 text-sm text-gray-900 bg-blue-50 p-2 rounded">{selectedRequest.admin_notes}</p>
                          </div>
                        )}
                        
                        {selectedRequest.rejection_reason && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Rejection Reason</h4>
                            <p className="mt-1 text-sm text-red-600 bg-red-50 p-2 rounded">{selectedRequest.rejection_reason}</p>
                          </div>
                        )}
                        
                        {selectedRequest.completed_at && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500">Completion Date</h4>
                            <p className="mt-1 text-sm text-gray-900">{formatExactDate(selectedRequest.completed_at)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {selectedRequest.status === 'completed' && (
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => handleDownload(selectedRequest._id, selectedRequest.document_type)}
                  >
                    <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                    Download Document
                  </button>
                )}
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// Maintain component name for debugging
DocumentRequestList.displayName = 'DocumentRequestList';

export default DocumentRequestList; 