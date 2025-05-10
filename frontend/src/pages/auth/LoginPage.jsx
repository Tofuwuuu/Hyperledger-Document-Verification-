import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import MFAVerification from '../../components/MFAVerification';
import axios from 'axios';
// import cvsuLogo from '../../assets/cvsu-logo.png';

// Placeholder for the logo until the actual image is added
const cvsuLogo = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzM4YTM4OSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjIwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiPkNWU1U8L3RleHQ+PC9zdmc+';

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
  const { login, isAuthenticated, error: authError, clearError } = useAuth();
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/dashboard');
  const navigate = useNavigate();
  const location = useLocation();
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaData, setMfaData] = useState(null);

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
      // First, check if the user exists using the MFA check endpoint
      try {
        // This try-catch specifically handles MFA check errors
        const mfaCheckResponse = await axios.post(`${import.meta.env.VITE_API_URL || ''}/auth/login/mfa-check`, {
          email: values.email
        });
        
        // If we get here, user exists, proceed with normal login
      } catch (mfaError) {
        // If mfaCheck fails with 401, user doesn't exist
        if (mfaError.response && mfaError.response.status === 401) {
          setGeneralError('This account does not exist. Please register first.');
          setIsLoading(false);
          setSubmitting(false);
          return; // Stop the login process here
        }
        // For other MFA check errors, continue with normal login attempt
      }
      
      // Normal login flow continues
      const result = await login({ 
        email: values.email, 
        password: values.password,
        remember: values.remember // Add remember flag from form values
      });
      
      // Check if MFA is required
      if (result.mfa_required) {
        setMfaRequired(true);
        setMfaData({
          email: values.email,
          setup_id: result.setup_id,
          mfa_type: result.mfa_type,
          masked_email: result.email,
          remember: values.remember
        });
      }
      // If login is successful but no MFA, the useEffect will redirect
    } catch (error) {
      console.error('Login error:', error);
      
      // Enhanced error messages based on error types
      let errorMessage = '';
      
      if (error.response) {
        const status = error.response.status;
        const errorDetail = error.response.data?.detail || '';
        const errorType = error.response.headers?.['x-error-type'];
        
        if (status === 401) {
          // Check for specific error type headers
          if (errorType === 'account_not_found') {
            errorMessage = 'This account does not exist. Please register first.';
          } else if (errorType === 'wrong_password') {
            errorMessage = 'Incorrect password. Please try again.';
          } else if (errorDetail.includes("account with this email address doesn't exist")) {
            errorMessage = 'This account does not exist. Please register first.';
          } else if (errorDetail.includes('deactivated')) {
            errorMessage = errorDetail;
          } else if (errorDetail.includes('verification')) {
            errorMessage = 'Your account email has not been verified. Please check your inbox for a verification link.';
          } else {
            // Fallback for other authentication errors
            errorMessage = errorDetail || 'Invalid credentials. Please try again.';
          }
        } else if (status === 429) {
          errorMessage = 'Too many failed login attempts. Please try again later or reset your password.';
        } else if (status === 503) {
          errorMessage = 'The service is temporarily unavailable. Please try again later.';
        } else {
          // Use the error message from the server if available
          errorMessage = errorDetail || 'Login failed. Please try again later.';
        }
      } else if (error.request) {
        // Network error - the request was made but no response was received
        errorMessage = 'Cannot connect to the server. Please check your internet connection and try again.';
      } else {
        // Something else caused the error
        errorMessage = 'Login failed. Please try again later.';
      }
      
      // Set error in state only - don't store in sessionStorage to prevent refresh issues
      setGeneralError(errorMessage);
      
      // Handle specific error types with field-level errors
      if (errorMessage.includes('password')) {
        setFieldError('password', 'Incorrect password');
      }
      
      // No longer storing in sessionStorage here to avoid refresh-related issues
    } finally {
      setIsLoading(false);
      setSubmitting(false);
    }
  };

  const handleMfaVerified = (result) => {
    // No need to do anything here, the auth context will handle it
    // and the useEffect for isAuthenticated will redirect
    setMfaRequired(false);
    setMfaData(null);
  };
  
  const handleMfaCancel = () => {
    setMfaRequired(false);
    setMfaData(null);
  };

  if (mfaRequired && mfaData) {
    return (
      <MFAVerification 
        email={mfaData.email}
        setup_id={mfaData.setup_id}
        mfa_type={mfaData.mfa_type}
        remember={mfaData.remember}
        onVerified={handleMfaVerified}
        onCancel={handleMfaCancel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img
          className="mx-auto h-16 w-auto"
          src={cvsuLogo}
          alt="CVSU Logo"
        />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link to="/register" className="font-medium text-cvsu-green hover:text-green-700">
            register for a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {generalError && (
            <div className="rounded-md bg-red-50 p-4 mb-4 border border-red-300">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Login Failed
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{generalError}</p>
                    {generalError.includes('account does not exist') && (
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
            onSubmit={async (values, { setSubmitting }) => {
              await handleSubmit(values, { setSubmitting });
            }}
          >
            {({ isSubmitting, errors, touched }) => (
              <Form className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="mt-1">
                    <Field
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      className={`form-input ${
                        errors.email && touched.email ? 'border-red-500' : ''
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
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1">
                    <Field
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      className={`form-input ${
                        errors.password && touched.password ? 'border-red-500' : ''
                      }`}
                    />
                    <ErrorMessage
                      name="password"
                      component="p"
                      className="mt-2 text-sm text-red-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Field
                      id="remember-me"
                      name="remember"
                      type="checkbox"
                      className="h-5 w-5 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded transition-all duration-200 hover:border-cvsu-green"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 hover:text-gray-900 cursor-pointer transition-colors duration-200">
                      Remember me
                    </label>
                  </div>

                  <div className="text-sm">
                    <Link to="/reset-password" className="font-medium text-cvsu-green hover:text-green-700 flex items-center transition-colors duration-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Forgot your password?
                    </Link>
                    <Link to="/account-recovery" className="font-medium text-gray-500 hover:text-cvsu-green block mt-1 flex items-center transition-colors duration-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      More recovery options
                    </Link>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="btn-primary w-full flex justify-center"
                  >
                    {isLoading ? (
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : 'Sign in'}
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

            <div className="mt-6">
              <Link
                to="/verify"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
              >
                Go to Document Verification
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 