import { useState } from 'react';
import { ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon, DocumentTextIcon, ShieldCheckIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import documentVerificationService, { calculateDocumentHash } from '../services/document';

export default function VerifyPage() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [verificationStatus, setVerificationStatus] = useState(null); // null, 'success', 'error'
  const [loading, setLoading] = useState(false);
  const [documentId, setDocumentId] = useState('');
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setVerificationStatus(null);
      setError('');
    }
  };

  const handleDocumentIdChange = (e) => {
    setDocumentId(e.target.value);
    setVerificationStatus(null);
    setError('');
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setFileName(droppedFile.name);
      setVerificationStatus(null);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !documentId) {
      setError('Please provide both a document ID and upload a file');
      return;
    }

    setLoading(true);
    setError('');
    setVerificationResult(null);
    
    try {
      // Use the updated document verification service
      // First calculate the hash of the uploaded file
      const hash = await calculateDocumentHash(file);
      
      // Then verify against the blockchain
      const result = await documentVerificationService.verifyDocumentOnBlockchain(documentId, hash);
      console.log('Document verification result:', result);
      
      if (result.data && result.data.success) {
        setVerificationStatus(result.data.verified ? 'success' : 'error');
        setVerificationResult(result.data.document || null);
      } else {
        setError(result.data?.message || 'Verification failed');
        setVerificationStatus('error');
      }
    } catch (error) {
      console.error('Error verifying document:', error);
      setError('An error occurred during verification');
      setVerificationStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white">
      {/* Hero section with pattern overlay */}
      <div className="relative bg-cover bg-center" style={{ backgroundColor: '#38a389' }}>
        <div className="absolute inset-0 bg-[url('/src/assets/pattern.svg')] opacity-10"></div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-24">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-center md:text-left md:max-w-xl">
              <div className="animate-slideDown">
                <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-white mb-5 shadow-md">
                  <ShieldCheckIcon className="h-4 w-4 mr-2" />
                  Blockchain Verification
                </span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl drop-shadow-md animate-fadeIn">
                Document <span className="text-cvsu-yellow">Verification</span>
              </h1>
              <p className="mt-6 max-w-2xl text-xl leading-8 text-white/95 backdrop-blur-[2px] pl-3 border-l-4 border-cvsu-yellow animate-slideUp">
                Verify the authenticity of any CVSU-Carmona document using our
                blockchain-based verification system.
              </p>
            </div>
            
            <div className="hidden md:block mt-10 md:mt-0">
              <div className="relative h-72 w-72 lg:h-96 lg:w-96 transform transition-all duration-500 hover:scale-105">
                <div className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-sm shadow-xl animate-pulse" style={{ animationDuration: '5s' }}></div>
                <img 
                  src="/src/assets/verification-image.png" 
                  alt="Document verification illustration" 
                  className="relative z-10 h-full w-full object-contain drop-shadow-2xl"
                  onError={(e) => {
                    // Fallback if the image doesn't exist
                    e.target.src = "https://img.icons8.com/color/480/null/certificate-verification.png";
                    e.target.classList.remove("object-contain");
                    e.target.classList.add("object-cover");
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
      </div>

      {/* Verification form */}
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="relative isolate overflow-hidden bg-white px-6 py-12 shadow-2xl sm:rounded-3xl sm:px-24 xl:py-16 border border-gray-100">
            <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Upload Document for Verification
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-lg leading-8 text-gray-500">
              Upload a diploma, transcript, or certificate issued by CVSU-Carmona to verify its authenticity.
            </p>
            
            <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-md">
              <div className="grid grid-cols-1 gap-8">
                <div className="col-span-full">
                  <label htmlFor="document-id" className="block text-sm font-medium leading-6 text-gray-900 flex items-center">
                    <DocumentTextIcon className="h-5 w-5 mr-2 text-cvsu-green" />
                    Document ID
                  </label>
                  <div className="mt-2">
                    <input
                      type="text"
                      id="document-id"
                      name="document-id"
                      value={documentId}
                      onChange={handleDocumentIdChange}
                      className="block w-full rounded-lg border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cvsu-green sm:text-sm sm:leading-6 transition-all duration-200"
                      placeholder="Enter the document ID"
                      required
                    />
                  </div>
                </div>
                
                <div className="col-span-full">
                  <label className="block text-sm font-medium leading-6 text-gray-900 flex items-center mb-2">
                    <ArrowUpTrayIcon className="h-5 w-5 mr-2 text-cvsu-green" />
                    Upload Document
                  </label>
                  <div 
                    className={`mt-2 flex justify-center rounded-lg border-2 ${dragActive ? 'border-cvsu-green border-solid bg-green-50' : 'border-dashed border-gray-300'} px-6 py-10 transition-all duration-200`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <div className="text-center">
                      <ArrowUpTrayIcon className={`mx-auto h-12 w-12 ${dragActive ? 'text-cvsu-green' : 'text-gray-300'} transition-colors duration-200`} aria-hidden="true" />
                      <div className="mt-4 flex text-sm leading-6 text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md bg-white font-semibold text-cvsu-green focus-within:outline-none focus-within:ring-2 focus-within:ring-cvsu-green hover:text-green-700 transition-colors"
                        >
                          <span>Upload a file</span>
                          <input 
                            id="file-upload" 
                            name="file-upload" 
                            type="file" 
                            className="sr-only"
                            onChange={handleFileChange}
                            accept=".pdf,.jpg,.jpeg,.png"
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs leading-5 text-gray-500">PDF, JPG or PNG up to 10MB</p>
                      
                      {fileName && (
                        <div className="mt-4 flex items-center justify-center">
                          <div className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-600/20 flex items-center">
                            <CheckCircleIcon className="h-5 w-5 mr-2 text-green-500" />
                            {fileName}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="mt-6 rounded-md bg-red-50 p-4 animate-fadeIn">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">{error}</h3>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-8 flex">
                <button
                  type="submit"
                  disabled={!file || !documentId || loading}
                  className={`w-full rounded-lg px-5 py-3.5 text-base font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cvsu-green transition-all duration-200 ${
                    !file || !documentId || loading 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-cvsu-green hover:bg-green-700 transform hover:-translate-y-1 hover:shadow-md'
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </span>
                  ) : 'Verify Document'}
                </button>
              </div>
            </form>

            {/* Verification Result */}
            {verificationStatus && (
              <div className={`mt-10 rounded-lg p-6 shadow-md animate-fadeIn ${
                verificationStatus === 'success' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {verificationStatus === 'success' ? (
                      <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircleIcon className="h-8 w-8 text-green-600" aria-hidden="true" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                        <XCircleIcon className="h-8 w-8 text-red-600" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className={`text-lg font-bold ${
                      verificationStatus === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {verificationStatus === 'success' 
                        ? 'Document Verified Successfully' 
                        : 'Verification Failed'}
                    </h3>
                    <div className={`mt-2 text-sm ${
                      verificationStatus === 'success' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      <p className="mb-4">
                        {verificationStatus === 'success'
                          ? 'This document has been verified as authentic. It was issued by CVSU-Carmona and recorded on the blockchain.'
                          : 'This document could not be verified. It may not be authentic or may not be recorded in our blockchain.'}
                      </p>
                      
                      {/* Document details if successful */}
                      {verificationStatus === 'success' && (
                        <div className="bg-white rounded-md p-4 border border-green-200 mt-4">
                          <h4 className="font-medium text-gray-900 mb-2">Document Details</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-gray-500">Document ID:</div>
                            <div className="font-medium">{documentId}</div>
                            <div className="text-gray-500">Document Type:</div>
                            <div className="font-medium">Academic Certificate</div>
                            <div className="text-gray-500">Issuing Date:</div>
                            <div className="font-medium">{new Date().toLocaleDateString()}</div>
                            <div className="text-gray-500">Blockchain Timestamp:</div>
                            <div className="font-medium">{new Date().toLocaleString()}</div>
                            {verificationResult?.verified_by && (
                              <>
                                <div className="text-gray-500">Verified By:</div>
                                <div className="font-medium">{verificationResult.verified_by_name || verificationResult.verified_by}</div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {verificationStatus === 'error' && (
                      <div className="mt-6">
                        <Link
                          to="/contact"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                        >
                          Contact Support
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* How it works section */}
      <div className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-cvsu-green mb-4">
              <span className="flex h-2 w-2 rounded-full bg-cvsu-green mr-1.5 animate-pulse"></span>
              Verification Process
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How Document Verification Works
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Our blockchain-based verification system provides secure and transparent validation of academic credentials.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col bg-white rounded-xl shadow-sm p-6 border border-gray-100 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-cvsu-green text-white">
                    <span className="text-white font-bold text-lg">1</span>
                  </div>
                  <span>Document Upload</span>
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Upload your CVSU-Carmona document (diploma, transcript, certificate) 
                    through our secure verification portal.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col bg-white rounded-xl shadow-sm p-6 border border-gray-100 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-cvsu-green text-white">
                    <span className="text-white font-bold text-lg">2</span>
                  </div>
                  <span>Blockchain Verification</span>
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Our system extracts the document's unique identifiers and checks them 
                    against our secure Hyperledger Fabric blockchain.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col bg-white rounded-xl shadow-sm p-6 border border-gray-100 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-cvsu-green text-white">
                    <span className="text-white font-bold text-lg">3</span>
                  </div>
                  <span>Instant Results</span>
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Receive immediate verification results confirming the document's 
                    authenticity, issuing date, and validity.
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
} 