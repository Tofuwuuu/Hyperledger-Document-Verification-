import { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  DocumentTextIcon,
  EyeIcon,
  FingerPrintIcon,
  ClockIcon,
  CubeTransparentIcon
} from '@heroicons/react/24/outline';
import { documentService, verificationService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import documentVerificationService from '../../services/document';

export default function DocumentVerificationPage() {
  const { currentUser } = useAuth();
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [blockchainTxDetails, setBlockchainTxDetails] = useState(null);
  const [showBlockchainDetails, setShowBlockchainDetails] = useState(false);

  useEffect(() => {
    fetchPendingDocuments();
  }, []);

  const fetchPendingDocuments = async () => {
    setLoading(true);
    try {
      const response = await documentService.getAllPendingDocuments();
      setPendingDocuments(response.data);
    } catch (error) {
      console.error('Error fetching pending documents:', error);
      setError('Failed to load pending documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyDocument = async (documentId) => {
    setLoading(true);
    setSuccess('');
    setError('');
    setBlockchainTxDetails(null);
    
    try {
      // Find the document in the list
      const document = pendingDocuments.find(doc => doc._id === documentId);
      
      if (!document || !document.file_hash) {
        throw new Error('Document or document hash not found');
      }
      
      // Verify the document via the blockchain API
      const response = await documentVerificationService.verifyDocumentOnBlockchain(
        documentId,
        document.file_hash
      );
      
      if (response.data && response.data.success) {
        // Prepare metadata for the blockchain
        const metadata = {
          title: document.title,
          document_type: document.document_type,
          alumni_id: document.alumni_id,
          alumni_name: document.alumni_name,
          verified_by: currentUser.full_name || currentUser.email,
          verification_date: new Date().toISOString()
        };
        
        // Store verification result on blockchain
        const blockchainResponse = await documentVerificationService.storeDocumentOnBlockchain(
          documentId,
          document.file_hash,
          metadata
        );
        
        if (blockchainResponse.data && blockchainResponse.data.success) {
          setBlockchainTxDetails(blockchainResponse.data);
          setShowBlockchainDetails(true);
          setSuccess(`Document #${documentId} verified and stored on blockchain successfully. Transaction ID: ${blockchainResponse.data.transaction_id || 'Generated'}`);
        } else {
          // Document verified but blockchain storage failed
          setSuccess(`Document #${documentId} verified successfully, but blockchain storage failed: ${blockchainResponse.data?.message || 'Unknown error'}`);
        }
      } else {
        throw new Error(response.data?.message || 'Verification failed');
      }
      
      // Refresh the document list
      fetchPendingDocuments();
    } catch (error) {
      console.error('Error verifying document:', error);
      setError('Failed to verify document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openRejectModal = (document) => {
    setSelectedDocument(document);
    setShowRejectionModal(true);
  };

  const closeRejectModal = () => {
    setSelectedDocument(null);
    setRejectionReason('');
    setShowRejectionModal(false);
  };

  const rejectDocument = async () => {
    if (!selectedDocument || !rejectionReason) {
      setError('Please provide a reason for rejection');
      return;
    }
    
    setLoading(true);
    setSuccess('');
    setError('');
    
    try {
      await verificationService.rejectDocument(selectedDocument._id, rejectionReason);
      setSuccess(`Document #${selectedDocument._id} has been rejected.`);
      closeRejectModal();
      fetchPendingDocuments(); // Refresh list
    } catch (error) {
      console.error('Error rejecting document:', error);
      setError('Failed to reject document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const viewDocument = async (document) => {
    const documentId = document?._id || document?.id;
    if (!documentId) return;

    try {
      const response = await documentService.previewDocument(documentId);
      const previewUrl = URL.createObjectURL(response.data);
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60000);
    } catch (error) {
      console.error('Error opening document preview:', error);
      setError('Failed to open document preview. Please try again.');
    }
  };

  const closeBlockchainDetails = () => {
    setShowBlockchainDetails(false);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Verification Queue</h2>
        
        {success && (
          <div className="mb-4 bg-green-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-4 bg-red-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {loading && pendingDocuments.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
          </div>
        ) : (
          <>
            {pendingDocuments.length === 0 ? (
              <div className="text-center py-10">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No pending documents</h3>
                <p className="mt-1 text-sm text-gray-500">
                  All documents have been verified or rejected.
                </p>
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
                        Submitted By
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Submitted
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingDocuments.map((document) => (
                      <tr key={document._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                              <DocumentTextIcon className="h-6 w-6 text-gray-500" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{document.title}</div>
                              <div className="text-sm text-gray-500 truncate max-w-xs">{document.description || 'No description'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{document.alumni_name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{document.student_id || 'No ID'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {document.document_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(document.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => viewDocument(document)}
                              className="text-gray-600 hover:text-gray-900 bg-white p-1 rounded-full"
                              title="View Document"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            
                            <button
                              onClick={() => verifyDocument(document._id)}
                              disabled={loading}
                              className="text-green-600 hover:text-green-900 bg-white p-1 rounded-full"
                              title="Verify Document"
                            >
                              <FingerPrintIcon className="h-5 w-5" />
                            </button>
                            
                            <button
                              onClick={() => openRejectModal(document)}
                              disabled={loading}
                              className="text-red-600 hover:text-red-900 bg-white p-1 rounded-full"
                              title="Reject Document"
                            >
                              <XCircleIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Blockchain Transaction Details Modal */}
      {showBlockchainDetails && blockchainTxDetails && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closeBlockchainDetails}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <CubeTransparentIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Blockchain Transaction Details
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 mb-4">
                        Document has been verified and stored on the blockchain successfully.
                      </p>
                      <div className="mt-4 bg-gray-50 p-3 rounded-md text-xs font-mono overflow-auto max-h-64">
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <span className="text-gray-500">Transaction ID:</span>
                          <span className="col-span-2 break-all">{blockchainTxDetails.transaction_id || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <span className="text-gray-500">Document ID:</span>
                          <span className="col-span-2 break-all">{blockchainTxDetails.document_id || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <span className="text-gray-500">Document Hash:</span>
                          <span className="col-span-2 break-all">{blockchainTxDetails.hash || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-500">Timestamp:</span>
                          <span className="col-span-2">{new Date().toISOString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={closeBlockchainDetails}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closeRejectModal}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <XCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Reject Document
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Please provide a reason for rejecting this document. This will be shared with the student.
                      </p>
                      <div className="mt-4">
                        <textarea
                          rows="4"
                          className="shadow-sm block w-full focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm border border-gray-300 rounded-md"
                          placeholder="Enter reason for rejection"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  disabled={loading}
                  onClick={rejectDocument}
                >
                  {loading ? 'Processing...' : 'Reject Document'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={closeRejectModal}
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
