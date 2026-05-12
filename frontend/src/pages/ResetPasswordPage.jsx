import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { requestPasswordReset, verifyResetToken, resetPassword } from '../services/authService';
import AuthShell from './auth/AuthShell';

const steps = ['Email', 'Token', 'New password'];

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get('token') || '';

  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(initialToken ? 3 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialToken ? 'Recovery verified. Choose a new password.' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const getErrorMessage = (err, fallback) => (
    err.response?.data?.detail || err.message || fallback
  );

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);

    try {
      const response = await requestPasswordReset(email.trim());

      if (response.reset_token) {
        setToken(response.reset_token);
        setNotice('A reset session was created. You can set a new password now.');
        setStep(3);
      } else {
        setNotice('If the email exists, a reset token has been issued.');
        setStep(2);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to request password reset'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyToken = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!token.trim()) {
      setError('Token is required');
      return;
    }

    setLoading(true);

    try {
      const response = await verifyResetToken(token.trim());
      setNotice(response.email ? `Token verified for ${response.email}.` : 'Token verified.');
      setStep(3);
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid or expired token'));
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
      await resetPassword(token.trim(), password, confirmPassword);
      setStep(4);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={step === 4 ? 'Password updated' : 'Reset your password'}
      subtitle={step === 4 ? 'You can now sign in with your new password.' : 'Use your email or reset token to recover access.'}
      switchText="Remembered your password?"
      switchTo="/login"
      switchLabel="Back to login"
      badgeText="Password recovery"
    >
      {step < 4 && (
        <div className="mb-6 grid grid-cols-3 gap-2">
          {steps.map((label, index) => {
            const isActive = step === index + 1;
            const isDone = step > index + 1;

            return (
              <div
                key={label}
                className={`rounded-md border px-2 py-2 text-center text-xs font-semibold ${
                  isActive || isDone
                    ? 'border-cvsu-green bg-cvsu-green/10 text-cvsu-green'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex gap-3">
            <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        </div>
      )}

      {notice && step < 4 && (
        <div className="mb-5 rounded-lg border border-cvsu-green/20 bg-cvsu-green/10 p-4">
          <p className="text-sm font-medium text-cvsu-green">{notice}</p>
        </div>
      )}

      {step === 1 && (
        <form className="space-y-5" onSubmit={handleRequestReset}>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input mt-1"
              placeholder="Enter your email address"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full justify-center disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Checking...' : 'Continue'}
            {!loading && <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full text-center text-sm font-semibold text-cvsu-green hover:text-cvsu-green/80"
          >
            I already have a reset token
          </button>
        </form>
      )}

      {step === 2 && (
        <form className="space-y-5" onSubmit={handleVerifyToken}>
          <div>
            <label htmlFor="token" className="block text-sm font-semibold text-slate-700">
              Reset token
            </label>
            <textarea
              id="token"
              name="token"
              required
              rows={4}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="form-input mt-1 resize-none"
              placeholder="Paste your reset token"
            />
            <p className="mt-2 text-xs text-slate-500">
              Tokens may be longer than a short code in this local setup.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full justify-center disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Verifying...' : 'Verify token'}
            {!loading && <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex w-full items-center justify-center text-sm font-semibold text-slate-600 hover:text-cvsu-green"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Use a different email
          </button>
        </form>
      )}

      {step === 3 && (
        <form className="space-y-5" onSubmit={handleResetPassword}>
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
              New password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input pr-11"
                placeholder="Create a new password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700">
              Confirm new password
            </label>
            <div className="relative mt-1">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input pr-11"
                placeholder="Re-enter your new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Password must have at least 6 characters.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full justify-center disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Updating...' : 'Reset password'}
            {!loading && <KeyIcon className="ml-2 h-4 w-4" aria-hidden="true" />}
          </button>
        </form>
      )}

      {step === 4 && (
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Your password has been reset successfully.
          </p>
          <Link to="/login" className="btn-primary mt-6 w-full">
            Go to login
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
