import React from 'react';
import { CheckCircleIcon, ClockIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { formatDateTimePhilippines } from '../utils/dateUtils';

const DocumentDetailsModal = ({ document, onClose, blockchainDetails }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return formatDateTimePhilippines(dateString);
  };
  
  const truncateString = (str, num) => {
    if (!str) return '';
    if (str.length <= num) return str;
    return str.slice(0, num) + '...';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Document Details</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        
        <div className="p-6">
          <h3 className="text-xl font-medium mb-4">{document.title || document.name}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Document Information</h4>
              <dl className="mt-2 space-y-2">
                <div>
                  <dt className="text-sm text-gray-500">Description</dt>
                  <dd>{document.description || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Upload Date</dt>
                  <dd>{formatDate(document.created_at) || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Size</dt>
                  <dd>{document.size}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd>{document.verification_status === 'verified' ? (
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
                {document.verification_date && (
                  <div>
                    <dt className="text-sm text-gray-500">Verified Date</dt>
                    <dd>{formatDate(document.verification_date)}</dd>
                  </div>
                )}
                {document.verified_by && (
                  <div>
                    <dt className="text-sm text-gray-500">Verified By</dt>
                    <dd>{document.verified_by_name || document.verified_by}</dd>
                  </div>
                )}
                {document.reason && (
                  <div>
                    <dt className="text-sm text-gray-500">Rejection Reason</dt>
                    <dd className="text-red-600">{document.reason}</dd>
                  </div>
                )}
              </dl>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-500">Blockchain Information</h4>
              <dl className="mt-2 space-y-2">
                <div>
                  <dt className="text-sm text-gray-500">Document Hash</dt>
                  <dd className="break-all text-xs">{document.file_hash || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Transaction ID</dt>
                  <dd className="break-all text-xs">{document.blockchain_tx_id || 'Not recorded on blockchain'}</dd>
                </div>
              </dl>
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
  );
};

export default DocumentDetailsModal; 