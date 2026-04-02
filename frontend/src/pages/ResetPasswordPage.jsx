import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { requestPasswordReset, verifyResetToken, resetPassword } from '../services/authService';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get('token') || '';
  
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(initialToken ? 3 : 1); // 1: Email, 2: Token, 3: New Password, 4: Success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    setLoading(true);
    
    try {
      await requestPasswordReset(email);
      setStep(2);
    } catch (error) {
      if (error.response && error.response.data) {
        setError(error.response.data.detail || 'Failed to send reset email');
      } else {
        setError('Network error, please try again later');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyToken = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!token) {
      setError('Token is required');
      return;
    }
    
    setLoading(true);
    
    try {
      await verifyResetToken(token);
      setStep(3);
    } catch (error) {
      if (error.response && error.response.data) {
        setError(error.response.data.detail || 'Invalid or expired token');
      } else {
        setError('Network error, please try again later');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!password) {
      setError('Password is required');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      await resetPassword(token, password, confirmPassword);
      setStep(4);
    } catch (error) {
      if (error.response && error.response.data) {
        setError(error.response.data.detail || 'Failed to reset password');
      } else {
        setError('Network error, please try again later');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-cvsu-green flex items-center justify-center">
              <KeyIcon className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Reset your password</h2>
          {step < 4 && (
            <p className="mt-2 text-center text-sm text-gray-600">
              Follow the steps to reset your CVSU-Carmona document verification system password
            </p>
          )}
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Email form */}
            {step === 1 && (
              <form className="space-y-6" onSubmit={handleRequestReset}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-cvsu-green focus:outline-none focus:ring-cvsu-green sm:text-sm"
                      placeholder="alumni@example.com"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full justify-center rounded-md border border-transparent bg-cvsu-green px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2 disabled:opacity-75"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>

                <div className="text-sm text-center">
                  <Link to="/login" className="font-medium text-cvsu-green hover:text-cvsu-green/90">
                    Back to login
                  </Link>
                </div>
              </form>
            )}

            {/* Step 2: Token form */}
            {step === 2 && (
              <form className="space-y-6" onSubmit={handleVerifyToken}>
                <div>
                  <div className="rounded-md bg-blue-50 p-4 mb-6">
                    <div className="flex">
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                          A password reset token has been sent to <strong>{email}</strong>. Please check your email and enter the token below.
                        </p>
                      </div>
                    </div>
                  </div>
                  <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                    Reset Token
                  </label>
                  <div className="mt-1">
                    <input
                      id="token"
                      name="token"
                      type="text"
                      required
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-cvsu-green focus:outline-none focus:ring-cvsu-green sm:text-sm"
                      placeholder="Enter the 6-digit code"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full justify-center rounded-md border border-transparent bg-cvsu-green px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2 disabled:opacity-75"
                  >
                    {loading ? 'Verifying...' : 'Verify Token'}
                  </button>
                </div>

                <div className="text-sm text-center">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="font-medium text-cvsu-green hover:text-cvsu-green/90"
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: New Password form */}
            {step === 3 && (
              <form className="space-y-6" onSubmit={handleResetPassword}>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-cvsu-green focus:outline-none focus:ring-cvsu-green sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-cvsu-green focus:outline-none focus:ring-cvsu-green sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full justify-center rounded-md border border-transparent bg-cvsu-green px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2 disabled:opacity-75"
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Success message */}
            {step === 4 && (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
                </div>
                <h3 className="mt-2 text-lg font-medium text-gray-900">Password reset successful</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Your password has been successfully reset. You can now use your new password to log into your account.
                </p>
                <div className="mt-6">
                  <Link
                    to="/login"
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-cvsu-green px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2"
                  >
                    Go to Login
                  </Link>
                </div>
              </div>
            )}

            {/* Password requirements - Show in steps 1-3 */}
            {step < 4 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700">Password requirements:</h3>
                <ul className="mt-2 text-xs text-gray-500 list-disc list-inside space-y-1">
                  <li>At least 6 characters</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 