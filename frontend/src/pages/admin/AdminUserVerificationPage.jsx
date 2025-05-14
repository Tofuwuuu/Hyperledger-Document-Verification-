import React from 'react';

export default function AdminUserVerificationPage() {
  return (
    <div id="admin-user-verification-page" className="flex flex-col space-y-6 w-full">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Verification</h1>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">User Verification Page</h2>
        <p className="mb-4">This page allows administrators to review and verify user accounts.</p>
        
        <div className="bg-gray-50 p-4 rounded-md mt-4">
          <h3 className="text-md font-medium mb-2">Sample User Data</h3>
          <div className="bg-white p-3 rounded border">
            <p><span className="font-medium">Name:</span> Test User</p>
            <p><span className="font-medium">Email:</span> test@example.com</p>
            <p><span className="font-medium">Student ID:</span> TEST-12345</p>
          </div>
        </div>
      </div>
    </div>
  );
} 