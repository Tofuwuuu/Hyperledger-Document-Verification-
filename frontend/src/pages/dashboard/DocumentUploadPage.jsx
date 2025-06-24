import { useState, useEffect } from 'react';
import { PaperClipIcon, ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { documentService, alumniService } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export default function DocumentUploadPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [alumniProfile, setAlumniProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Form states
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  
  // Add drag and drop functionality
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState('');
  const [filePreview, setFilePreview] = useState(null);
  
  // File validation
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  const allowedFileTypes = [
    'application/pdf', 
    'image/jpeg', 
    'image/png', 
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  useEffect(() => {
    fetchAlumniProfile();
  }, [currentUser]);
  
  const fetchAlumniProfile = async () => {
    if (!currentUser || !currentUser._id) return;
    
    setLoading(true);
    try {
      const response = await alumniService.getAlumniByUserId(currentUser._id);
      setAlumniProfile(response.data);
      
      // Fetch documents
      if (response.data && response.data._id) {
        fetchDocuments(response.data._id);
      }
    } catch (error) {
      console.error('Error fetching alumni profile:', error);
      setError('You need to create an alumni profile before uploading documents.');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDocuments = async (alumniId) => {
    setLoading(true);
    try {
      console.log(`Fetching documents for alumni: ${alumniId}`);
      const response = await documentService.getAlumniDocuments(alumniId);
      setDocuments(response.data);
      console.log("Documents fetched successfully:", response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      
      // More detailed error logging
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
        
        // More specific error message
        if (error.response.status === 404) {
          setError('Alumni profile not found. Please update your profile first.');
        } else if (error.response.status === 403) {
          setError('You are not authorized to view these documents.');
        } else if (error.response.status === 500) {
          setError(`Server error: ${error.response.data?.detail || 'Unknown internal server error'}`);
        } else {
          setError(`Failed to load documents (${error.response.status}): ${error.response.data?.detail || 'Unknown error'}`);
        }
      } else if (error.request) {
        console.error('No response received:', error.request);
        setError('Network error. Please check your internet connection.');
      } else {
        console.error('Error message:', error.message);
        setError('Failed to load documents. Please try again.');
      }
    } finally {
      setLoading(false);
    }
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
  
  const validateFile = (selectedFile) => {
    // Reset previous errors
    setFileError('');
    
    // Check file size
    if (selectedFile.size > maxFileSize) {
      setFileError(`File is too large. Maximum size is ${maxFileSize / (1024 * 1024)}MB.`);
      return false;
    }
    
    // Check file type
    if (!allowedFileTypes.includes(selectedFile.type)) {
      setFileError('Invalid file type. Please upload a PDF, Word document, or image (JPG, JPEG, PNG).');
      return false;
    }
    
    return true;
  };
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
      
      // Create file preview
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        // For non-image files, use a generic icon
        setFilePreview('document');
      }
    } else {
      e.target.value = null; // Clear the file input
      setFile(null);
      setFilePreview(null);
    }
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
        
        // Create file preview
        if (droppedFile.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setFilePreview(reader.result);
          };
          reader.readAsDataURL(droppedFile);
        } else {
          // For non-image files, use a generic icon
          setFilePreview('document');
        }
        
        // Update the file input element for form submission
        const fileInput = document.getElementById('document-file');
        if (fileInput) {
          // Create a DataTransfer object to set the file input value
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(droppedFile);
          fileInput.files = dataTransfer.files;
        }
      }
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!alumniProfile || !alumniProfile._id) {
      setError('You need a valid alumni profile to upload documents.');
      return;
    }
    
    if (!title || !documentType || !file) {
      setError('Please fill in all required fields and select a file.');
      return;
    }
    
    setUploading(true);
    setSuccess('');
    setError('');
    
    try {
      await documentService.uploadDocument({
        alumni_id: alumniProfile._id,
        title,
        document_type: documentType,
        description,
        file
      });
      
      setSuccess('Document uploaded successfully! It will be verified by an administrator.');
      
      // Reset form
      setTitle('');
      setDocumentType('');
      setDescription('');
      setFile(null);
      
      // Clear file input
      const fileInput = document.getElementById('document-file');
      if (fileInput) {
        fileInput.value = '';
      }
      
      // Refresh documents list
      fetchDocuments(alumniProfile._id);
      
      // Refresh recent activity by navigating to the appropriate dashboard based on URL
      const currentPath = window.location.pathname;
      const basePath = currentPath.includes('/admin') ? '/admin' : '/alumni';
      
      navigate(basePath, { 
        state: { 
          refreshActivity: true,
          documentUploaded: true,
          documentTitle: title,
          documentType: documentType 
        } 
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      setError('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };
  
  const documentTypes = [
    { id: 'diploma', name: 'Diploma' },
    { id: 'transcript', name: 'Transcript of Records' },
    { id: 'certificate', name: 'Certificate' },
    { id: 'id', name: 'ID Card' },
    { id: 'other', name: 'Other' }
  ];
  
  if (loading && !alumniProfile) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Upload</h2>
        
        {!alumniProfile ? (
          <div className="rounded-md bg-yellow-50 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-800">
                  You need to create an alumni profile before uploading documents.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
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
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Document Title *
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="title"
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                      required
                    />
                  </div>
                </div>
                
                <div className="sm:col-span-3">
                  <label htmlFor="document-type" className="block text-sm font-medium text-gray-700">
                    Document Type *
                  </label>
                  <div className="mt-1">
                    <select
                      id="document-type"
                      name="document-type"
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Select a type</option>
                      {documentTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="sm:col-span-6">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="description"
                      name="description"
                      rows="3"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border border-gray-300 rounded-md"
                    ></textarea>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Brief description of the document.
                  </p>
                </div>
                
                <div className="sm:col-span-6">
                  <label htmlFor="document-file" className="block text-sm font-medium text-gray-700">
                    Document File *
                  </label>
                  <div 
                    className={`mt-1 flex flex-col items-center justify-center px-6 pt-5 pb-6 border-2 ${dragActive ? 'border-cvsu-green bg-green-50' : 'border-gray-300'} ${fileError ? 'border-red-300' : ''} border-dashed rounded-md`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                  >
                    {filePreview ? (
                      <div className="w-full flex flex-col items-center">
                        {filePreview === 'document' ? (
                          <div className="h-32 w-32 flex items-center justify-center bg-gray-100 rounded-md">
                            <PaperClipIcon className="h-16 w-16 text-gray-400" />
                          </div>
                        ) : (
                          <img src={filePreview} alt="File preview" className="h-32 object-cover rounded-md" />
                        )}
                        <div className="mt-4 flex items-center">
                          <span className="text-sm text-gray-900 font-medium mr-2">
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({Math.round(file.size / 1024)} KB)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setFile(null);
                              setFilePreview(null);
                              const fileInput = document.getElementById('document-file');
                              if (fileInput) fileInput.value = '';
                            }}
                            className="ml-2 text-cvsu-green hover:text-red-500 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="flex text-sm text-gray-600 justify-center">
                          <label
                            htmlFor="document-file"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-cvsu-green hover:text-cvsu-green/80 focus-within:outline-none"
                          >
                            <span>Upload a file</span>
                            <input
                              id="document-file"
                              name="document-file"
                              type="file"
                              className="sr-only"
                              onChange={handleFileChange}
                              required
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          PDF, Word, PNG, JPG, JPEG up to 10MB
                        </p>
                      </div>
                    )}
                  </div>
                  {fileError && (
                    <p className="mt-2 text-sm text-red-600">{fileError}</p>
                  )}
                </div>
              </div>
              
              <div className="pt-5">
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                  >
                    {uploading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                        Upload Document
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
            
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900">Your Documents</h3>
              <div className="mt-4 overflow-hidden border border-gray-200 rounded-lg">
                {documents.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <PaperClipIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm font-medium">No documents uploaded yet</p>
                  </div>
                ) : (
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
                          Upload Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {documents.map((document) => (
                        <tr key={document._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                                <PaperClipIcon className="h-6 w-6 text-gray-500" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{document.title}</div>
                                <div className="text-sm text-gray-500 truncate max-w-xs">{document.description || 'No description'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {document.document_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(document.verification_status)}`}>
                              {document.verification_status || 'pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(document.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 