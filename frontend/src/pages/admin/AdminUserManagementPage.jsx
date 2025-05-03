import { useState, useEffect, useRef } from 'react';
import { adminUserService } from '../../services/api';
import { PlusIcon, PencilIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export default function AdminUserManagementPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Pagination states
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  
  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    role_id: '',
    is_active: true,
    is_admin: true
  });
  
  // Add a refresh flag state
  const [refresh, setRefresh] = useState(0);
  
  // Request cancellation refs
  const abortControllersRef = useRef({});
  
  useEffect(() => {
    // Create abort controllers for our API requests
    abortControllersRef.current.users = new AbortController();
    abortControllersRef.current.roles = new AbortController();
    
    fetchUsers();
    fetchRoles();
    
    // Clean up function - cancel any in-flight requests when component unmounts
    return () => {
      Object.values(abortControllersRef.current).forEach(controller => {
        if (controller) controller.abort();
      });
    };
  }, [refresh, pagination.page, pagination.limit]); // Add pagination as dependencies
  
  // Function to trigger a refresh
  const triggerRefresh = () => {
    setRefresh(prev => prev + 1);
  };
  
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Cancel previous request if it exists
      if (abortControllersRef.current.users) {
        abortControllersRef.current.users.abort();
      }
      
      // Create a new controller
      abortControllersRef.current.users = new AbortController();
      
      const response = await adminUserService.getAllAdminUsers(
        pagination.page, 
        pagination.limit,
        abortControllersRef.current.users.signal
      );
      
      if (!response || !response.data) {
        console.log('Empty or invalid response received');
        setUsers([]);
        return;
      }
      
      // Safely extract users from the response
      const usersData = response.data.items || response.data || [];
      setUsers(Array.isArray(usersData) ? usersData : []);
      
      // Update pagination info if it's available in the response
      if (response.data.meta) {
        setPagination(prev => ({
          ...prev,
          total: response.data.meta.total || 0,
          totalPages: response.data.meta.totalPages || 0
        }));
      }
    } catch (err) {
      // Only set error if it's not an abort/cancel error
      if (err.name !== 'AbortError' && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        console.error('Error fetching admin users:', err);
        setError('Failed to load admin users. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const fetchRoles = async () => {
    try {
      // Cancel previous request if it exists
      if (abortControllersRef.current.roles) {
        abortControllersRef.current.roles.abort();
      }
      
      // Create a new controller
      abortControllersRef.current.roles = new AbortController();
      
      const response = await adminUserService.getRoles(
        abortControllersRef.current.roles.signal
      );
      
      // Ensure roles is always an array
      const rolesData = response.data?.items || response.data || [];
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch (err) {
      // Only log error if it's not an abort error
      if (err.name !== 'AbortError') {
        // Silently handle errors
        setRoles([]); // Set roles to empty array on error
      }
    }
  };
  
  // Pagination handlers
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      setPagination(prev => ({...prev, page: newPage}));
    }
  };
  
  const handleLimitChange = (e) => {
    const newLimit = parseInt(e.target.value);
    setPagination(prev => ({...prev, page: 1, limit: newLimit}));
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      console.log('Submitting user data:', formData);
      
      // First make the API call
      const response = await adminUserService.createAdminUser(formData);
      
      // Then update UI with the actual data from response
      const newUser = response.data;
      setUsers(prevUsers => [...prevUsers, newUser]);
      setIsAddUserModalOpen(false);
      resetForm();
      
      // Also refresh to ensure we have the latest data
      fetchUsers();
    } catch (err) {
      console.error('Error creating admin user:', err);
      // Log more detailed error information
      if (err.response) {
        console.error('Error response status:', err.response.status);
        console.error('Error details:', err.response.data);
        
        // Format validation errors properly
        if (err.response.status === 422 && err.response.data.detail) {
          // Handle pydantic validation errors
          if (Array.isArray(err.response.data.detail)) {
            const errorMessages = err.response.data.detail.map(error => 
              `${error.loc[1]}: ${error.msg}`
            ).join(', ');
            setError(`Validation error: ${errorMessages}`);
          } else if (typeof err.response.data.detail === 'object') {
            // Handle other object-type errors
            setError(`Validation error: ${JSON.stringify(err.response.data.detail)}`);
          } else {
            // String errors
            setError(err.response.data.detail);
          }
          return;
        }
      }
      
      // Set a more descriptive error message from the response if available
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create admin user. Please check network connection and try again.';
      setError(typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage);
    }
  };
  
  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      console.log('Submitting user update data:', formData);
      
      // Optimistic UI update - update the user in state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === currentUser.id 
            ? { 
                ...user, 
                ...formData,
                role: Array.isArray(roles) ? roles.find(r => r.id === formData.role_id)?.name || 'Unknown' : 'Unknown'
              } 
            : user
        )
      );
      
      setIsEditUserModalOpen(false);
      resetForm();
      
      // Actual API call
      await adminUserService.updateAdminUser(currentUser.id, formData);
      
      // Fetch to ensure we have the latest data
      fetchUsers();
    } catch (err) {
      console.error('Error updating admin user:', err);
      // Log more detailed error information
      if (err.response) {
        console.error('Error response status:', err.response.status);
        console.error('Error details:', err.response.data);
        
        // Format validation errors properly
        if (err.response.status === 422 && err.response.data.detail) {
          // Handle pydantic validation errors
          if (Array.isArray(err.response.data.detail)) {
            const errorMessages = err.response.data.detail.map(error => 
              `${error.loc[1]}: ${error.msg}`
            ).join(', ');
            setError(`Validation error: ${errorMessages}`);
          } else if (typeof err.response.data.detail === 'object') {
            // Handle other object-type errors
            setError(`Validation error: ${JSON.stringify(err.response.data.detail)}`);
          } else {
            // String errors
            setError(err.response.data.detail);
          }
          // Undo optimistic update on validation error
          fetchUsers();
          return;
        }
      }
      
      // Set a more descriptive error message from the response if available
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update admin user. Please check network connection and try again.';
      setError(typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage);
      // Undo optimistic update on error
      fetchUsers();
    }
  };
  
  const handleDeleteUser = async () => {
    try {
      // Optimistic UI update - remove the user from state
      setUsers(prevUsers => prevUsers.filter(user => user.id !== currentUser.id));
      setIsDeleteModalOpen(false);
      setCurrentUser(null);
      
      // Actual API call
      await adminUserService.deleteAdminUser(currentUser.id);
      
      // No need to refresh if deletion was successful
    } catch (err) {
      console.error('Error deleting admin user:', err);
      setError(err.message || 'Failed to delete admin user. Please check network connection and try again.');
      // Undo optimistic update on error
      triggerRefresh();
    }
  };
  
  const openEditModal = (user) => {
    setCurrentUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      password: '', // Don't include the password when editing
      confirm_password: '',
      role_id: user.role_id,
      is_active: user.is_active,
      is_admin: true // Ensure is_admin is set to true for admin users
    });
    setIsEditUserModalOpen(true);
  };
  
  const openDeleteModal = (user) => {
    setCurrentUser(user);
    setIsDeleteModalOpen(true);
  };
  
  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
      role_id: '',
      is_active: true,
      is_admin: true
    });
    setCurrentUser(null);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Admin User Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage administrators and their access levels
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={() => setIsAddUserModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-cvsu-green px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Add Admin User
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Users Table */}
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Role
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {users.length === 0 ? (
                    <tr key="no-users-row">
                      <td colSpan="5" className="py-4 px-6 text-center text-sm text-gray-500">
                        No admin users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {user.full_name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {user.email}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {user.role || (Array.isArray(roles) && roles.find(role => role.id === user.role_id)?.name) || 'Unknown'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            user.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <PencilIcon className="h-5 w-5" aria-hidden="true" />
                            <span className="sr-only">Edit {user.full_name}</span>
                          </button>
                          <button
                            onClick={() => openDeleteModal(user)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" aria-hidden="true" />
                            <span className="sr-only">Delete {user.full_name}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Pagination Controls */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${pagination.page === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}
            className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${(pagination.page === pagination.totalPages || pagination.totalPages === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{users.length ? (pagination.page - 1) * pagination.limit + 1 : 0}</span> to{' '}
              <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-medium">{pagination.total}</span> results
            </p>
          </div>
          <div>
            <div className="inline-flex items-center mr-4">
              <label htmlFor="limit-select" className="mr-2 text-sm text-gray-700">Show:</label>
              <select
                id="limit-select"
                value={pagination.limit}
                onChange={handleLimitChange}
                className="rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className={`relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 ${pagination.page === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                <span className="sr-only">Previous</span>
                <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                // Calculate the page number to display
                let pageNum;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }
                
                return (
                  <button
                    key={`page-${pageNum}-${i}`}
                    onClick={() => handlePageChange(pageNum)}
                    className={`relative inline-flex items-center border px-4 py-2 text-sm font-medium ${
                      pagination.page === pageNum
                        ? 'z-10 bg-cvsu-green text-white border-cvsu-green'
                        : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}
                className={`relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 ${(pagination.page === pagination.totalPages || pagination.totalPages === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                <span className="sr-only">Next</span>
                <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>
      
      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Add Admin User</h3>
                <form onSubmit={handleAddUser} className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="full_name"
                        id="full_name"
                        required
                        value={formData.full_name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <input
                        type="password"
                        name="password"
                        id="password"
                        required
                        value={formData.password}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        name="confirm_password"
                        id="confirm_password"
                        required
                        value={formData.confirm_password}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="role_id" className="block text-sm font-medium text-gray-700">
                        Role
                      </label>
                      <select
                        id="role_id"
                        name="role_id"
                        required
                        value={formData.role_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      >
                        <option value="">Select a role</option>
                        {Array.isArray(roles) && roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="is_active"
                        name="is_active"
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={handleInputChange}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-cvsu-green px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
                    >
                      Add User
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddUserModalOpen(false)}
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit User Modal */}
      {isEditUserModalOpen && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Edit Admin User</h3>
                <form onSubmit={handleEditUser} className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="edit_full_name" className="block text-sm font-medium text-gray-700">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="full_name"
                        id="edit_full_name"
                        required
                        value={formData.full_name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit_email" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        id="edit_email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit_password" className="block text-sm font-medium text-gray-700">
                        Password (leave blank to keep current)
                      </label>
                      <input
                        type="password"
                        name="password"
                        id="edit_password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit_confirm_password" className="block text-sm font-medium text-gray-700">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        name="confirm_password"
                        id="edit_confirm_password"
                        value={formData.confirm_password}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit_role_id" className="block text-sm font-medium text-gray-700">
                        Role
                      </label>
                      <select
                        id="edit_role_id"
                        name="role_id"
                        required
                        value={formData.role_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      >
                        <option value="">Select a role</option>
                        {Array.isArray(roles) && roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="edit_is_active"
                        name="is_active"
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={handleInputChange}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <label htmlFor="edit_is_active" className="ml-2 block text-sm text-gray-900">
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-cvsu-green px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditUserModalOpen(false)}
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <TrashIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Delete Admin User</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete {currentUser?.full_name}? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 