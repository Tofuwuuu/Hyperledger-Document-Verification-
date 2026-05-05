import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import axios from 'axios';
import { XCircleIcon } from '@heroicons/react/24/outline';
import { DOCUMENT_TYPE_OPTIONS } from '../../constants/documentTypes';

export default function AdminDocumentUploadPage() {
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [selectedAlumni, setSelectedAlumni] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [file, setFile] = useState(null);
  
  useEffect(() => {
    fetchAlumni();
  }, []);
  
  const fetchAlumni = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_URL}/alumni`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      setAlumni(response.data || []);
    } catch (err) {
      console.error('Error fetching alumni:', err);
      setError(err.message || 'Failed to fetch alumni');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedAlumni || !title || !documentType || !file) {
      setError('Please fill out all required fields');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const formData = new FormData();
      formData.append('alumni_id', selectedAlumni);
      formData.append('title', title);
      formData.append('document_type', documentType);
      formData.append('description', description);
      formData.append('file', file);
      
      const response = await axios.post(`${API_URL}/documents/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setSuccess(true);
      // Reset form
      setSelectedAlumni('');
      setTitle('');
      setDescription('');
      setDocumentType('');
      setFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('document-file');
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Upload Document</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a new document to an alumni profile
        </p>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-400" />
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
      
      {/* Success message */}
      {success && (
        <div className="mb-6 bg-green-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Document uploaded successfully</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>The document has been uploaded and is pending verification.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Upload form */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 border border-gray-200 rounded-lg">
        <div>
          <label htmlFor="alumni" className="block text-sm font-medium text-gray-700">
            Alumni Profile *
          </label>
          <select
            id="alumni"
            name="alumni"
            value={selectedAlumni}
            onChange={(e) => setSelectedAlumni(e.target.value)}
            required
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
          >
            <option value="">Select an alumni profile</option>
            {alumni.map((a) => (
              <option key={a._id} value={a._id}>
                {a.full_name} ({a.student_id})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="document-type" className="block text-sm font-medium text-gray-700">
            Document Type *
          </label>
          <select
            id="document-type"
            name="document-type"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            required
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
          >
            <option value="">Select a document type</option>
            {DOCUMENT_TYPE_OPTIONS.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
          ></textarea>
        </div>
        
        <div>
          <label htmlFor="document-file" className="block text-sm font-medium text-gray-700">
            Document File *
          </label>
          <input
            id="document-file"
            name="document-file"
            type="file"
            onChange={handleFileChange}
            required
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
          />
          <p className="mt-1 text-sm text-gray-500">
            Accepted file types: PDF, JPG, PNG (Max size: 10MB)
          </p>
        </div>
        
        <div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cvsu-green hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </>
            ) : 'Upload Document'}
          </button>
        </div>
      </form>
    </div>
  );
} 
