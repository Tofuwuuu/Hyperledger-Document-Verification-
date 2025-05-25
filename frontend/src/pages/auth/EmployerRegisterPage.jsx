import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import cvsuLogo from '../../assets/cvsu-logo.png';

// Industry options
const industryOptions = [
  'Information Technology',
  'Healthcare',
  'Education',
  'Finance',
  'Manufacturing',
  'Retail',
  'Agriculture',
  'Construction',
  'Transportation',
  'Hospitality',
  'Other'
];

// Validation schema for employer registration
const EmployerRegisterSchema = Yup.object().shape({
  company_name: Yup.string()
    .required('Company name is required')
    .min(2, 'Company name is too short'),
  industry: Yup.string()
    .required('Industry is required'),
  contact_person: Yup.string()
    .required('Contact person name is required')
    .min(2, 'Contact person name is too short'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  phone: Yup.string()
    .required('Phone number is required')
    .matches(/^[0-9+\- ]+$/, 'Phone number must contain only numbers, +, -, and spaces'),
  website: Yup.string()
    .url('Please enter a valid URL'),
  address: Yup.string()
    .required('Address is required'),
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

export default function EmployerRegisterPage() {
  const { registerEmployer } = useAuth();
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (values, { setSubmitting }) => {
    setGeneralError('');
    setIsLoading(true);
    
    // Format website properly - either valid URL or undefined
    let website = values.website;
    if (!website || website.trim() === '') {
      website = undefined; // Set to undefined if empty
    } else if (!website.startsWith('http://') && !website.startsWith('https://')) {
      website = `https://${website}`; // Add https:// if missing
    }
    
    const employerData = {
      email: values.email,
      company_name: values.company_name,
      industry: values.industry,
      contact_person: values.contact_person,
      phone: values.phone,
      website: website, // Use the formatted website
      address: values.address,
      password: values.password,
      confirm_password: values.confirmPassword
    };
    
    try {
      await registerEmployer(employerData);
      setRegistrationSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('Employer registration failed:', error);
      
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col py-12 sm:px-6 lg:px-8">
      <div className="mb-6 ml-4">
        <Link 
          to="/register" 
          className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Register as an Alumni
        </Link>
      </div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img
          className="mx-auto h-16 w-auto"
          src={cvsuLogo}
          alt="CVSU Logo"
        />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Register as an Employer
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
                    <p>Your employer account has been created. You will be redirected to the login page shortly.</p>
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
                  company_name: '',
                  industry: '',
                  contact_person: '',
                  email: '',
                  phone: '',
                  website: '',
                  address: '',
                  password: '',
                  confirmPassword: '',
                  terms: false
                }}
                validationSchema={EmployerRegisterSchema}
                onSubmit={handleSubmit}
              >
                {({ isSubmitting, errors, touched }) => (
                  <Form className="space-y-6">
                    <div>
                      <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                        Company Name
                      </label>
                      <div className="mt-1">
                        <Field
                          id="company_name"
                          name="company_name"
                          type="text"
                          className={`form-input ${
                            errors.company_name && touched.company_name ? 'border-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="company_name"
                          component="p"
                          className="mt-2 text-sm text-red-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
                        Industry
                      </label>
                      <div className="mt-1">
                        <Field
                          id="industry"
                          name="industry"
                          as="select"
                          className={`form-input ${
                            errors.industry && touched.industry ? 'border-red-500' : ''
                          }`}
                        >
                          <option value="">Select an industry</option>
                          {industryOptions.map(industry => (
                            <option key={industry} value={industry}>
                              {industry}
                            </option>
                          ))}
                        </Field>
                        <ErrorMessage
                          name="industry"
                          component="p"
                          className="mt-2 text-sm text-red-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="contact_person" className="block text-sm font-medium text-gray-700">
                        Contact Person Name
                      </label>
                      <div className="mt-1">
                        <Field
                          id="contact_person"
                          name="contact_person"
                          type="text"
                          className={`form-input ${
                            errors.contact_person && touched.contact_person ? 'border-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="contact_person"
                          component="p"
                          className="mt-2 text-sm text-red-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email Address
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
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                        Phone Number
                      </label>
                      <div className="mt-1">
                        <Field
                          id="phone"
                          name="phone"
                          type="text"
                          className={`form-input ${
                            errors.phone && touched.phone ? 'border-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="phone"
                          component="p"
                          className="mt-2 text-sm text-red-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                        Website (Optional)
                      </label>
                      <div className="mt-1">
                        <Field
                          id="website"
                          name="website"
                          type="url"
                          placeholder="https://example.com"
                          className={`form-input ${
                            errors.website && touched.website ? 'border-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="website"
                          component="p"
                          className="mt-2 text-sm text-red-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                        Business Address
                      </label>
                      <div className="mt-1">
                        <Field
                          id="address"
                          name="address"
                          as="textarea"
                          rows={2}
                          className={`form-input ${
                            errors.address && touched.address ? 'border-red-500' : ''
                          }`}
                        />
                        <ErrorMessage
                          name="address"
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

                    <div className="flex items-center">
                      <Field
                        id="terms"
                        name="terms"
                        type="checkbox"
                        className={`h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded ${
                          errors.terms && touched.terms ? 'border-red-500' : ''
                        }`}
                      />
                      <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                        I agree to the{' '}
                        <a href="#" className="font-medium text-cvsu-green hover:text-green-700">
                          terms and conditions
                        </a>
                      </label>
                    </div>
                    <ErrorMessage
                      name="terms"
                      component="p"
                      className="mt-2 text-sm text-red-600"
                    />

                    <div>
                      <button
                        type="submit"
                        disabled={isSubmitting || isLoading}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        {isLoading ? (
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : 'Register as Employer'}
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