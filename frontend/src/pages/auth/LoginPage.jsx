import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import {
  ArrowRightIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import AuthShell from './AuthShell';

// Validation schema
const LoginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
  remember: Yup.boolean()
});

export default function LoginPage() {
  const { isAuthenticated, error: authError, clearError, login } = useAuth();
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/dashboard');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Clear errors when component mounts or when location changes
  useEffect(() => {
    setGeneralError('');
    if (clearError) clearError();
    
    // Check if there's a redirect path in the URL or session storage
    const params = new URLSearchParams(location.search);
    const redirectTo = params.get('redirect');
    const storedRedirect = sessionStorage.getItem('redirectAfterLogin');
    
    if (redirectTo) {
      setRedirectPath(redirectTo);
    } else if (storedRedirect) {
      setRedirectPath(storedRedirect);
    }

    // Redirect if already authenticated
    if (isAuthenticated) {
      // Check if there's a saved redirect path
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath);
      } else {
        navigate('/alumni');
      }
    }

    return () => {
      // Clean up
      if (clearError) clearError();
    };
  }, [location, clearError, isAuthenticated, navigate]);

  useEffect(() => {
    // Set login error from context
    if (authError) {
      setGeneralError(authError);
      clearError();
    }
  }, [authError, clearError]);

  const handleSubmit = async (values, { setSubmitting, setFieldError }) => {
    setGeneralError('');
    setIsLoading(true);
    
    try {
      await login({
        email: values.email,
        password: values.password,
        remember: values.remember
      });

      // Successful login: go where the app intended.
      const storedRedirect = sessionStorage.getItem('redirectAfterLogin');
      if (storedRedirect) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(storedRedirect);
      } else {
        navigate(redirectPath || '/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error.message || 'Unknown error');
      
      // Get error message from response if available
      let displayError = 'Login failed. Please try again.';
      
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        
        if (error.response.data?.detail) {
          if (typeof error.response.data.detail === 'string') {
            displayError = error.response.data.detail;
          } else if (Array.isArray(error.response.data.detail)) {
            // FastAPI validation errors
            displayError = error.response.data.detail.map(err => err.msg || JSON.stringify(err)).join(', ');
          } else {
            displayError = JSON.stringify(error.response.data.detail);
          }
        }
      } else if (error.message) {
        displayError = error.message;
      }
      
      // Set error in state
      setGeneralError(displayError);
      
      // Handle specific error types with field-level errors
      if (displayError.toLowerCase().includes('password')) {
        setFieldError('password', 'Incorrect password');
      }
    } finally {
      setIsLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to your alumni dashboard."
      switchText="New to the portal?"
      switchTo="/register"
      switchLabel="Create an account"
      badgeText="Secure alumni access"
    >
          {generalError && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex gap-3">
                <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Login Failed
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p className="font-semibold">{generalError}</p>
                    {(generalError.includes('No account found') ||
                      generalError.includes('register first') ||
                      generalError.includes('this email')) && (
                      <div className="mt-2">
                        <Link to="/register" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                          Register Now
                        </Link>
                        <p className="mt-1 text-sm text-gray-600">
                          Create an account to access the alumni system.
                        </p>
                      </div>
                    )}
                    {generalError.includes('password') && (
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        <li>Check that your password is entered correctly</li>
                        <li>Forgot your password? <Link to="/reset-password" className="font-medium underline">Reset it here</Link></li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <Formik
            initialValues={{
              email: '',
              password: '',
              remember: false
            }}
            validationSchema={LoginSchema}
            onSubmit={async (values, { setSubmitting, setFieldError }) => {
              // Explicit event prevention
              try {
                console.log('Form submitted with values:', { ...values, password: '***HIDDEN***' });
                await handleSubmit(values, { setSubmitting, setFieldError });
              } catch (error) {
                console.error('Form submission error:', error);
                // Make sure we don't reload even if there's an unhandled error
                setSubmitting(false);
              }
            }}
          >
            {({ isSubmitting, errors, touched, handleSubmit: formikHandleSubmit }) => (
              <Form className="space-y-5" onSubmit={(e) => {
                // Extra protection against form submission refresh
                e.preventDefault();
                formikHandleSubmit(e);
              }}>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                    Email address
                  </label>
                  <div className="mt-1">
                    <Field
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email address"
                      className={`form-input ${
                        errors.email && touched.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    <ErrorMessage
                      name="email"
                      component="p"
                      className="mt-2 text-sm text-red-600"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <div className="relative mt-1">
                    <Field
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className={`form-input pr-11 ${
                        errors.password && touched.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <EyeIcon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <ErrorMessage
                    name="password"
                    component="p"
                    className="mt-2 text-sm text-red-600"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center">
                    <Field
                      id="remember-me"
                      name="remember"
                      type="checkbox"
                      className="h-5 w-5 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded transition-all duration-200 hover:border-cvsu-green"
                    />
                    <label htmlFor="remember-me" className="ml-2 block cursor-pointer text-sm text-slate-700 transition-colors duration-200 hover:text-slate-900">
                      Remember me
                    </label>
                  </div>

                  <div className="space-y-1 text-sm sm:text-right">
                    <Link to="/reset-password" className="flex items-center font-semibold text-cvsu-green transition-colors duration-200 hover:text-cvsu-green/80 sm:justify-end">
                      <KeyIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                      Forgot your password?
                    </Link>
                    <Link to="/account-recovery" className="flex items-center font-medium text-slate-500 transition-colors duration-200 hover:text-cvsu-green sm:justify-end">
                      <LockClosedIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                      More recovery options
                    </Link>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="btn-primary flex w-full justify-center disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoading ? (
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <>
                        Sign in
                        <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </Form>
            )}
          </Formik>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or verify a document</span>
              </div>
            </div>

            <div className="mt-5">
              <Link
                to="/verify"
                className="flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2"
              >
                Go to Document Verification
              </Link>
            </div>
          </div>
    </AuthShell>
  );
} 
