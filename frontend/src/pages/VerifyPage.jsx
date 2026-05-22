import { useState } from 'react';
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  FingerPrintIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import documentVerificationService from '../services/document';

export default function VerifyPage() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [verificationStatus, setVerificationStatus] = useState(null); // null, 'success', 'error'
  const [loading, setLoading] = useState(false);
  const [documentId, setDocumentId] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const setSelectedFile = (selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setVerificationStatus(null);
      setError('');
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setSelectedFile(e.dataTransfer.files[0]);
  };

  const resetFile = () => {
    setFile(null);
    setFileName('');
    setVerificationStatus(null);
    setError('');
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

  const fileSize = file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '';

  return (
    <div className="bg-slate-50">
      {/* Hero section */}
      <div className="bg-cvsu-green">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white/80">Public document check</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Document Verification
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/90">
              Upload a CVSU-Carmona document and compare its fingerprint against the verification record.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:self-end">
            {[
              ['1', 'Upload file'],
              ['2', 'Match record'],
              ['3', 'View result'],
            ].map(([step, label]) => (
              <div key={step} className="rounded-lg border border-white/20 bg-white/10 p-4 text-white">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-cvsu-green">
                  {step}
                </div>
                <p className="mt-3 text-sm font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Verification form */}
      <div className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
            <aside className="border-b border-slate-200 bg-slate-900 p-6 text-white lg:border-b-0 lg:border-r lg:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cvsu-green">
                <ShieldCheckIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="mt-6 text-2xl font-bold tracking-tight">
                Verify before you trust a credential
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                The verifier calculates the uploaded file hash and checks for a matching document record. Add the Document ID when it is printed on the document for a stricter match.
              </p>
              <dl className="mt-8 space-y-5">
                {[
                  [DocumentTextIcon, 'Accepted files', 'PDF, JPG, JPEG, or PNG up to 10MB.'],
                  [FingerPrintIcon, 'Hash based', 'No manual edits are needed before checking a file.'],
                  [DocumentCheckIcon, 'Immediate result', 'You get a clear verified or not verified answer.'],
                ].map(([Icon, title, text]) => (
                  <div key={title} className="flex gap-4">
                    <Icon className="mt-0.5 h-6 w-6 flex-none text-emerald-300" aria-hidden="true" />
                    <div>
                      <dt className="text-sm font-semibold">{title}</dt>
                      <dd className="mt-1 text-sm text-slate-300">{text}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </aside>

            <div className="p-6 sm:p-8 lg:p-10">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-cvsu-green">Start verification</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  Upload document for verification
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Use the original file whenever possible. Screenshots or compressed copies may produce a different hash.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 max-w-2xl">
                <div className="grid grid-cols-1 gap-6">
                <div className="col-span-full">
                  <label htmlFor="document-id" className="block text-sm font-semibold leading-6 text-slate-900">
                    Document ID <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <div className="mt-2">
                    <input
                      type="text"
                      id="document-id"
                      name="document-id"
                      value={documentId}
                      onChange={handleDocumentIdChange}
                      className="block w-full rounded-md border-0 px-3 py-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-cvsu-green sm:text-sm"
                      placeholder="Example: DOC-2026-0001"
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Leave this blank to verify the uploaded file by its blockchain hash only.
                  </p>
                </div>
                
                <div className="col-span-full">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`mt-2 flex min-h-56 justify-center rounded-lg border border-dashed px-6 py-8 transition ${
                      isDragging
                        ? 'border-cvsu-green bg-emerald-50'
                        : file
                          ? 'border-cvsu-green/60 bg-cvsu-green/5'
                          : 'border-slate-300 bg-slate-50 hover:border-cvsu-green/70 hover:bg-white'
                    }`}
                  >
                    <div className="text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                        <ArrowUpTrayIcon className="h-8 w-8 text-cvsu-green" aria-hidden="true" />
                      </div>
                      <div className="mt-5 flex justify-center text-sm leading-6 text-slate-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md font-semibold text-cvsu-green focus-within:outline-none focus-within:ring-2 focus-within:ring-cvsu-green focus-within:ring-offset-2"
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
                      <p className="text-xs leading-5 text-slate-500">PDF, JPG or PNG up to 10MB</p>
                      
                      {fileName && (
                        <div className="mt-5 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-left shadow-sm">
                          <div className="flex items-start gap-3">
                            <DocumentTextIcon className="h-6 w-6 flex-none text-cvsu-green" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{fileName}</p>
                              <p className="mt-1 text-xs text-slate-500">{fileSize}</p>
                            </div>
                            <button
                              type="button"
                              onClick={resetFile}
                              className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
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
              
              <div className="mt-7 flex">
                <button
                  type="submit"
                  disabled={!file || loading}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 text-base font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cvsu-green ${
                    !file || loading 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-cvsu-green hover:bg-cvsu-green/90'
                  }`}
                >
                  {loading && <ArrowPathIcon className="h-5 w-5 animate-spin" aria-hidden="true" />}
                  {loading ? 'Verifying...' : 'Verify Document'}
                </button>
              </div>
            </form>

            {/* Verification Result */}
            {verificationStatus && (
              <div className={`mt-8 max-w-2xl rounded-lg border p-5 ${
                verificationStatus === 'success' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {verificationStatus === 'success' ? (
                      <CheckCircleIcon className="h-7 w-7 text-green-600" aria-hidden="true" />
                    ) : (
                      <XCircleIcon className="h-7 w-7 text-red-600" aria-hidden="true" />
                    )}
                  </div>
                  <div className="ml-4">
                    <h3 className={`text-base font-semibold ${
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
                            to="/about"
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
      </div>

      {/* How it works section */}
      <div className="bg-white py-14 sm:py-18">
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
          <div className="mx-auto mt-10 max-w-2xl lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-5 lg:max-w-none lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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
