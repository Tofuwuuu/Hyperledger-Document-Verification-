import { useState } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { verificationService } from '../../services/api';

export default function EmployerVerificationsPage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [documentCode, setDocumentCode] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [step, setStep] = useState('search'); // 'search' or 'result'
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!documentCode.trim()) {
      toast.error('Please enter a document verification code');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Call the verification service
      const result = await verificationService.verifyDocument(documentCode);
      
      if (result.success) {
        setVerificationResult({
          isVerified: true,
          document: result.data
        });
      } else {
        setVerificationResult({
          isVerified: false,
          reason: result.error || 'Document verification code not found or is invalid'
        });
      }
      
      setStep('result');
    } catch (error) {
      console.error('Error verifying document:', error);
      setError('An error occurred while verifying the document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setDocumentCode('');
    setVerificationResult(null);
    setStep('search');
    setError(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Document Verification</h1>
      <p className="mt-1 text-sm text-gray-500">
        Verify the authenticity of alumni documents using the document verification code.
      </p>

      {step === 'search' ? (
        <div className="mt-6 bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <form className="space-y-6" onSubmit={handleSearch}>
              <div>
                <label htmlFor="documentCode" className="block text-sm font-medium text-gray-700">
                  Document Verification Code
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="documentCode"
                    name="documentCode"
                    placeholder="e.g. CVS-123456"
                    value={documentCode}
                    onChange={(e) => setDocumentCode(e.target.value)}
                    className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Enter the document verification code to verify the authenticity of an alumni's document.
                  The verification code can be found on the document itself.
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </>
                ) : 'Verify Document'}
              </button>

              <div className="mt-4 text-sm text-gray-500">
                <p>Try with verification code <span className="font-mono bg-gray-100 p-1 rounded">CVS-123456</span> for a sample verification.</p>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          {verificationResult.isVerified ? (
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-10 w-10 text-green-500" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-green-800">Document Verified</h3>
                    <p className="mt-2 text-sm text-green-700">
                      This document is authentic and has been verified on the blockchain.
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="text-lg font-medium text-gray-900">Document Details</h4>
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Document Type</dt>
                      <dd className="mt-1 text-sm text-gray-900">{verificationResult.document.type}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Issue Date</dt>
                      <dd className="mt-1 text-sm text-gray-900">{verificationResult.document.issueDate}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Verification Code</dt>
                      <dd className="mt-1 text-sm text-gray-900">{verificationResult.document.verificationCode}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Blockchain Status</dt>
                      <dd className="mt-1 text-sm text-green-700">{verificationResult.document.blockchainVerification.status}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-6">
                  <h4 className="text-lg font-medium text-gray-900">Alumni Information</h4>
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{verificationResult.document.holder.name}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Student ID</dt>
                      <dd className="mt-1 text-sm text-gray-900">{verificationResult.document.holder.studentId}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Program</dt>
                      <dd className="mt-1 text-sm text-gray-900">{verificationResult.document.holder.program}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Graduation Year</dt>
                      <dd className="mt-1 text-sm text-gray-900">{verificationResult.document.holder.graduationYear}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-6">
                  <h4 className="text-lg font-medium text-gray-900">Issuer Information</h4>
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{verificationResult.document.issuer.name}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Department</dt>
                      <dd className="mt-1 text-sm text-gray-900">{verificationResult.document.issuer.department}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-8">
                  <button
                    type="button"
                    onClick={resetSearch}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                  >
                    Verify Another Document
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <XCircleIcon className="h-10 w-10 text-red-500" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-red-800">Verification Failed</h3>
                    <p className="mt-2 text-sm text-red-700">
                      {verificationResult.reason}
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <button
                    type="button"
                    onClick={resetSearch}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 