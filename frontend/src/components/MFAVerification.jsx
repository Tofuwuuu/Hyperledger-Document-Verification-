import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const MFAVerification = ({ email, setup_id, mfa_type, onVerified, onCancel }) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  
  const { authService } = useAuth();
  
  // Handle countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown]);
  
  // Format countdown as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!verificationCode) {
      setError('Please enter the verification code');
      return;
    }
    
    // Verify the code has 6 digits
    if (!/^\d{6}$/.test(verificationCode)) {
      setError('Verification code must be 6 digits');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await authService.verifyMfa(email, verificationCode);
      onVerified(result);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to verify code. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md mx-auto">
      <h2 className="text-xl font-bold text-center mb-6">Two-Factor Authentication</h2>
      
      <div className="mb-4 text-center">
        <p className="text-gray-600 mb-2">
          A verification code has been sent to your email address.
        </p>
        <p className="text-sm text-gray-500">
          Code expires in <span className="font-medium text-red-600">{formatTime(countdown)}</span>
        </p>
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
            Enter 6-digit Verification Code
          </label>
          <input
            id="verificationCode"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength="6"
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-cvsu-green focus:border-transparent text-center text-2xl tracking-widest"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            autoComplete="one-time-code"
            required
          />
        </div>
        
        <div className="flex flex-col space-y-2">
          <button
            type="submit"
            className="w-full bg-cvsu-green text-white py-2 rounded hover:bg-cvsu-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Verifying...' : 'Verify'}
          </button>
          
          <button
            type="button"
            className="w-full bg-transparent text-gray-500 py-2 rounded hover:bg-gray-50 focus:outline-none"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>
      
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-500">
          Didn't receive the code? 
          <button 
            className="text-cvsu-green ml-1 hover:underline focus:outline-none"
            onClick={() => {
              // Resend code logic would go here
              // For now, just reset the countdown
              setCountdown(300);
              alert('A new code has been sent to your email');
            }}
          >
            Resend
          </button>
        </p>
      </div>
    </div>
  );
};

export default MFAVerification; 