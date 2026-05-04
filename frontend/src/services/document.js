import api from './api';
import { verificationService } from './api';
import { sha256 } from 'js-sha256';

// Document hash calculation
export const calculateDocumentHash = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target.result;
        const hash = sha256(arrayBuffer);
        resolve(hash);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsArrayBuffer(file);
  });
};

// Document verification service
const documentVerificationService = {
  // Store document hash in blockchain
  storeDocumentOnBlockchain: async (documentId, fileOrHash, metadata = {}) => {
    let hash;
    
    // If a file was provided, calculate its hash
    if (fileOrHash instanceof File) {
      hash = await calculateDocumentHash(fileOrHash);
    } else {
      // Assume a hash was provided directly
      hash = fileOrHash;
    }
    
    // Prepare metadata
    const metadataObj = {
      ...metadata,
      timestamp: new Date().toISOString()
    };
    
    // Store document hash on blockchain using updated API endpoint
    return verificationService.storeDocument(documentId, hash, metadataObj);
  },
  
  // Verify document against blockchain
  verifyDocumentOnBlockchain: async (documentId, fileOrHash, verifier = '') => {
    let hash;
    
    // If a file was provided, calculate its hash
    if (fileOrHash instanceof File) {
      hash = await calculateDocumentHash(fileOrHash);
    } else {
      // Assume a hash was provided directly
      hash = fileOrHash;
    }
    
    // Verify document hash on blockchain using updated API endpoint
    return verificationService.verifyDocument(documentId, hash);
  },
  
  // Get document history from blockchain
  getDocumentHistoryFromBlockchain: async (documentId) => {
    return verificationService.getDocumentHistory(documentId);
  },
  
  // Upload document with blockchain verification
  uploadDocumentWithVerification: async (data) => {
    try {
      // 1. Upload document to backend storage
      const uploadResponse = await api.post('/documents/upload', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      
      if (!uploadResponse.data.success) {
        throw new Error('Document upload failed');
      }
      
      const documentId = uploadResponse.data.document_id;
      const file = data.get('file');
      const hash = await calculateDocumentHash(file);
      
      // Document uploads stay pending until an admin approves them.
      return {
        success: true,
        document_id: documentId,
        hash: hash,
        blockchain_tx_id: null,
        ...uploadResponse.data
      };
    } catch (error) {
      console.error('Error uploading document with verification:', error);
      return {
        success: false,
        message: error.message || 'Failed to upload and verify document'
      };
    }
  },
  
  // Verify document with blockchain
  verifyDocument: async (documentId, file) => {
    try {
      const verificationResponse = await verificationService.verifyByFile(documentId, file);
      
      return {
        success: true,
        verified: verificationResponse.data?.verified || false,
        status: verificationResponse.data?.status || 'FAKE',
        document_id: documentId || verificationResponse.data?.metadata?.blockchain_record?.document_id || null,
        hash: verificationResponse.data?.metadata?.uploaded_hash || null,
        metadata: verificationResponse.data?.metadata || {}
      };
    } catch (error) {
      console.error('Error verifying document:', error);
      return {
        success: false,
        verified: false,
        message: error.message || 'Failed to verify document'
      };
    }
  },

  verifyUploadedFile: async (file, documentId = '') => {
    try {
      const verificationResponse = await verificationService.verifyByFile(documentId, file);
      return {
        success: true,
        verified: verificationResponse.data?.verified || false,
        status: verificationResponse.data?.status || 'FAKE',
        metadata: verificationResponse.data?.metadata || {}
      };
    } catch (error) {
      console.error('Error verifying uploaded file:', error);
      return {
        success: false,
        verified: false,
        status: 'FAKE',
        message: error.message || 'Failed to verify document'
      };
    }
  },
  
  // Get document verification history
  getDocumentVerificationHistory: async (documentId) => {
    try {
      const historyResponse = await documentVerificationService.getDocumentHistoryFromBlockchain(documentId);
      
      return {
        success: true,
        history: historyResponse.data?.history || [],
        document_id: documentId
      };
    } catch (error) {
      console.error('Error getting document history:', error);
      return {
        success: false,
        history: [],
        message: error.message || 'Failed to get document history'
      };
    }
  }
};

export default documentVerificationService; 
