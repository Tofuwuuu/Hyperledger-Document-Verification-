import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
// import cvsuLogo from '../../assets/cvsu-logo.png';

// Placeholder for the logo until the actual image is added
const cvsuLogo = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzM4YTM4OSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjIwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiPkNWU1U8L3RleHQ+PC9zdmc+';

// Validation schema
const RegisterSchema = Yup.object().shape({
  full_name: Yup.string()
    .required('Full name is required')
    .min(2, 'Name is too short'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  student_id: Yup.string()
    .required('Student ID is required')
    .matches(/^[0-9-]+$/, 'Student ID must contain only numbers and hyphens'),
  graduation_year: Yup.number()
    .required('Graduation year is required')
    .min(1948, 'Graduation year must be after 1948')
    .max(new Date().getFullYear(), 'Graduation year cannot be in the future'),
  password: Yup.string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: Yup.string()
    .required('Please confirm your password')
    .oneOf([Yup.ref('password'), null], 'Passwords must match'),
});

export default function RegisterPage() {
  const { register } = useAuth();
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (values, { setSubmitting, setFieldError }) => {
    setGeneralError('');
    setIsLoading(true);
    
    const userData = {
      email: values.email,
      full_name: values.full_name,
      student_id: values.student_id,
      graduation_year: Number(values.graduation_year),
      password: values.password,
      confirm_password: values.confirmPassword
    };
    
    try {
      console.log('Attempting to register with data:', userData);
      await register(userData);
      setRegistrationSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('Registration failed:', error);
      
      // Get field-specific errors if available
      if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
        // Set field-specific error messages
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          setFieldError(field, message);
        });
        
        // Set a more specific general error message based on field errors
        setGeneralError('Please correct the errors in the form to continue.');
      } else {
        // Fallback to general error message
        setGeneralError('Please check your information and ensure all fields are filled correctly.');
        
        // Handle validation errors for password fields
        if (error.message?.includes('password')) {
          setFieldError('password', 'Password validation failed');
          setFieldError('confirmPassword', 'Ensure passwords match exactly');
        }
      }
    } finally {
      setIsLoading(false);
      setSubmitting(false);
    }
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
          Register for an account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link to="/login" className="font-medium text-cvsu-green hover:text-green-700">
            sign in to your existing account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {registrationSuccess ? (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Registration successful!</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Your account has been created. You will be redirected to the login page shortly.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {generalError && (
                <div className="rounded-md bg-red-50 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">There were errors with your submission</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{generalError}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <Formik
                initialValues={{ 
                  full_name: '', 
                  email: '', 
                  student_id: '',
                  graduation_year: new Date().getFullYear(),
                  password: '', 
                  confirmPassword: '',
                }}
                validationSchema={RegisterSchema}
                onSubmit={handleSubmit}
              >
                {({ isSubmitting, errors, touched }) => (
                  <Form className="space-y-6">
                    <div>
                      <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                        Full Name
                      </label>
                      <div className="mt-1">
                        <Field
                          id="full_name"
                          name="full_name"
                          type="text"
                          autoComplete="name"
                          className={`form-input ${
                            errors.full_name && touched.full_name ? 'border-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="full_name"
                          component="p"
                          className="mt-2 text-sm text-red-600"
                        />
                      </div>
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
                      <label htmlFor="student_id" className="block text-sm font-medium text-gray-700">
                        Student ID
                      </label>
                      <div className="mt-1">
                        <Field
                          id="student_id"
                          name="student_id"
                          type="text"
                          className={`form-input ${
                            errors.student_id && touched.student_id ? 'border-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="student_id"
                          component="p"
                          className="mt-2 text-sm text-red-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="graduation_year" className="block text-sm font-medium text-gray-700">
                        Graduation Year
                      </label>
                      <div className="mt-1">
                        <Field
                          id="graduation_year"
                          name="graduation_year"
                          type="number"
                          inputMode="numeric"
                          className={`form-input ${
                            errors.graduation_year && touched.graduation_year ? 'border-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="graduation_year"
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
                          autoComplete="new-password"
                          className={`form-input ${
                            errors.password && touched.password ? 'border-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="password"
                          component="p"
                          className="mt-2 text-sm text-red-600"
                        />
                        {touched.password && !errors.password && (
                          <p className="mt-1 text-xs text-gray-500">
                            Password must have at least 6 characters.
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                        Confirm Password
                      </label>
                      <div className="mt-1">
                        <Field
                          id="confirmPassword"
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          className={`form-input ${
                            errors.confirmPassword && touched.confirmPassword ? 'border-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="confirmPassword"
                          component="p"
                          className="mt-2 text-sm text-red-600"
                        />
                        {touched.confirmPassword && touched.password && errors.confirmPassword && (
                          <div className="mt-1 p-2 bg-red-50 border border-red-100 rounded text-sm text-red-800">
                            <strong>Important:</strong> Passwords must match exactly. Please check both fields.
                          </div>
                        )}
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
                        ) : 'Register'}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 