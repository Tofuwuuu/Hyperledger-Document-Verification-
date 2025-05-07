import { useState } from 'react';
import { toast } from 'react-toastify';
import { selfVerify } from '../../services/authService';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function VerifyYourselfPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser, loadUserData } = useAuth();

  const handleVerify = async () => {
    setLoading(true);
    try {
      await selfVerify();
      await loadUserData(); // Refresh user data
      toast.success('Your account has been verified!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error verifying account:', error);
      toast.error(error.response?.data?.detail || 'Failed to verify your account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Account Verification</h1>
        
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400">
          <p className="text-yellow-700">
            <strong>Note:</strong> This is a testing feature only. 
            Normal verification requires admin approval.
          </p>
        </div>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Your Current Status</h2>
          <div className="flex items-center mb-4">
            <div className={`w-3 h-3 rounded-full mr-2 ${currentUser?.is_verified ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{currentUser?.is_verified ? 'Verified' : 'Not Verified'}</span>
          </div>
          
          {!currentUser?.is_verified && (
            <button
              onClick={handleVerify}
              disabled={loading}
              className="w-full sm:w-auto bg-cvsu-green hover:bg-cvsu-green-dark text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </div>
              ) : (
                'Verify My Account'
              )}
            </button>
          )}
          
          {currentUser?.is_verified && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4">
              <p className="text-green-700">
                Your account is already verified! You can now register for events.
              </p>
              <div className="mt-3">
                <Link 
                  to="/events"
                  className="inline-block bg-cvsu-green hover:bg-cvsu-green-dark text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Browse Events
                </Link>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">What does verification do?</h2>
          <p className="text-gray-700 mb-2">
            Verification confirms your identity as a legitimate CVSU-Carmona alumnus/alumna.
            Once verified, you can:
          </p>
          <ul className="list-disc pl-5 mb-4 text-gray-700">
            <li>Register for alumni events</li>
            <li>Request official documents</li>
            <li>Access exclusive resources</li>
            <li>Connect with the alumni network</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 