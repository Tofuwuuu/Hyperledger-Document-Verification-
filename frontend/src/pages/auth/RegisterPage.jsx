import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import cvsuLogo from '../../assets/cvsu-logo.png';

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
    .min(1970, 'Graduation year must be after 1970')
    .max(new Date().getFullYear(), 'Graduation year cannot be in the future'),
  password: Yup.string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: Yup.string()
    .required('Please confirm your password')
    .oneOf([Yup.ref('password'), null], 'Passwords must match'),
  terms: Yup.boolean()
    .required('Terms must be accepted')
    .oneOf([true], 'You must accept the terms and conditions'),
});

export default function RegisterPage() {
  const { register } = useAuth();
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (values, { setSubmitting }) => {
    setGeneralError('');
    setIsLoading(true);
    
    const userData = {
      email: values.email,
      full_name: values.full_name,
      password: values.password,
      confirm_password: values.confirmPassword,
      student_id: values.student_id,
      graduation_year: parseInt(values.graduation_year),
      is_active: true,
      is_admin: false
    };
    
    try {
      await register(userData);
      setRegistrationSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('Registration failed:', error);
      
      // Display the exact error message from the backend
      if (error.response?.data?.detail) {
        setGeneralError(error.response.data.detail);
      } else {
        setGeneralError('Failed to register. Please check your information and try again.');
      }
    } finally {
      setIsLoading(false);
      setSubmitting(false);
    }
  };

  // Generate graduation year options
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let year = currentYear; year >= 1970; year--) {
    yearOptions.push(year);
  }

  // Toggle terms modal
  const toggleTermsModal = () => {
    setShowTermsModal(!showTermsModal);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      {/* Employer Registration Button */}
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Link 
          to="/employer/register" 
          className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Register as an Employer
        </Link>
      </div>
      
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
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
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
                  graduation_year: currentYear, 
                  password: '', 
                  confirmPassword: '',
                  terms: false
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
                          as="select"
                          className={`form-input ${
                            errors.graduation_year && touched.graduation_year ? 'border-red-500' : ''
                          }`}
                        >
                          {yearOptions.map(year => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </Field>
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
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5">
                          <Field
                            id="terms"
                            name="terms"
                            type="checkbox"
                            className={`h-5 w-5 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded ${
                              errors.terms && touched.terms ? 'border-red-500' : ''
                            }`}
                          />
                        </div>
                        <div className="ml-3">
                          <button 
                            type="button" 
                            onClick={toggleTermsModal} 
                            className="text-gray-700 hover:text-gray-900"
                          >
                            <span>I agree to the </span>
                            <span className="font-medium text-cvsu-green hover:text-green-700">Terms and Conditions</span>
                          </button>
                          
                          {errors.terms && touched.terms && (
                            <p className="mt-2 text-sm text-red-600">
                              You must accept the terms and conditions
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={isSubmitting || isLoading}
                        className="btn-primary w-full flex justify-center py-3 mt-6"
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

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl max-h-[80vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-medium text-gray-900">Terms and Conditions & Data Privacy Notice</h3>
              <button
                type="button"
                onClick={toggleTermsModal}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mt-4 space-y-6 text-sm text-gray-500">
              <div>
                <h4 className="font-bold text-gray-700 mb-2">Terms and Conditions</h4>
                <p>By registering for an account on the CvSU Alumni System, you agree to the following terms:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>You are a legitimate graduate or alumni of Cavite State University.</li>
                  <li>All information provided during registration and profile creation is accurate and truthful.</li>
                  <li>You will not share your account credentials with others or allow unauthorized access.</li>
                  <li>You will use the system in accordance with its intended purpose and comply with all applicable laws and regulations.</li>
                  <li>The university reserves the right to verify your alumni status and may disable accounts found to be in violation of these terms.</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-700 mb-2">Data Privacy Notice (In compliance with RA 10173)</h4>
                <p>Cavite State University values your privacy and is committed to protecting your personal information in accordance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173). By providing your information, you consent to the collection, use, storage, and processing of your personal data for the following purposes:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Alumni verification and authentication</li>
                  <li>Communication of university events, programs, and opportunities</li>
                  <li>Processing of document requests and alumni services</li>
                  <li>Compiling statistics and conducting research to improve services</li>
                  <li>Career development and networking opportunities</li>
                  <li>Other legitimate purposes related to alumni relations</li>
                </ul>
                
                <p className="mt-3">Your personal information will be kept secure and confidential. You have the right to:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Be informed about the processing of your personal data</li>
                  <li>Access your personal information in our records</li>
                  <li>Object to the processing of your personal data</li>
                  <li>Rectify inaccuracies in your personal information</li>
                  <li>Erasure or blocking of your personal information</li>
                  <li>Be indemnified for damages due to inaccurate or unauthorized use of your personal information</li>
                  <li>Data portability</li>
                </ul>
                
                <p className="mt-3">For inquiries or concerns regarding your data privacy rights, please contact our Data Privacy Officer at privacy@cvsu.edu.ph.</p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={toggleTermsModal}
                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-cvsu-green rounded-md hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 