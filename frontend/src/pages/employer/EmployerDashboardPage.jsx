import { useAuth } from '../../context/AuthContext';
import { BuildingOffice2Icon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../services/api';
import { formatDateTimePhilippines } from '../../utils/dateUtils';

export default function EmployerDashboardPage() {
  const { currentUser } = useAuth();
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchEmployerData();
  }, []);
  
  const fetchEmployerData = async () => {
    try {
      setLoading(true);

      // We don't have a specific verification endpoint for employers yet, but
      // in a real implementation we would fetch employer-specific data here
      // For now, just end the loading state after a brief delay to simulate a fetch
      setTimeout(() => {
        setVerifications([
          {
            id: '1',
            document_type: 'Transcript of Records',
            verified_on: new Date().toISOString(),
            status: 'verified'
          },
          {
            id: '2',
            document_type: 'Certificate of Graduation',
            verified_on: new Date(Date.now() - 86400000).toISOString(), // yesterday
            status: 'verified'
          }
        ]);
        setLoading(false);
      }, 500);
      
    } catch (error) {
      console.error('Error fetching employer data:', error);
      setLoading(false);
    }
  };
  
  const formatDate = (dateString) => {
    return formatDateTimePhilippines(dateString);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Employer Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Welcome, {currentUser?.company_name || currentUser?.contact_person || 'Employer'}! Verify alumni credentials and documents.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
        {/* Company Profile Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-cvsu-green rounded-md p-3">
                <BuildingOffice2Icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Company Profile</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {currentUser?.company_name || 'Update your company profile'}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-5">
              <Link
                to="/employer/profile"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-cvsu-green/90"
              >
                View Profile
              </Link>
            </div>
          </div>
        </div>

        {/* Verification Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-cvsu-green rounded-md p-3">
                <DocumentMagnifyingGlassIcon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Verify Alumni Credentials</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      Check document authenticity
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-5">
              <Link
                to="/employer/verifications"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-cvsu-green/90"
              >
                Verify Documents
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Recent Verifications</h2>
        <div className="mt-2 bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {loading ? (
              <li>
                <div className="px-4 py-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-cvsu-green"></div>
                  <span className="ml-2 text-sm text-gray-500">Loading verifications...</span>
                </div>
              </li>
            ) : verifications && verifications.length > 0 ? (
              verifications.map((verification, index) => (
                <li key={index}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-cvsu-green truncate">
                        {verification.document_type}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${verification.status === 'verified' ? 'bg-blue-100 text-blue-800' : ''}
                          ${verification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${verification.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                        `}>
                          {verification.status.charAt(0).toUpperCase() + verification.status.slice(1)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          Document verification completed
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <p>
                          {formatDate(verification.verified_on)}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li>
                <div className="px-4 py-4 text-center text-gray-500">
                  No recent verifications found
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
} 