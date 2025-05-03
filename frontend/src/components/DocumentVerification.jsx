import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  CircularProgress, 
  Divider, 
  Paper, 
  Tab, 
  Tabs, 
  TextField, 
  Typography,
  Alert
} from '@mui/material';
import { Upload, FileSearch, CheckCircle, XCircle } from 'phosphor-react';
import { api } from '../services/api';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`verification-tabpanel-${index}`}
      aria-labelledby={`verification-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const DocumentVerification = () => {
  const [tabValue, setTabValue] = useState(0);
  const [file, setFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  const [docId, setDocId] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyError, setVerifyError] = useState(null);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    // Reset states when switching tabs
    setFile(null);
    setUploadSuccess(false);
    setUploadError(null);
    setVerificationResult(null);
    setVerifyError(null);
  };

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadError('Please select a file to upload');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.uploadDocument(formData);
      
      setUploadSuccess(true);
      setDocId(response.data.id); // Assuming the API returns the document ID
    } catch (error) {
      console.error('Error uploading document:', error);
      setUploadError(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!docId) {
      setVerifyError('Please enter a document ID');
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);
    setVerificationResult(null);
    
    try {
      const response = await api.checkVerification(docId);
      setVerificationResult(response.data);
    } catch (error) {
      console.error('Error verifying document:', error);
      setVerifyError(error.response?.data?.message || 'Failed to verify document');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyByFile = async () => {
    if (!file) {
      setVerifyError('Please select a file to verify');
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);
    setVerificationResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.verifyByFile(formData);
      setVerificationResult(response.data);
    } catch (error) {
      console.error('Error verifying document:', error);
      setVerifyError(error.response?.data?.message || 'Failed to verify document');
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <Paper elevation={0} variant="outlined">
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="document verification tabs">
          <Tab icon={<Upload size={20} />} label="Upload Document" />
          <Tab icon={<FileSearch size={20} />} label="Verify Document" />
        </Tabs>
      </Box>

      {/* Upload Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Upload Document to Blockchain
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Select a document to securely store on the blockchain. You'll receive a unique identifier that can be used to verify this document later.
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<Upload />}
          >
            Select File
            <input
              type="file"
              hidden
              onChange={handleFileChange}
            />
          </Button>
          
          {file && (
            <Typography variant="body2">
              Selected file: {file.name}
            </Typography>
          )}
          
          {uploadError && (
            <Alert severity="error">{uploadError}</Alert>
          )}
          
          {uploadSuccess && (
            <Alert severity="success">
              Document uploaded successfully! Document ID: {docId}
            </Alert>
          )}
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            disabled={!file || uploadLoading}
            startIcon={uploadLoading ? <CircularProgress size={20} /> : null}
          >
            {uploadLoading ? 'Uploading...' : 'Upload to Blockchain'}
          </Button>
        </Box>
      </TabPanel>

      {/* Verify Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Verify Document Authenticity
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Verify a document by entering its ID or uploading the file. The system will check if the document exists on the blockchain and hasn't been tampered with.
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Document ID"
            variant="outlined"
            fullWidth
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            placeholder="Enter document ID to verify"
          />
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleVerify}
            disabled={!docId || verifyLoading}
            startIcon={verifyLoading ? <CircularProgress size={20} /> : null}
          >
            {verifyLoading ? 'Verifying...' : 'Verify by ID'}
          </Button>
          
          <Divider sx={{ my: 2 }}>OR</Divider>
          
          <Button
            variant="outlined"
            component="label"
            startIcon={<Upload />}
          >
            Select File to Verify
            <input
              type="file"
              hidden
              onChange={handleFileChange}
            />
          </Button>
          
          {file && (
            <Typography variant="body2">
              Selected file: {file.name}
            </Typography>
          )}
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleVerifyByFile}
            disabled={!file || verifyLoading}
            startIcon={verifyLoading ? <CircularProgress size={20} /> : null}
          >
            {verifyLoading ? 'Verifying...' : 'Verify by File'}
          </Button>
          
          {verifyError && (
            <Alert severity="error">{verifyError}</Alert>
          )}
          
          {verificationResult && (
            <Alert 
              severity={verificationResult.verified ? "success" : "error"}
              icon={verificationResult.verified ? <CheckCircle /> : <XCircle />}
            >
              <Typography variant="subtitle1">
                {verificationResult.verified 
                  ? "Document Verified Successfully!" 
                  : "Document Verification Failed!"}
              </Typography>
              <Typography variant="body2">
                {verificationResult.message}
              </Typography>
              {verificationResult.metadata && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" fontWeight="bold">
                    Document Information:
                  </Typography>
                  <Box component="pre" sx={{
                    mt: 1,
                    p: 1,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    fontSize: '0.8rem',
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(verificationResult.metadata, null, 2)}
                  </Box>
                </Box>
              )}
            </Alert>
          )}
        </Box>
      </TabPanel>
    </Paper>
  );
};

export default DocumentVerification; 