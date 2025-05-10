import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import MFAVerification from '../../components/MFAVerification';
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

  const handleSubmit = async (values, { setSubmitting }) => {
    setGeneralError('');
    setIsLoading(true);
    
    try {
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
      if (error.response) {
        const status = error.response.status;
        const errorDetail = error.response.data?.detail || '';
        
        if (status === 401) {
          // Handle authentication errors
          if (errorDetail.includes('email or password you entered is incorrect')) {
            setGeneralError(errorDetail);
          } else if (errorDetail.includes('deactivated')) {
            setGeneralError(errorDetail);
          } else if (errorDetail.includes('verification')) {
            setGeneralError('Your account email has not been verified. Please check your inbox for a verification link.');
          } else {
            // Fallback for other authentication errors
            setGeneralError('Invalid credentials. Please double-check your email and password.');
          }
        } else if (status === 429) {
          setGeneralError('Too many failed login attempts. Please try again later or reset your password.');
        } else if (status === 503) {
          setGeneralError('The service is temporarily unavailable. Please try again later.');
        } else {
          // Use the error message from the server if available
          setGeneralError(errorDetail || 'Login failed. Please try again later.');
        }
      } else if (error.request) {
        // Network error - the request was made but no response was received
        setGeneralError('Cannot connect to the server. Please check your internet connection and try again.');
      } else {
        // Something else caused the error
        setGeneralError('Login failed. Please try again later.');
      }
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
                    {generalError.includes('email or password') && (
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        <li>Make sure you are using the correct email address</li>
                        <li>Check that your password is entered correctly</li>
                        <li>If you're new, please <Link to="/register" className="font-medium underline">register here</Link></li>
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
                      className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                      Remember me
                    </label>
                  </div>

                  <div className="text-sm">
                    <Link to="/reset-password" className="font-medium text-cvsu-green hover:text-green-700">
                      Forgot your password?
                    </Link>
                    <span className="mx-1 text-gray-500">|</span>
                    <Link to="/account-recovery" className="font-medium text-cvsu-green hover:text-green-700">
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