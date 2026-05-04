import { useState } from 'react';
import { ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import documentVerificationService from '../services/document';

export default function VerifyPage() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [verificationStatus, setVerificationStatus] = useState(null); // null, 'success', 'error'
  const [loading, setLoading] = useState(false);
  const [documentId, setDocumentId] = useState('');
  const [error, setError] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please upload a file to verify');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await documentVerificationService.verifyUploadedFile(file, documentId);
      
      if (result.success) {
        setVerificationStatus(result.verified ? 'success' : 'error');
      } else {
        setError(result.message || 'Verification failed');
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
      {/* Hero section */}
      <div className="bg-cvsu-green py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Document Verification
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white">
            Verify the authenticity of any CVSU-Carmona document using our
            blockchain-based verification system.
          </p>
        </div>
      </div>

      {/* Verification form */}
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="relative isolate overflow-hidden bg-white px-6 py-12 shadow-2xl sm:rounded-3xl sm:px-24 xl:py-16">
            <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Upload Document for Verification
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-lg leading-8 text-gray-500">
              Upload a diploma, transcript, or certificate issued by CVSU-Carmona to verify its authenticity.
            </p>
            
            <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-md">
              <div className="grid grid-cols-1 gap-8">
                <div className="col-span-full">
                  <label htmlFor="document-id" className="block text-sm font-medium leading-6 text-gray-900">
                    Document ID
                  </label>
                  <div className="mt-2">
                    <input
                      type="text"
                      id="document-id"
                      name="document-id"
                      value={documentId}
                      onChange={handleDocumentIdChange}
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cvsu-green sm:text-sm sm:leading-6"
                      placeholder="Optional: enter the document ID"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Leave this blank to verify the uploaded file by its blockchain hash only.
                  </p>
                </div>
                
                <div className="col-span-full">
                  <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
                    <div className="text-center">
                      <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
                      <div className="mt-4 flex text-sm leading-6 text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md bg-white font-semibold text-cvsu-green focus-within:outline-none focus-within:ring-2 focus-within:ring-cvsu-green"
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
                      <p className="text-xs leading-5 text-gray-600">PDF, JPG or PNG up to 10MB</p>
                      
                      {fileName && (
                        <p className="mt-2 text-sm text-gray-900 font-medium">
                          Selected: {fileName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="mt-4 rounded-md bg-red-50 p-4">
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
                  disabled={!file || loading}
                  className={`w-full rounded-md px-5 py-3 text-base font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cvsu-green ${
                    !file || loading 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-cvsu-green hover:bg-cvsu-green/90'
                  }`}
                >
                  {loading ? 'Verifying...' : 'Verify Document'}
                </button>
              </div>
            </form>

            {/* Verification Result */}
            {verificationStatus && (
              <div className={`mt-8 rounded-md p-4 ${
                verificationStatus === 'success' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {verificationStatus === 'success' ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" aria-hidden="true" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-600" aria-hidden="true" />
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className={`text-sm font-medium ${
                      verificationStatus === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {verificationStatus === 'success' 
                        ? 'Document Verified Successfully' 
                        : 'Verification Failed'}
                    </h3>
                    <div className={`mt-2 text-sm ${
                      verificationStatus === 'success' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      <p>
                        {verificationStatus === 'success'
                          ? 'This document has been verified as authentic. It was issued by CVSU-Carmona and recorded on the blockchain.'
                          : 'This document could not be verified. It may not be authentic or may not be recorded in our blockchain.'}
                      </p>
                    </div>
                    {verificationStatus === 'error' && (
                      <div className="mt-4">
                        <div className="-mx-2 -my-1.5 flex">
                          <Link
                            to="/contact"
                            className="rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
                          >
                            Contact Support
                          </Link>
                        </div>
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
            <h2 className="text-base font-semibold leading-7 text-cvsu-green">Verification Process</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How Document Verification Works
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Our blockchain-based verification system provides secure and transparent validation of academic credentials.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-cvsu-green">
                    <span className="text-white font-bold text-lg">1</span>
                  </div>
                  Document Upload
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Upload your CVSU-Carmona document (diploma, transcript, certificate) 
                    through our secure verification portal.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-cvsu-green">
                    <span className="text-white font-bold text-lg">2</span>
                  </div>
                  Blockchain Verification
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Our system extracts the document's unique identifiers and checks them 
                    against our secure Hyperledger Fabric blockchain.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-cvsu-green">
                    <span className="text-white font-bold text-lg">3</span>
                  </div>
                  Instant Results
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
