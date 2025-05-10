import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const MFASetup = () => {
  const { authService } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState('initial'); // initial, setup, verify
  const [mfaStatus, setMfaStatus] = useState({ is_enabled: false });
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Load MFA status on component mount
  useEffect(() => {
    const loadMfaStatus = async () => {
      try {
        const status = await authService.getMFAStatus();
        setMfaStatus(status);
      } catch (err) {
        setError('Failed to load MFA status');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadMfaStatus();
  }, [authService]);
  
  const handleSetupMFA = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      const response = await authService.setupMFA('email');
      setSetupData(response);
      setSetupStep('verify');
    } catch (err) {
      setError('Failed to set up MFA. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    if (!/^\d{6}$/.test(verificationCode)) {
      setError('Please enter a valid 6-digit code');
      setLoading(false);
      return;
    }
    
    try {
      await authService.enableMFA(verificationCode);
      setSuccess('MFA has been successfully enabled');
      setMfaStatus({ ...mfaStatus, is_enabled: true });
      setSetupStep('initial');
    } catch (err) {
      setError('Failed to verify code. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDisableMFA = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      await authService.disableMFA();
      setSuccess('MFA has been successfully disabled');
      setMfaStatus({ ...mfaStatus, is_enabled: false });
    } catch (err) {
      setError('Failed to disable MFA. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading && setupStep === 'initial') {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium mb-4">Two-Factor Authentication</h2>
      
      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-2 bg-green-50 text-green-600 text-sm rounded">
          {success}
        </div>
      )}
      
      {setupStep === 'initial' && (
        <div>
          <p className="mb-4 text-gray-600">
            {mfaStatus.is_enabled 
              ? "Two-factor authentication is currently enabled. This adds an extra layer of security to your account."
              : "Two-factor authentication adds an extra layer of security to your account by requiring a verification code in addition to your password."}
          </p>
          
          {mfaStatus.is_enabled ? (
            <div>
              <div className="mb-4 p-4 border border-gray-200 rounded">
                <h3 className="font-medium mb-2">Current MFA Method</h3>
                <p className="text-sm text-gray-600">
                  Email: {mfaStatus.email}
                </p>
              </div>
              
              <button
                onClick={handleDisableMFA}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                disabled={loading}
              >
                {loading ? "Disabling..." : "Disable Two-Factor Authentication"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleSetupMFA}
              className="px-4 py-2 bg-cvsu-green text-white rounded hover:bg-cvsu-green-dark"
              disabled={loading}
            >
              {loading ? "Setting up..." : "Enable Two-Factor Authentication"}
            </button>
          )}
        </div>
      )}
      
      {setupStep === 'verify' && setupData && (
        <div>
          <p className="mb-4 text-gray-600">
            A verification code has been sent to your email address. 
            Please enter the code below to complete the setup.
          </p>
          
          <form onSubmit={handleVerifyCode} className="mt-4">
            <div className="mb-4">
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
                Verification Code
              </label>
              <input
                id="verificationCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="6"
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-cvsu-green focus:border-transparent text-center text-xl"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the 6-digit code sent to your email
              </p>
            </div>
            
            <div className="flex space-x-4">
              <button
                type="submit"
                className="px-4 py-2 bg-cvsu-green text-white rounded hover:bg-cvsu-green-dark"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify and Enable"}
              </button>
              
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                onClick={() => setSetupStep('initial')}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default MFASetup; 