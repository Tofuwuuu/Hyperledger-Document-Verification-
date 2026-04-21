import { useState, useEffect } from 'react';
import { 
  PaperClipIcon, 
  ArrowUpTrayIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  CubeTransparentIcon,
  ClockIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  DocumentIcon,
  ArrowUpCircleIcon,
  FingerPrintIcon,
  InformationCircleIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { documentService, alumniService, verificationService } from '../../services/api';
import documentVerificationService from '../../services/document';
import { Link } from 'react-router-dom';
import { calculateDocumentHash } from '../../services/document';
import { sha256 } from 'js-sha256';

export default function DocumentsPage() {
  const { currentUser } = useAuth();
  const [alumniProfile, setAlumniProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showBlockchainModal, setShowBlockchainModal] = useState(false);
  const [blockchainHistory, setBlockchainHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [blockchainDetails, setBlockchainDetails] = useState(null);
  const [verifyingDocument, setVerifyingDocument] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [filteredDocuments, setFilteredDocuments] = useState([]);

  useEffect(() => {
    fetchAlumniProfile();
  }, [currentUser]);

  const fetchAlumniProfile = async () => {
    // Check if currentUser is properly loaded
    if (!currentUser) {
      setError('User information is not loaded. Please try logging in again.');
      setLoading(false);
      return;
    }
    
    // Use either id or _id, whichever is available
    const userId = currentUser.id || currentUser._id;
    
    if (!userId) {
      console.error('User ID is undefined:', currentUser);
      setError('Cannot load alumni profile: User ID is missing. Please try logging out and back in.');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      console.log(`Fetching alumni profile for user ID: ${userId}`);
      const response = await alumniService.getAlumniByUserId(userId);
      setAlumniProfile(response.data);
      
      // Fetch documents
      if (response.data && response.data._id) {
        fetchDocuments(response.data._id);
      }
    } catch (error) {
      console.error('Error fetching alumni profile:', error);
      if (error.response && error.response.status === 404) {
        setError('You need to create an alumni profile to view documents. Please complete your profile first.');
      } else {
        setError(`Failed to load alumni profile: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (alumniId) => {
    setLoading(true);
    try {
      const response = await documentService.getAlumniDocuments(alumniId);
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const viewBlockchainDetails = async (document) => {
    setSelectedDocument(document);
    setShowBlockchainModal(true);
    setLoadingHistory(true);
    
    try {
      // Fetch blockchain history for the document
      const historyResponse = await verificationService.getDocumentHistory(document._id);
      if (historyResponse.data && historyResponse.data.success) {
        setBlockchainHistory(historyResponse.data.history || []);
      } else {
        setBlockchainHistory([]);
      }
    } catch (error) {
      console.error('Error fetching blockchain history:', error);
      setBlockchainHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeBlockchainModal = () => {
    setShowBlockchainModal(false);
    setSelectedDocument(null);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'pending':
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    }
  };
  
  // Function to capitalize and format status text
  const formatStatus = (status) => {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };
  
  // Function to get the title from document type
  const getDocumentTypeTitle = (type) => {
    const types = {
      'diploma': 'Diploma',
      'transcript': 'Transcript of Records',
      'certificate': 'Certificate',
      'id': 'ID Card',
      'other': 'Other Document'
    };
    return types[type] || type;
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const viewDocument = (document) => {
    // Open document in new tab
    if (document.file_path) {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      window.open(`${baseUrl}/${document.file_path}`, '_blank');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploading(true);
    setUploadErrorMessage('');
    
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      formData.append('document_type', 'certificate'); // Default type
      formData.append('description', 'Uploaded on ' + new Date().toLocaleDateString());
      
      // Upload with blockchain verification
      const response = await documentVerificationService.uploadDocumentWithVerification(formData);
      
      if (response.success) {
        // Add new document to the list
        const newDoc = {
          id: response.document_id,
          name: file.name,
          description: 'Uploaded on ' + new Date().toLocaleDateString(),
          uploadDate: new Date().toISOString().split('T')[0],
          size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
          status: 'pending',
          hash: response.hash,
          blockchain_tx_id: response.blockchain_tx_id
        };
        
        setDocuments([newDoc, ...documents]);
        setUploadSuccess(true);
        
        // Reset success message after 3 seconds
        setTimeout(() => {
          setUploadSuccess(false);
        }, 3000);
      } else {
        setUploadErrorMessage(response.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadErrorMessage('Failed to upload document: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleViewDetails = async (document) => {
    setSelectedDocument(document);
    setBlockchainDetails(null);
    setShowDetailsModal(true);
    
    // If the document has a blockchain transaction ID, fetch blockchain details
    if (document.blockchain_tx_id) {
      try {
        const response = await documentVerificationService.getDocumentVerificationHistory(document.id);
        if (response.success) {
          setBlockchainDetails(response.history);
        }
      } catch (error) {
        console.error('Error fetching blockchain details:', error);
      }
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedDocument(null);
    setBlockchainDetails(null);
  };

  const verifyDocumentOnBlockchain = async (document) => {
    if (!document || !document.file_hash) {
      return;
    }
    
    setVerifyingDocument(true);
    try {
      // Since we don't have the actual file, we'll use the hash directly
      const response = await documentVerificationService.verifyDocumentOnBlockchain(
        document.id,
        document.file_hash
      );
      
      // Update the document verification status
      if (response.data?.verified) {
        setDocuments(documents.map(doc => {
          if (doc.id === document.id) {
            return {
              ...doc,
              verification_status: 'verified',
              verification_date: new Date().toISOString()
            };
          }
          return doc;
        }));
        
        setSelectedDocument({
          ...selectedDocument,
          verification_status: 'verified',
          verification_date: new Date().toISOString()
        });
        
        // Fetch updated blockchain details
        const historyResponse = await documentVerificationService.getDocumentVerificationHistory(document.id);
        if (historyResponse.success) {
          setBlockchainDetails(historyResponse.history);
        }
      }
    } catch (error) {
      console.error('Error verifying document on blockchain:', error);
    } finally {
      setVerifyingDocument(false);
    }
  };

  useEffect(() => {
    if (!documents || documents.length === 0) {
      setFilteredDocuments([]);
      return;
    }
    
    let filtered = [...documents];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc => 
        (doc.title && doc.title.toLowerCase().includes(query)) || 
        (doc.description && doc.description.toLowerCase().includes(query)) ||
        (doc.document_type && doc.document_type.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.verification_status === statusFilter);
    }
    
    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(doc => doc.document_type === typeFilter);
    }
    
    setFilteredDocuments(filtered);
  }, [documents, searchQuery, statusFilter, typeFilter]);
  
  // Get unique document types for filter dropdown
  const uniqueDocTypes = documents.length 
    ? ['all', ...new Set(documents.map(doc => doc.document_type))]
    : ['all'];
    
  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">My Documents</h2>
        
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {uploadSuccess && (
          <div className="rounded-md bg-green-50 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Document was uploaded successfully!</p>
              </div>
            </div>
          </div>
        )}
        
        {uploadErrorMessage && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{uploadErrorMessage}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Link
              to="/alumni/documents/upload"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
            >
              <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5" />
              Upload New Document
            </Link>
          </div>
        </div>
        
        {/* Search and Filtering UI */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4">
            {/* Search input */}
            <div className="flex-1">
              <label htmlFor="search" className="sr-only">Search documents</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="search"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="focus:ring-cvsu-green focus:border-cvsu-green block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  placeholder="Search by title, description or type"
                />
              </div>
            </div>
            
            {/* Status filter */}
            <div className="w-full md:w-48">
              <label htmlFor="status-filter" className="sr-only">Filter by status</label>
              <select
                id="status-filter"
                name="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm rounded-md"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            
            {/* Document type filter */}
            <div className="w-full md:w-48">
              <label htmlFor="type-filter" className="sr-only">Filter by type</label>
              <select
                id="type-filter"
                name="type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm rounded-md"
              >
                <option value="all">All Types</option>
                {uniqueDocTypes.filter(type => type !== 'all').map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {/* Reset button */}
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
            >
              Reset Filters
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center my-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
            <p className="mt-1 text-sm text-gray-500">You haven't uploaded any documents yet.</p>
            <div className="mt-6">
              <Link
                to="/alumni/documents/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cvsu-green hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
              >
                <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Upload a Document
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden border border-gray-200 sm:rounded-lg">
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
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((document) => (
                  <tr key={document._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                          {document.document_type === 'diploma' ? (
                            <AcademicCapIcon className="h-6 w-6 text-gray-500" />
                          ) : document.document_type === 'transcript' ? (
                            <DocumentTextIcon className="h-6 w-6 text-gray-500" />
                          ) : document.document_type === 'certificate' ? (
                            <DocumentIcon className="h-6 w-6 text-gray-500" />
                          ) : (
                            <PaperClipIcon className="h-6 w-6 text-gray-500" />
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                            {document.title}
                            {document.verification_status === 'verified' && (
                              <span className="ml-2" title="Blockchain Verified">
                                <FingerPrintIcon className="h-4 w-4 text-green-500" />
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {document.description || 'No description provided'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getDocumentTypeTitle(document.document_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-medium rounded-full border ${getStatusBadgeClass(document.verification_status)}`}>
                          <span className="mr-1">{getStatusIcon(document.verification_status)}</span>
                          <span>{formatStatus(document.verification_status)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(document.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => viewDocument(document)}
                          className="text-gray-600 hover:text-gray-900"
                          title="View Document"
                        >
                          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                        </button>
                        {document.verification_status === 'verified' && (
                          <button
                            onClick={() => viewBlockchainDetails(document)}
                            className="text-cvsu-green hover:text-cvsu-green/80"
                            title="View Blockchain Details"
                          >
                            <CubeTransparentIcon className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleViewDetails(document)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Document Details"
                        >
                          <InformationCircleIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Blockchain Modal */}
      {showBlockchainModal && selectedDocument && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closeBlockchainModal}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <CubeTransparentIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Blockchain Verification Details
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 mb-2">
                        This document has been verified and stored on the blockchain for immutable proof.
                      </p>
                      
                      <div className="mt-4 bg-gray-50 p-3 rounded-md mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Document Information</h4>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <span className="text-gray-500">Document ID:</span>
                          <span className="col-span-2 break-all font-mono">{selectedDocument._id}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                          <span className="text-gray-500">Document Hash:</span>
                          <span className="col-span-2 break-all font-mono">{selectedDocument.file_hash || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                          <span className="text-gray-500">Verified On:</span>
                          <span className="col-span-2">{formatDate(selectedDocument.verification_date)}</span>
                        </div>
                        {selectedDocument.blockchain_tx_id && (
                          <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                            <span className="text-gray-500">Transaction ID:</span>
                            <span className="col-span-2 break-all font-mono">{selectedDocument.blockchain_tx_id}</span>
                          </div>
                        )}
                      </div>
                      
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Blockchain Transaction History</h4>
                      
                      {loadingHistory ? (
                        <div className="flex justify-center my-4">
                          <div className="animate-spin h-5 w-5 border-2 border-cvsu-green rounded-full border-t-transparent"></div>
                        </div>
                      ) : blockchainHistory.length === 0 ? (
                        <p className="text-sm text-gray-500 italic text-center">No blockchain history available</p>
                      ) : (
                        <div className="max-h-64 overflow-y-auto">
                          {blockchainHistory.map((entry, index) => (
                            <div key={index} className="border border-gray-200 rounded-md p-2 mb-2 text-xs">
                              <div className="flex justify-between mb-1">
                                <span className="font-medium">{entry.type || 'Transaction'}</span>
                                <span className="text-gray-500">{formatDate(entry.timestamp)}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <span className="text-gray-500">Modified By:</span>
                                <span className="col-span-2">{entry.owner || entry.verifier || 'System'}</span>
                              </div>
                              {entry.tx_id && (
                                <div className="grid grid-cols-3 gap-2 mt-1">
                                  <span className="text-gray-500">TX ID:</span>
                                  <span className="col-span-2 break-all font-mono">{entry.tx_id}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cvsu-green text-base font-medium text-white hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={closeBlockchainModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Details Modal */}
      {showDetailsModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Document Details</h2>
              <button 
                onClick={closeDetailsModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            
            <div className="p-6">
              <h3 className="text-xl font-medium mb-4">{selectedDocument.name}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Document Information</h4>
                  <dl className="mt-2 space-y-2">
                    <div>
                      <dt className="text-sm text-gray-500">Description</dt>
                      <dd>{selectedDocument.description || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Upload Date</dt>
                      <dd>{formatDate(selectedDocument.uploadDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Size</dt>
                      <dd>{selectedDocument.size}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Status</dt>
                      <dd>{selectedDocument.verification_status === 'verified' ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircleIcon className="h-5 w-5 mr-1" />
                          Verified
                        </span>
                      ) : (
                        <span className="flex items-center text-yellow-600">
                          <ClockIcon className="h-5 w-5 mr-1" />
                          Pending
                        </span>
                      )}</dd>
                    </div>
                    {selectedDocument.verification_date && (
                      <div>
                        <dt className="text-sm text-gray-500">Verified Date</dt>
                        <dd>{formatDate(selectedDocument.verification_date)}</dd>
                      </div>
                    )}
                    {selectedDocument.reason && (
                      <div>
                        <dt className="text-sm text-gray-500">Rejection Reason</dt>
                        <dd className="text-red-600">{selectedDocument.reason}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Blockchain Information</h4>
                  <dl className="mt-2 space-y-2">
                    <div>
                      <dt className="text-sm text-gray-500">Document Hash</dt>
                      <dd className="break-all text-xs">{selectedDocument.file_hash || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Transaction ID</dt>
                      <dd className="break-all text-xs">{selectedDocument.blockchain_tx_id || 'Not recorded on blockchain'}</dd>
                    </div>
                  </dl>
                  
                  {selectedDocument.verification_status !== 'verified' && selectedDocument.file_hash && (
                    <button
                      onClick={() => verifyDocumentOnBlockchain(selectedDocument)}
                      disabled={verifyingDocument}
                      className="mt-4 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-blue-300"
                    >
                      {verifyingDocument ? 'Verifying...' : 'Verify on Blockchain'}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Blockchain History */}
              {blockchainDetails && blockchainDetails.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Blockchain Verification History</h4>
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <ul className="space-y-4">
                      {blockchainDetails.map((entry, index) => (
                        <li key={index} className="border-b border-gray-200 last:border-b-0 pb-2 last:pb-0">
                          <div className="flex items-start">
                            <div className="flex-shrink-0 mt-1">
                              <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium">
                                {entry.action || 'Transaction'} on {formatDate(entry.timestamp)}
                              </p>
                              <p className="text-xs text-gray-500">
                                TX ID: {truncateString(entry.tx_id, 20)}
                              </p>
                              {entry.metadata && (
                                <div className="mt-1 text-xs text-gray-600">
                                  {entry.metadata.verifier && (
                                    <p>Verified by: {entry.metadata.verifier}</p>
                                  )}
                                  {entry.metadata.notes && (
                                    <p>Notes: {entry.metadata.notes}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 