import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import MFASetup from '../../components/MFASetup';
import SecurityQuestionsSetup from '../../components/SecurityQuestionsSetup';
import { useAuth } from '../../context/AuthContext';

const SecuritySettingsPage = () => {
  const { currentUser, logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    
    // Validation
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (passwordData.new_password.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await authService.changePassword(passwordData);
      setPasswordSuccess('Password changed successfully');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      setShowChangePassword(false);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto mt-8">
        <h1 className="text-2xl font-bold mb-6">Security Settings</h1>
        
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Password</h2>
            <p className="text-gray-600 mb-4">
              A strong password helps protect your account. We recommend using a unique password that you don't use for other services.
            </p>
            
            {!showChangePassword ? (
              <div className="mt-4">
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="px-4 py-2 bg-cvsu-green text-white rounded hover:bg-cvsu-green-dark"
                >
                  Change Password
                </button>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="mt-4">
                {passwordError && (
                  <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">
                    {passwordError}
                  </div>
                )}
                
                {passwordSuccess && (
                  <div className="mb-4 p-2 bg-green-50 text-green-600 text-sm rounded">
                    {passwordSuccess}
                  </div>
                )}
                
                <div className="mb-4">
                  <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    id="current_password"
                    name="current_password"
                    type="password"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                    value={passwordData.current_password}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    id="new_password"
                    name="new_password"
                    type="password"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                    value={passwordData.new_password}
                    onChange={handleInputChange}
                    required
                    minLength={8}
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm"
                    value={passwordData.confirm_password}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cvsu-green text-white rounded hover:bg-cvsu-green-dark disabled:opacity-50"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Changing...' : 'Save New Password'}
                  </button>
                  
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                    onClick={() => setShowChangePassword(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
          
          <MFASetup />
          
          <SecurityQuestionsSetup />
          
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