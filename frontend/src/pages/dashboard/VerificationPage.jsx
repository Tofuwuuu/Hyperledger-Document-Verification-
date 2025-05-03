import React from 'react';
import DocumentVerification from '../../components/DocumentVerification';
import { Card, CardContent, Typography } from '@mui/material';

const VerificationPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <Typography variant="h4" component="h1" gutterBottom>
        Document Verification Portal
      </Typography>
      
      <Card className="mt-6">
        <CardContent>
          <Typography variant="body1" className="mb-4">
            Use this portal to upload new documents to the blockchain or verify existing documents.
          </Typography>
          
          <DocumentVerification />
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificationPage; 