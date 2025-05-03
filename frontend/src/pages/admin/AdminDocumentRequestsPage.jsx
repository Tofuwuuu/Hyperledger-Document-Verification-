import React from 'react';
import AdminDocumentRequests from '../../components/admin/AdminDocumentRequests';

const AdminDocumentRequestsPage = () => {
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Document Requests Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review, approve, and process document requests from alumni
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-6">
        <AdminDocumentRequests />
      </div>
    </div>
  );
};

export default AdminDocumentRequestsPage; 