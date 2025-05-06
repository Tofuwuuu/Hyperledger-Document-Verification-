import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { 
  DocumentIcon, 
  DocumentCheckIcon, 
  DocumentTextIcon, 
  EyeIcon,
  XCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { API_URL } from '../../config';
import { adminVerificationService, api, adminDocumentService } from '../../services/api';

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'verified', 'rejected'
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  useEffect(() => {
    fetchDocuments();
  }, [statusFilter]);
  
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await adminDocumentService.searchDocuments(statusFilter);
      
      if (result.success) {
        setDocuments(result.data.results || []);
        if (result.data.results && result.data.results.length > 0) {
          setSelectedDocument(result.data.results[0]);
        }
      } else {
        setError(result.error || 'Failed to fetch documents');
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err.message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };
  
  const handleViewDocument = (document) => {
    setSelectedDocument(document);
    setShowDetailsModal(true);
  };
  
  const handleApproveDocument = async (id) => {
    try {
      await adminVerificationService.approveVerification(id);
      await fetchDocuments();
      setShowDetailsModal(false);
    } catch (err) {
      console.error('Error approving document:', err);
      setError('Failed to approve document: ' + err.message);
    }
  };
  
  const handleRejectDocument = async (id) => {
    try {
      await adminVerificationService.rejectVerification(id, 'Document rejected by admin');
      await fetchDocuments();
      setShowDetailsModal(false);
    } catch (err) {
      console.error('Error rejecting document:', err);
      setError('Failed to reject document: ' + err.message);
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>
      case 'verified':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Verified</span>
      case 'rejected':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Rejected</span>
      default:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Unknown</span>
    }
  };
  
  // Add a function to download and preview document files
  const handleDownloadDocument = async (fileUrl) => {
    try {
      window.open(`${API_URL}${fileUrl}`, '_blank');
    } catch (err) {
      console.error('Error downloading document:', err);
      setError('Failed to download document: ' + err.message);
    }
  };
  
  return (
    <div className="bg-white">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Document Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          View, verify and manage all uploaded documents
        </p>
      </div>
      
      {/* Status filter */}
      <div className="mb-6 flex space-x-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            statusFilter === 'all' 
              ? 'bg-blue-100 text-blue-800 border border-blue-300' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Documents
        </button>
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
          onClick={() => setStatusFilter('verified')}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            statusFilter === 'verified' 
              ? 'bg-green-100 text-green-800 border border-green-300' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Verified
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
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading documents</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
                <button 
                  onClick={fetchDocuments}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-10 px-6 border-2 border-dashed border-gray-300 rounded-lg">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no documents with the selected status
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Document
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uploaded
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {documents.map((document) => (
                      <tr key={document._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-md">
                              <DocumentTextIcon className="h-6 w-6 text-gray-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {document.title}
                              </div>
                              <div className="text-sm text-gray-500">
                                {document.description || 'No description'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{document.document_type}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(document.verification_status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(document.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                            onClick={() => handleViewDocument(document)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Document Details Modal */}
      {showDetailsModal && selectedDocument && (
        <div className="fixed inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowDetailsModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Document Details
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">Title</p>
                        <p className="text-sm font-medium text-gray-900">{selectedDocument.title}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Type</p>
                        <p className="text-sm font-medium text-gray-900">{selectedDocument.document_type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <p className="text-sm font-medium text-gray-900">{selectedDocument.verification_status}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Uploaded</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(selectedDocument.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Document Preview</p>
                        <div className="mt-2 border rounded p-2 flex items-center justify-center h-48 bg-gray-100">
                          {selectedDocument.file_path ? (
                            <a 
                              href={`${API_URL}/${selectedDocument.file_path}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              View Document
                            </a>
                          ) : (
                            <p className="text-sm text-gray-500">No preview available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {selectedDocument.verification_status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={() => handleApproveDocument(selectedDocument._id)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={() => handleRejectDocument(selectedDocument._id)}
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowDetailsModal(false)}
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
} 