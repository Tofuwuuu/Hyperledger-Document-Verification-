import { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  EyeIcon, 
  DocumentCheckIcon 
} from '@heroicons/react/24/outline';
import { adminVerificationService } from '../../services/api';
import { fixStaticFileUrl } from '../../utils/url';

export default function AdminVerificationPage() {
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);

  useEffect(() => {
    fetchVerificationRequests();
  }, [statusFilter]);

  const fetchVerificationRequests = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await adminVerificationService.getVerificationRequests(statusFilter);
      const data = response.data;
      
      setVerificationRequests(data);
      
      // If we had a selected request that's still in the new data, update it
      if (selectedRequest) {
        const updatedRequest = data.find(req => req.id === selectedRequest.id);
        if (updatedRequest) {
          setSelectedRequest(updatedRequest);
        } else if (data.length > 0) {
          // If our selected request is no longer in the list, select the first one
          setSelectedRequest(data[0]);
        } else {
          setSelectedRequest(null);
        }
      } else if (data.length > 0) {
        // If no request was selected and we have data, select the first one
        setSelectedRequest(data[0]);
      }
    } catch (err) {
      console.error('Error fetching verification requests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = (request) => {
    setSelectedRequest(request);
  };

  const handleApproveRequest = async (id) => {
    setProcessingAction(true);
    setCurrentRequestId(id);
    
    try {
      await adminVerificationService.approveVerification(id);
      
      // Refresh the list after approval
      await fetchVerificationRequests();
      
    } catch (err) {
      console.error('Error approving request:', err);
      setError(`Failed to approve document: ${err.message}`);
    } finally {
      setProcessingAction(false);
      setCurrentRequestId(null);
    }
  };

  const openRejectionModal = (id) => {
    setCurrentRequestId(id);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const handleRejectRequest = async () => {
    if (!currentRequestId) return;
    
    setProcessingAction(true);
    
    try {
      await adminVerificationService.rejectVerification(currentRequestId, rejectionReason);
      
      // Close the modal and refresh the list
      setShowRejectionModal(false);
      await fetchVerificationRequests();
      
    } catch (err) {
      console.error('Error rejecting request:', err);
      setError(`Failed to reject document: ${err.message}`);
    } finally {
      setProcessingAction(false);
      setCurrentRequestId(null);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="bg-white">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Document Verifications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and verify student documents before adding them to the blockchain
        </p>
      </div>

      {/* Status filter */}
      <div className="mb-6 flex space-x-3">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            statusFilter === 'pending' 
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            statusFilter === 'approved' 
              ? 'bg-green-100 text-green-800 border border-green-300' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            statusFilter === 'rejected' 
              ? 'bg-red-100 text-red-800 border border-red-300' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Rejected
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            statusFilter === 'all' 
              ? 'bg-blue-100 text-blue-800 border border-blue-300' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Requests
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading verification requests</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
                <button 
                  onClick={fetchVerificationRequests}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : verificationRequests.length === 0 ? (
        <div className="text-center py-10 px-6 border-2 border-dashed border-gray-300 rounded-lg">
          <DocumentCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No verification requests</h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no document verification requests with the selected status
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:space-x-8">
          {/* List of verification requests */}
          <div className="lg:w-2/3">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {verificationRequests.map((request) => (
                  <li 
                    key={request.id}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      selectedRequest && selectedRequest.id === request.id 
                        ? 'bg-gray-50 border-l-4 border-cvsu-green' 
                        : ''
                    }`}
                    onClick={() => handleViewRequest(request)}
                  >
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-cvsu-green truncate">
                          {request.documentType} - {request.studentName}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            request.status === 'pending' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : request.status === 'approved'
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            {request.program}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <p>
                            Submitted: {formatDate(request.submissionDate)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <p className="text-sm text-gray-500">
                          ID: {request.studentId}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRequest(request);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          View Details
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Detailed view of selected request */}
          {selectedRequest && (
            <div className="lg:w-2/5 mt-6 lg:mt-0 border border-gray-200 rounded-lg shadow-sm">
              <div className="px-4 py-5 sm:px-6 bg-gray-50 rounded-t-lg">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  Document Details
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {selectedRequest.documentType} submitted by {selectedRequest.studentName}
                </p>
              </div>

              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                {/* Document preview */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Document Preview</h4>
                  <div className="relative bg-gray-200 h-64 rounded flex items-center justify-center overflow-hidden">
                    <img 
                      src={fixStaticFileUrl(selectedRequest.documentPreviewUrl)} 
                      alt="Document Preview" 
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        e.target.onerror = null; 
                        e.target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg width="400" height="300" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="20" text-anchor="middle" fill="%23999"%3EPreview Not Available%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  <div className="mt-2 flex justify-center">
                    <a 
                      href={fixStaticFileUrl(selectedRequest.fileUrl)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-cvsu-green hover:text-cvsu-green-dark text-sm font-medium"
                    >
                      <span className="flex items-center">
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View full document
                      </span>
                    </a>
                  </div>
                </div>

                {/* Student information */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Student Information</h4>
                  <div className="bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-6 rounded-md">
                    <div className="text-sm font-medium text-gray-500">Student ID</div>
                    <div className="mt-1 text-sm text-gray-900 sm:mt-0">{selectedRequest.studentId}</div>
                  </div>
                  <div className="bg-white px-4 py-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-6">
                    <div className="text-sm font-medium text-gray-500">Program</div>
                    <div className="mt-1 text-sm text-gray-900 sm:mt-0">{selectedRequest.program}</div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-6 rounded-md">
                    <div className="text-sm font-medium text-gray-500">Submitted</div>
                    <div className="mt-1 text-sm text-gray-900 sm:mt-0">{formatDate(selectedRequest.submissionDate)}</div>
                  </div>
                </div>

                {/* Verification actions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Verification Actions</h4>
                  
                  {selectedRequest.status === 'pending' ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(selectedRequest.id)}
                          disabled={processingAction}
                          className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                            processingAction && currentRequestId === selectedRequest.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {processingAction && currentRequestId === selectedRequest.id ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircleIcon className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openRejectionModal(selectedRequest.id)}
                          disabled={processingAction}
                          className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                            processingAction ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-md p-4">
                      <div className="flex">
                        <div className={`flex-shrink-0 ${
                          selectedRequest.status === 'approved' 
                            ? 'text-green-500' 
                            : 'text-red-500'
                        }`}>
                          {selectedRequest.status === 'approved' 
                            ? <CheckCircleIcon className="h-5 w-5" /> 
                            : <XCircleIcon className="h-5 w-5" />}
                        </div>
                        <div className="ml-3">
                          <h3 className={`text-sm font-medium ${
                            selectedRequest.status === 'approved' 
                              ? 'text-green-800' 
                              : 'text-red-800'
                          }`}>
                            Document {selectedRequest.status === 'approved' ? 'approved' : 'rejected'}
                          </h3>
                          <div className="mt-2 text-sm text-gray-700">
                            <p>{selectedRequest.notes || 'No notes provided.'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rejection modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <XCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Reject Document Verification</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Please provide a reason for rejecting this document. This will be visible to the student.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <textarea
                  rows={4}
                  className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Enter rejection reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                  onClick={handleRejectRequest}
                  disabled={processingAction}
                >
                  {processingAction ? 'Processing...' : 'Reject Document'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green sm:mt-0 sm:col-start-1 sm:text-sm"
                  onClick={() => setShowRejectionModal(false)}
                  disabled={processingAction}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 