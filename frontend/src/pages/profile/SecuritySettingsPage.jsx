import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import MFASetup from '../../components/MFASetup';
import { useAuth } from '../../context/AuthContext';

const SecuritySettingsPage = () => {
  const { currentUser, logout } = useAuth();

  const handleChangePassword = () => {
    // Navigate to change password page or open modal
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto mt-8">
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Account Security</h2>
            <p className="text-gray-600 mb-4">
              Manage your password and security settings to keep your account safe.
            </p>
            
            <div className="mt-4">
              <button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-cvsu-green text-white rounded hover:bg-cvsu-green-dark"
              >
                Change Password
              </button>
            </div>
          </div>
          
          <MFASetup />
          
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4 text-red-600">Danger Zone</h2>
            <div className="border border-red-200 rounded-lg p-4">
              <h3 className="font-medium mb-2">Account Actions</h3>
              <p className="text-gray-600 mb-4">
                These actions are destructive and cannot be undone. Please proceed with caution.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Logout from All Devices
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SecuritySettingsPage; 