import { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon, ArrowPathIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { adminUserService } from '../../services/api';

export default function AdminUserVerificationPage() {
  const [users, setUsers] = useState([]);
  const [viewMode, setViewMode] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionUserId, setActionUserId] = useState(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    loadUsers(viewMode);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [viewMode]);

  const loadUsers = async (status = viewMode) => {
    setLoading(true);
    setError(null);

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const response = await adminUserService.getPendingVerificationUsers(
        abortControllerRef.current.signal,
        status
      );
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.message || `Failed to load ${status === 'verified' ? 'verified' : 'pending'} users.`
      );
    } finally {
      setLoading(false);
    }
  };

  const removeUserFromList = (userId) => {
    setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
  };

  const handleVerify = async (userId) => {
    setActionUserId(userId);
    setError(null);

    try {
      await adminUserService.verifyPendingUser(userId);
      removeUserFromList(userId);
    } catch (err) {
      setError(err.message || 'Failed to verify user.');
    } finally {
      setActionUserId(null);
    }
  };

  const handleReject = async (userId) => {
    setActionUserId(userId);
    setError(null);

    try {
      await adminUserService.rejectPendingUser(userId);
      removeUserFromList(userId);
    } catch (err) {
      setError(err.message || 'Failed to reject user.');
    } finally {
      setActionUserId(null);
    }
  };

  const isVerifiedView = viewMode === 'verified';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">User Verification</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isVerifiedView
              ? 'Browse active accounts that have already been verified.'
              : 'Review active accounts that are still waiting for approval.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300">
            <button
              type="button"
              onClick={() => setViewMode('pending')}
              className={`px-4 py-2 text-sm font-medium ${
                !isVerifiedView
                  ? 'bg-cvsu-green text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Pending Users
            </button>
            <button
              type="button"
              onClick={() => setViewMode('verified')}
              className={`px-4 py-2 text-sm font-medium ${
                isVerifiedView
                  ? 'bg-cvsu-green text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Verified Users
            </button>
          </div>
          <button
            type="button"
            onClick={() => loadUsers(viewMode)}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ArrowPathIcon className="mr-2 h-5 w-5" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-black ring-opacity-5">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                  Full Name
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Email
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Student ID
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Graduation Year
                </th>
                <th className="py-3.5 pl-3 pr-4 text-right text-sm font-semibold text-gray-900 sm:pr-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-sm text-gray-500">
                    {isVerifiedView ? 'No verified users found.' : 'No pending users found.'}
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isWorking = actionUserId === user.id;

                  return (
                    <tr key={user.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {user.full_name || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {user.email || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {user.student_id || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {user.graduation_year || 'N/A'}
                      </td>
                      <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        {isVerifiedView ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                            <CheckCircleIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                            Verified
                          </span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleVerify(user.id)}
                              disabled={isWorking}
                              className="inline-flex items-center rounded-md bg-cvsu-green px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <CheckCircleIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(user.id)}
                              disabled={isWorking}
                              className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <XCircleIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
