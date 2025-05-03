import React, { useState, useEffect } from 'react';
import { adminDocumentRequestService } from '../../services/api';
import { toast } from 'react-toastify';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  XCircleIcon,
  DocumentCheckIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

const AdminDocumentRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      const response = await adminDocumentRequestService.getAllDocumentRequests(
        selectedFilter !== 'all' ? selectedFilter : null
      );
      if (response.success) {
        setRequests(response.data);
      } else {
        const errorMsg = response.error || 'Failed to load document requests';
        
        // Check if it's a database connection error
        if (errorMsg.includes('Database connection not available') || 
            errorMsg.includes('MongoDB connection')) {
          setError('Database connection issue. The server cannot connect to the database. Please try again later or contact support.');
        } else {
          setError(errorMsg);
        }
        
        toast.error(errorMsg);
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
    fetchRequests();
  }, [selectedFilter]);

  const handleRequestSelect = (request) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes || '');
    setRejectionReason(request.rejection_reason || '');
  };

  const handleGenerateDocument = async () => {
    if (!selectedRequest) return;
    
    setIsGenerating(true);
    try {
      const response = await adminDocumentRequestService.generateDocument(selectedRequest._id);
      
      if (response.success) {
        toast.success('Document generated successfully');
        
        // Update the request in the list
        setRequests(requests.map(r => 
          r._id === selectedRequest._id 
            ? { ...r, status: 'completed', document_id: response.data.document_id } 
            : r
        ));
        
        // Update selected request
        setSelectedRequest({
          ...selectedRequest,
          status: 'completed',
          document_id: response.data.document_id
        });
        
        // Refresh the list
        fetchRequests();
      } else {
        toast.error(response.error || 'Failed to generate document');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Error generating document:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedRequest) return;
    
    setIsUpdating(true);
    try {
      const response = await adminDocumentRequestService.updateDocumentRequestStatus(
        selectedRequest._id,
        newStatus,
        adminNotes,
        newStatus === 'rejected' ? rejectionReason : null
      );
      
      if (response.success) {
        toast.success(`Request status updated to ${newStatus}`);
        
        // Update the request in the list
        setRequests(requests.map(r => 
          r._id === selectedRequest._id 
            ? { ...r, status: newStatus, admin_notes: adminNotes, rejection_reason: newStatus === 'rejected' ? rejectionReason : null } 
            : r
        ));
        
        // Update selected request
        setSelectedRequest({
          ...selectedRequest,
          status: newStatus,
          admin_notes: adminNotes,
          rejection_reason: newStatus === 'rejected' ? rejectionReason : null
        });
        
        // Refresh the list
        fetchRequests();
      } else {
        toast.error(response.error || 'Failed to update request status');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Error updating status:', error);
    } finally {
      setIsUpdating(false);
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

  const formatDocumentType = (type) => {
    return type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
        <h2 className="text-lg font-medium text-gray-900">Document Requests</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage document requests from alumni
        </p>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* List Panel */}
        <div className="w-full md:w-1/2 border-r border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <div>
              <div className="flex space-x-2 overflow-x-auto pb-1">
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
            <button
              onClick={fetchRequests}
              className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
            >
              <ArrowPathIcon className="h-4 w-4 mr-1" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <ArrowPathIcon className="h-8 w-8 mx-auto text-gray-400 animate-spin" />
              <p className="mt-2 text-gray-500">Loading requests...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-500">
              <ExclamationCircleIcon className="h-8 w-8 mx-auto" />
              <p className="mt-2">{error}</p>
              <button
                onClick={fetchRequests}
                className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm"
              >
                Try Again
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <DocumentIcon className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-2">No document requests found</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[70vh]">
              <ul className="divide-y divide-gray-200">
                {requests.map((request) => (
                  <li 
                    key={request._id} 
                    className={`px-4 py-4 hover:bg-gray-50 cursor-pointer ${
                      selectedRequest?._id === request._id ? 'bg-gray-50 border-l-4 border-primary-500' : ''
                    }`}
                    onClick={() => handleRequestSelect(request)}
                  >
                    <div className="flex items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center">
                          {getStatusIcon(request.status)}
                          <p className="ml-2 text-sm font-medium text-gray-900">
                            {formatDocumentType(request.document_type)}
                          </p>
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          <p>
                            <span className="font-medium">Alumni:</span> {request.alumni_name || 'Unknown'}
                          </p>
                          <p>
                            <span className="font-medium">Student ID:</span> {request.student_id || 'N/A'}
                          </p>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {request.created_at
                            ? formatDistanceToNow(new Date(request.created_at), { addSuffix: true })
                            : 'Recently'}
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          request.status === 'completed' ? 'bg-green-100 text-green-800' :
                          request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {request.status?.charAt(0).toUpperCase() + request.status?.slice(1)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="w-full md:w-1/2 p-4">
          {selectedRequest ? (
            <div>
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-medium text-gray-900">Request Details</h3>
              </div>

              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Document Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDocumentType(selectedRequest.document_type)}</dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1 text-sm text-gray-900 flex items-center">
                    {getStatusIcon(selectedRequest.status)}
                    <span className="ml-1">{selectedRequest.status?.charAt(0).toUpperCase() + selectedRequest.status?.slice(1)}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Requested By</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedRequest.alumni_name || 'Unknown'}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Student ID</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedRequest.student_id || 'N/A'}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Course</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedRequest.course || 'N/A'}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Graduation Year</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedRequest.graduation_year || 'N/A'}</dd>
                </div>

                {selectedRequest.purpose && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Purpose</dt>
                    <dd className="mt-1 text-sm text-gray-900">{selectedRequest.purpose}</dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm font-medium text-gray-500">Admin Notes</dt>
                  <dd className="mt-1 text-sm">
                    <textarea
                      rows={3}
                      className="shadow-sm block w-full focus:ring-primary-500 focus:border-primary-500 sm:text-sm border border-gray-300 rounded-md"
                      placeholder="Add notes for this request (optional)"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      disabled={isUpdating || selectedRequest.status === 'completed' || selectedRequest.status === 'rejected'}
                    />
                  </dd>
                </div>

                {(selectedRequest.status === 'rejected' || selectedFilter === 'rejected') && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Rejection Reason</dt>
                    <dd className="mt-1 text-sm">
                      <textarea
                        rows={2}
                        className="shadow-sm block w-full focus:ring-primary-500 focus:border-primary-500 sm:text-sm border border-gray-300 rounded-md"
                        placeholder="Reason for rejection (required if rejecting)"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        disabled={isUpdating || selectedRequest.status === 'completed' || selectedRequest.status === 'rejected'}
                      />
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-6 space-x-3 flex flex-wrap gap-y-3">
                {selectedRequest.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      onClick={() => handleStatusUpdate('processing')}
                      disabled={isUpdating}
                    >
                      <ArrowPathIcon className="h-5 w-5 mr-2" />
                      Approve & Process
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      onClick={() => handleStatusUpdate('rejected')}
                      disabled={isUpdating || !rejectionReason}
                    >
                      <XCircleIcon className="h-5 w-5 mr-2" />
                      Reject Request
                    </button>
                  </>
                )}

                {selectedRequest.status === 'processing' && (
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    onClick={handleGenerateDocument}
                    disabled={isGenerating}
                  >
                    <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                    {isGenerating ? 'Generating...' : 'Generate Document'}
                  </button>
                )}

                {selectedRequest.status === 'completed' && selectedRequest.document_id && (
                  <a
                    href={`/api/v1/document-requests/${selectedRequest._id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mr-2 inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                    Download
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <DocumentCheckIcon className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-2">Select a request to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDocumentRequests; 