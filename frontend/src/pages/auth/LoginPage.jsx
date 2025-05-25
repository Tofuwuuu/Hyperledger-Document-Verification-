import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
// import cvsuLogo from '../../assets/cvsu-logo.png';
import { authService } from '../../services/api';

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
  userType: Yup.string()
    .oneOf(['alumni', 'employer'], 'Invalid user type')
    .required('User type is required')
});

export default function LoginPage() {
  const { login, error: authError, clearError } = useAuth();
  const [generalError, setGeneralError] = useState('');
  const [isAccountTypeError, setIsAccountTypeError] = useState(false);
  const [isCredentialsError, setIsCredentialsError] = useState(false);
  const [correctAccountType, setCorrectAccountType] = useState(null); // New state to track correct account type
  const [isLoading, setIsLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/dashboard');
  const navigate = useNavigate();
  const location = useLocation();

  // Clear errors when component mounts or when location changes
  useEffect(() => {
    setGeneralError('');
    setIsAccountTypeError(false);
    setIsCredentialsError(false);
    setCorrectAccountType(null); // Reset correct account type
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

    return () => {
      // Clean up
      if (clearError) clearError();
    };
  }, [location, clearError]);

  // Function to check if an error message relates to account type mismatch
  const checkAccountTypeMismatch = (errorMsg) => {
    if (!errorMsg) return { isAccountType: false, correctType: null };
    
    // Convert to string if it's an object somehow
    const errStr = typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg);
    
    // Check for various patterns of error messages
    const isAlumniAccount = 
      errStr.includes('ALUMNI/STUDENT account') || 
      errStr.includes('Alumni/Student') || 
      errStr.includes('alumni account') ||
      errStr.includes('student account');
      
    const isEmployerAccount = 
      errStr.includes('EMPLOYER account') || 
      errStr.includes('Employer account') ||
      errStr.includes('employer account');
      
    if (isAlumniAccount) {
      return { isAccountType: true, correctType: 'alumni' };
    }
    
    if (isEmployerAccount) {
      return { isAccountType: true, correctType: 'employer' };
    }
    
    return { isAccountType: false, correctType: null };
  };

  const handleSubmit = async (values, { setSubmitting, setFieldValue }) => {
    setGeneralError('');
    setIsAccountTypeError(false);
    setIsCredentialsError(false);
    setCorrectAccountType(null);
    setIsLoading(true);
    
    try {
      const isEmployer = values.userType === 'employer';
      console.log(`Attempting ${isEmployer ? 'employer' : 'alumni'} login for:`, values.email);
      
      // Use the login function with the appropriate user type
      await login(values.email, values.password, isEmployer);
      
      // If successful, clear the stored redirect path
      sessionStorage.removeItem('redirectAfterLogin');
      
      // Navigate to the redirect path
      navigate(redirectPath);
      
    } catch (error) {
      console.error('Login failed:', error);
      
      // Try to extract error message
      let errorMessage = 'Failed to login. Please check your credentials and try again.';
      let isWrongAccountType = false;
      let isWrongCredentials = false;
      let detectedAccountType = null;
      
      // Debug logging - log the complete error object
      console.log('Complete error object:', JSON.stringify(error, null, 2));
      if (error.response) {
        console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        console.log('Response headers:', JSON.stringify(error.response.headers, null, 2));
      }
      
      // FORCE CHECK FOR EMPLOYER LOGIN ENDPOINT WITH 401 ERROR
      // This is a specific pattern we've observed in the error data
      if (error.response && error.response.status === 401 && 
          error.config && error.config.url && 
          error.config.url.includes('/employers/login')) {
        // User tried to log in as employer but might have a student account
        console.log('Detected employer login endpoint with 401 error - likely account type mismatch');
        isWrongAccountType = true;
        detectedAccountType = 'alumni';
        errorMessage = "This email is registered as an ALUMNI/STUDENT account. Please select 'Alumni / Student' account type.";
        setCorrectAccountType('alumni');
      }
      // Similarly, check for student login with employer account
      else if (error.response && error.response.status === 401 && 
               error.config && error.config.url && 
               error.config.url.includes('/auth/login')) {
        // Check if there's any indication this might be an employer account
        const employerPatterns = ['employer account', 'EMPLOYER account'];
        let isEmployerAccount = false;
        
        // Check if any error message contains employer account pattern
        if (error.response.data && typeof error.response.data === 'object') {
          const detailStr = error.response.data.detail;
          if (detailStr && employerPatterns.some(pattern => detailStr.includes(pattern))) {
            isEmployerAccount = true;
          }
        }
        
        if (isEmployerAccount) {
          isWrongAccountType = true;
          detectedAccountType = 'employer';
          errorMessage = "This email is registered as an EMPLOYER account. Please select 'Employer' account type.";
          setCorrectAccountType('employer');
        } else {
          // Likely just wrong credentials for student account
          isWrongCredentials = true;
          errorMessage = "Incorrect email or password. Please check your credentials and try again.";
        }
      }
      
      // Special check for the specific account type error message format in the screenshot
      if (!isWrongAccountType && error.response && error.response.data && error.response.data.detail) {
        const detail = error.response.data.detail;
        
        // Use the helper function to check for account type mismatch patterns
        const { isAccountType, correctType } = checkAccountTypeMismatch(detail);
        
        if (isAccountType) {
          isWrongAccountType = true;
          detectedAccountType = correctType;
          setCorrectAccountType(correctType);
          errorMessage = correctType === 'alumni' 
            ? "This email is registered as an ALUMNI/STUDENT account. Please select 'Alumni / Student' account type."
            : "This email is registered as an EMPLOYER account. Please select 'Employer' account type.";
          console.log(`Detected ${correctType} account type error from detail`);
        } else if (detail.includes('Incorrect email or password')) {
          isWrongCredentials = true;
          errorMessage = "Incorrect email or password. Please check your credentials and try again.";
        } else {
          // If it's not an account type error but contains detail, use that as the error message
          errorMessage = detail;
        }
      }
      
      // If no account type error was detected yet, check other places
      if (!isWrongAccountType && !isWrongCredentials) {
        // Check for specific account type error patterns
        if (error.response) {
          console.log('Error response status:', error.response.status);
          console.log('Error response data:', error.response.data);
          console.log('Error response headers:', error.response.headers);
          
          // Check if this is a credentials error (401 status)
          if (error.response.status === 401) {
            // First check if it's an account type issue
            if (error.response.headers && error.response.headers['x-account-type']) {
              isWrongAccountType = true;
              detectedAccountType = error.response.headers['x-account-type'];
              
              if (detectedAccountType === 'employer') {
                errorMessage = "This email is registered as an EMPLOYER account. Please select 'Employer' account type.";
                setCorrectAccountType('employer');
              } else if (detectedAccountType === 'alumni') {
                errorMessage = "This email is registered as an ALUMNI/STUDENT account. Please select 'Alumni / Student' account type.";
                setCorrectAccountType('alumni');
              }
            } 
            // If not an account type issue, it's likely wrong credentials
            else if (error.response.data && 
                    (error.response.data.detail === "Incorrect email or password" || 
                      typeof error.response.data === 'string' && error.response.data.includes("Incorrect email or password"))) {
              isWrongCredentials = true;
              errorMessage = "Incorrect email or password. Please check your credentials and try again.";
            }
          }
          
          // Check various possible error message locations
          if (error.response.data && !isWrongAccountType && !isWrongCredentials) {
            if (typeof error.response.data === 'string') {
              // Check if string contains account type mismatch patterns
              const { isAccountType, correctType } = checkAccountTypeMismatch(error.response.data);
              if (isAccountType) {
                isWrongAccountType = true;
                detectedAccountType = correctType;
                setCorrectAccountType(correctType);
                errorMessage = correctType === 'alumni' 
                  ? "This email is registered as an ALUMNI/STUDENT account. Please select 'Alumni / Student' account type."
                  : "This email is registered as an EMPLOYER account. Please select 'Employer' account type.";
              } else {
                errorMessage = error.response.data;
              }
            } else if (error.response.data.message) {
              // Check if message contains account type mismatch patterns
              const { isAccountType, correctType } = checkAccountTypeMismatch(error.response.data.message);
              if (isAccountType) {
                isWrongAccountType = true;
                detectedAccountType = correctType;
                setCorrectAccountType(correctType);
                errorMessage = correctType === 'alumni' 
                  ? "This email is registered as an ALUMNI/STUDENT account. Please select 'Alumni / Student' account type."
                  : "This email is registered as an EMPLOYER account. Please select 'Employer' account type.";
              } else {
                errorMessage = error.response.data.message;
              }
            } else if (error.response.data.error) {
              // Check if error contains account type mismatch patterns
              const { isAccountType, correctType } = checkAccountTypeMismatch(error.response.data.error);
              if (isAccountType) {
                isWrongAccountType = true;
                detectedAccountType = correctType;
                setCorrectAccountType(correctType);
                errorMessage = correctType === 'alumni' 
                  ? "This email is registered as an ALUMNI/STUDENT account. Please select 'Alumni / Student' account type."
                  : "This email is registered as an EMPLOYER account. Please select 'Employer' account type.";
              } else {
                errorMessage = error.response.data.error;
              }
            }
          }
        }
      }
      
      // If the error is a manually created Error with message, use that message
      if (error.message && !isWrongAccountType && !isWrongCredentials) {
        // Check if message contains account type mismatch patterns
        const { isAccountType, correctType } = checkAccountTypeMismatch(error.message);
        if (isAccountType) {
          isWrongAccountType = true;
          detectedAccountType = correctType;
          setCorrectAccountType(correctType);
          errorMessage = correctType === 'alumni' 
            ? "This email is registered as an ALUMNI/STUDENT account. Please select 'Alumni / Student' account type."
            : "This email is registered as an EMPLOYER account. Please select 'Employer' account type.";
        } else if (error.message.includes('Incorrect email or password')) {
          isWrongCredentials = true;
        }
        if (!isWrongAccountType) {
          errorMessage = error.message;
        }
      }
      
      // If the AuthContext has an error message, use that
      if (authError && !isWrongAccountType && !isWrongCredentials) {
        // Check if authError contains account type mismatch patterns
        const { isAccountType, correctType } = checkAccountTypeMismatch(authError);
        if (isAccountType) {
          isWrongAccountType = true;
          detectedAccountType = correctType;
          setCorrectAccountType(correctType);
          errorMessage = correctType === 'alumni' 
            ? "This email is registered as an ALUMNI/STUDENT account. Please select 'Alumni / Student' account type."
            : "This email is registered as an EMPLOYER account. Please select 'Employer' account type.";
        } else if (authError.includes('Incorrect email or password')) {
          isWrongCredentials = true;
        }
        if (!isWrongAccountType) {
          errorMessage = authError;
        }
      }
      
      // Handle specific error types
      if (error.message === 'Network Error') {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      }
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'The request timed out. Please try again later.';
      }
      
      // FALLBACK: If nothing else detected the account type error, but the URL indicates
      // we tried the wrong endpoint, infer from that
      if (!isWrongAccountType && !isWrongCredentials && error.config && error.config.url) {
        if (values.userType === 'employer' && error.config.url.includes('/employers/login') && error.response?.status === 401) {
          console.log("FALLBACK: 401 on employer login endpoint - assuming account type error");
          isWrongAccountType = true;
          detectedAccountType = 'alumni';
          setCorrectAccountType('alumni');
          errorMessage = "This email is registered as an ALUMNI/STUDENT account. Please select 'Alumni / Student' account type.";
        } else if (values.userType === 'alumni' && error.config.url.includes('/auth/login') && error.response?.status === 401) {
          console.log("FALLBACK: 401 on alumni login endpoint - assuming account type error");
          isWrongAccountType = true;
          detectedAccountType = 'employer';
          setCorrectAccountType('employer');
          errorMessage = "This email is registered as an EMPLOYER account. Please select 'Employer' account type.";
        }
      }
      
      console.log('Setting error states - isAccountTypeError:', isWrongAccountType, 
                  'correctAccountType:', correctAccountType, 
                  'isCredentialsError:', isWrongCredentials,
                  'errorMessage:', errorMessage);
                  
      setIsAccountTypeError(isWrongAccountType);
      setIsCredentialsError(isWrongCredentials);
      setGeneralError(errorMessage);
      
      // Auto-switch to correct account type if detected
      if (correctAccountType && correctAccountType !== values.userType) {
        setTimeout(() => {
          setFieldValue('userType', correctAccountType);
        }, 100);
      }
      
    } finally {
      setIsLoading(false);
      setSubmitting(false);
    }
  };

  // Function to get style classes for account type selection
  const getAccountTypeButtonClass = (type, currentValue) => {
    const baseClass = "flex-1 py-2 px-4 text-center border rounded";
    
    // When there's an account type error and this is the correct type, highlight it
    if (isAccountTypeError && correctAccountType === type) {
      return `${baseClass} bg-yellow-100 border-2 border-yellow-500 text-yellow-800 font-bold`;
    }
    
    // Normal selected/unselected styling
    return currentValue === type 
      ? `${baseClass} bg-cvsu-green text-white font-medium`
      : `${baseClass} bg-white text-gray-700 hover:bg-gray-50`;
  };

  // Function to get error box style based on error type
  const getErrorBoxStyle = () => {
    if (isAccountTypeError) {
      return "bg-yellow-100 border border-yellow-400 shadow-md";
    } else if (isCredentialsError) {
      return "bg-red-50 border border-red-400";
    } else {
      return "bg-red-50";
    }
  };

  // Function to get error icon style based on error type
  const getErrorIconStyle = () => {
    if (isAccountTypeError) {
      return "text-yellow-400";
    } else if (isCredentialsError) {
      return "text-red-500";
    } else {
      return "text-red-400";
    }
  };

  // Function to get error header style and text
  const getErrorHeaderStyle = () => {
    if (isAccountTypeError) {
      return "text-yellow-800";
    } else if (isCredentialsError) {
      return "text-red-800";
    } else {
      return "text-red-800";
    }
  };

  const getErrorHeaderText = () => {
    if (isAccountTypeError) {
      return "Wrong Account Type!";
    } else if (isCredentialsError) {
      return "Authentication Failed";
    } else {
      return "Error";
    }
  };

  // Function to get error text style
  const getErrorTextStyle = () => {
    if (isAccountTypeError) {
      return "text-yellow-700";
    } else if (isCredentialsError) {
      return "text-red-700";
    } else {
      return "text-red-700";
    }
  };

  // Create a more prominent error message for account type errors
  const renderErrorMessage = () => {
    if (!generalError) return null;

    if (isAccountTypeError) {
      return (
        <div className="rounded-md p-4 mb-6 bg-yellow-100 border border-yellow-400">
          <div className="flex items-start">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="h-5 w-5 text-yellow-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-base font-semibold text-yellow-800">
                Wrong Account Type!
              </h3>
              <div className="mt-2">
                <p className="text-sm text-yellow-700">
                  This email is registered as an {correctAccountType === 'employer' ? 'EMPLOYER' : 'ALUMNI/STUDENT'} account. Please select '{correctAccountType === 'employer' ? 'Employer' : 'Alumni / Student'}' account type.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`rounded-md p-4 mb-4 ${getErrorBoxStyle()}`}>
        <div className="flex">
          <div className={`flex-shrink-0 ${getErrorIconStyle()}`}>
            {isCredentialsError ? (
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="ml-3">
            <h3 className={`text-sm font-medium ${getErrorHeaderStyle()}`}>
              {getErrorHeaderText()}
            </h3>
            <div className={`mt-2 text-sm ${getErrorTextStyle()}`}>
              <p>{generalError}</p>
              {isCredentialsError && (
                <p className="mt-2">
                  Double-check your email and password and try again. If you've forgotten your password, use the "Forgot your password?" link below.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
          {renderErrorMessage()}
          
          <Formik
            initialValues={{ email: '', password: '', userType: 'alumni' }}
            validationSchema={LoginSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting, errors, touched, values, setFieldValue }) => (
              <Form className="space-y-6">
                <div>
                  <label htmlFor="userType" className="block text-sm font-medium text-gray-700 mb-1">
                    Account Type
                  </label>
                  <div className="flex space-x-2 mb-4">
                    <button
                      type="button"
                      className={getAccountTypeButtonClass('alumni', values.userType)}
                      onClick={() => {
                        setFieldValue('userType', 'alumni');
                        // Clear errors when changing account type
                        setIsAccountTypeError(false);
                        setIsCredentialsError(false);
                        setGeneralError('');
                      }}
                    >
                      Alumni / Student
                    </button>
                    <button
                      type="button"
                      className={getAccountTypeButtonClass('employer', values.userType)}
                      onClick={() => {
                        setFieldValue('userType', 'employer');
                        // Clear errors when changing account type
                        setIsAccountTypeError(false);
                        setIsCredentialsError(false);
                        setGeneralError('');
                      }}
                    >
                      Employer
                    </button>
                  </div>
                  <Field type="hidden" name="userType" />
                </div>
                
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
                        errors.email && touched.email ? 'border-red-500' : isCredentialsError ? 'border-red-500 bg-red-50' : ''
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
                        errors.password && touched.password ? 'border-red-500' : isCredentialsError ? 'border-red-500 bg-red-50' : ''
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
                      id="remember_me"
                      name="remember_me"
                      type="checkbox"
                      className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                    />
                    <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-900">
                      Remember me
                    </label>
                  </div>

                  <div className="text-sm">
                    <Link to="/reset-password" className="font-medium text-cvsu-green hover:text-green-700">
                      Forgot your password?
                    </Link>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      isSubmitting || isLoading
                        ? 'bg-green-400 cursor-not-allowed'
                        : 'bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green'
                    }`}
                  >
                    {isSubmitting || isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </div>
              </Form>
            )}
          </Formik>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Don't have an account?
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div>
                <Link
                  to="/register"
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Alumni Register
                </Link>
              </div>
              <div>
                <Link
                  to="/employer/register"
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Employer Register
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 