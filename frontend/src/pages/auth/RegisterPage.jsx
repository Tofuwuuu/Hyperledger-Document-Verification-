import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import AuthShell from './AuthShell';

// Validation schema
const RegisterSchema = Yup.object().shape({
  fullName: Yup.string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (values, { setSubmitting, setFieldError }) => {
    setGeneralError('');
    setIsLoading(true);
    
    const userData = {
      full_name: values.fullName,
      email: values.email,
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
    <AuthShell
      title="Create your account"
      subtitle="Join the alumni portal with your active email address."
      switchText="Already registered?"
      switchTo="/login"
      switchLabel="Sign in"
      badgeText="Alumni registration"
    >
          {registrationSuccess ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex gap-3">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-green-800">Registration successful!</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Your account has been created. You will be redirected to the login page shortly.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {generalError && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex gap-3">
                    <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
                    <div>
                      <h3 className="text-sm font-semibold text-red-800">There were errors with your submission</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{generalError}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <Formik
                initialValues={{
                  fullName: '',
                  email: '', 
                  password: '', 
                  confirmPassword: '',
                }}
                validationSchema={RegisterSchema}
                onSubmit={handleSubmit}
              >
                {({ isSubmitting, errors, touched }) => (
                  <Form className="space-y-5">
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700">
                        Full Name
                      </label>
                      <div className="mt-1">
                        <Field
                          id="fullName"
                          name="fullName"
                          type="text"
                          autoComplete="name"
                          placeholder="Enter your full name"
                          className={`form-input ${
                            errors.fullName && touched.fullName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="fullName"
                          component="p"
                          className="mt-2 text-sm text-red-600"
                        />
                      </div>
                    </div>

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
                          autoComplete="new-password"
                          placeholder="Create a password"
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
                      {touched.password && !errors.password && (
                        <p className="mt-1 text-xs text-slate-500">
                          Password must have at least 6 characters.
                        </p>
                        )}
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700">
                        Confirm Password
                      </label>
                      <div className="relative mt-1">
                        <Field
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Re-enter your password"
                          className={`form-input pr-11 ${
                            errors.confirmPassword && touched.confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((current) => !current)}
                          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? (
                            <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <EyeIcon className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      <ErrorMessage
                        name="confirmPassword"
                        component="p"
                        className="mt-2 text-sm text-red-600"
                      />
                      {touched.confirmPassword && touched.password && errors.confirmPassword && (
                        <div className="mt-2 rounded-md border border-red-100 bg-red-50 p-2 text-sm text-red-800">
                          <strong>Important:</strong> Passwords must match exactly. Please check both fields.
                        </div>
                        )}
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
                            Create account
                            <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
                          </>
                        )}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </>
          )}
    </AuthShell>
  );
} 
