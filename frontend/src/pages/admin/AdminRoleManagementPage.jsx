import { useState, useEffect, useRef } from 'react';
import { roleService } from '../../services/api';
import { PlusIcon, PencilIcon, TrashIcon, ShieldCheckIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export default function AdminRoleManagementPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  
  // Pagination states
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true
  });
  
  // Permission selection state
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  
  // Add a refresh flag state
  const [refresh, setRefresh] = useState(0);
  
  // Request cancellation refs
  const abortControllersRef = useRef({});
  
  useEffect(() => {
    // Create abort controllers for our API requests
    abortControllersRef.current.roles = new AbortController();
    abortControllersRef.current.permissions = new AbortController();
    
    fetchRoles();
    fetchPermissions();
    
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
  
  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Cancel previous request if it exists
      if (abortControllersRef.current.roles) {
        abortControllersRef.current.roles.abort();
      }
      
      // Create a new controller
      abortControllersRef.current.roles = new AbortController();
      
      const response = await roleService.getAllRoles(
        pagination.page, 
        pagination.limit,
        abortControllersRef.current.roles.signal
      );
      
      setRoles(response.data.items || response.data);
      
      // Update pagination info if it's available in the response
      if (response.data.meta) {
        setPagination(prev => ({
          ...prev,
          total: response.data.meta.total,
          totalPages: response.data.meta.totalPages
        }));
      }
    } catch (err) {
      // Only set error if it's not an abort error
      if (err.name !== 'AbortError' && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        console.error('Error fetching roles:', err);
        
        // Improved error message with more detail
        if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
          // Just log the error, don't set it to state
          console.warn('Request timed out while loading roles. The server might be busy.');
        } else if (err.message.includes('Network Error')) {
          // Just log the error, don't set it to state
          console.warn('Network error while loading roles. Check your connection.');
        } else {
          // Quietly handle the error without showing to user
          console.warn('Failed to fetch roles, but continuing silently');
        }
        
        // Set empty roles array to prevent UI errors
        if (roles.length === 0) {
          setRoles([]);
        }
      }
    } finally {
      setLoading(false);
    }
  };
  
  const fetchPermissions = async () => {
    try {
      // Cancel previous request if it exists
      if (abortControllersRef.current.permissions) {
        abortControllersRef.current.permissions.abort();
      }
      
      // Create a new controller
      abortControllersRef.current.permissions = new AbortController();
      
      const response = await roleService.getPermissions(
        abortControllersRef.current.permissions.signal
      );
      
      setPermissions(response.data);
    } catch (err) {
      // Only log error if it's not an abort error
      if (err.name !== 'AbortError' && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        console.warn('Error fetching permissions:', err);
        // Set empty permissions array to prevent UI errors
        setPermissions([]);
      }
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const handleAddRole = async (e) => {
    e.preventDefault();
    try {
      // Optimistic UI update - add the new role to the state
      const tempRole = {
        ...formData,
        id: Date.now(), // Temporary ID until server response
        permissions: []
      };
      
      setRoles(prevRoles => [...prevRoles, tempRole]);
      setIsAddRoleModalOpen(false);
      resetForm();
      
      // Actual API call
      await roleService.createRole(formData);
      
      // Refresh data from server to get the real ID
      triggerRefresh();
    } catch (err) {
      console.error('Error creating role:', err);
      setError(err.message || 'Failed to create role. Please check network connection and try again.');
      // Undo optimistic update on error
      triggerRefresh();
    }
  };
  
  const handleEditRole = async (e) => {
    e.preventDefault();
    try {
      // Optimistic UI update - update the role in state
      setRoles(prevRoles => 
        prevRoles.map(role => 
          role.id === currentRole.id 
            ? { ...role, ...formData } 
            : role
        )
      );
      
      setIsEditRoleModalOpen(false);
      resetForm();
      
      // Actual API call
      await roleService.updateRole(currentRole.id, formData);
      
      // No need to refresh - optimistic update should be correct
      // But if you want server validation, uncomment the next line
      // triggerRefresh();
    } catch (err) {
      console.error('Error updating role:', err);
      setError(err.message || 'Failed to update role. Please check network connection and try again.');
      // Undo optimistic update on error
      triggerRefresh();
    }
  };
  
  const handleDeleteRole = async () => {
    try {
      // Optimistic UI update - remove the role from state
      setRoles(prevRoles => prevRoles.filter(role => role.id !== currentRole.id));
      setIsDeleteModalOpen(false);
      setCurrentRole(null);
      
      // Actual API call
      await roleService.deleteRole(currentRole.id);
      
      // No need to refresh if deletion was successful
    } catch (err) {
      console.error('Error deleting role:', err);
      setError(err.message || 'Failed to delete role. Please check network connection and try again.');
      // Undo optimistic update on error
      triggerRefresh();
    }
  };
  
  const handlePermissionChange = (permissionId) => {
    setSelectedPermissions(prevSelected => {
      if (prevSelected.includes(permissionId)) {
        return prevSelected.filter(id => id !== permissionId);
      } else {
        return [...prevSelected, permissionId];
      }
    });
  };
  
  const handleSavePermissions = async () => {
    try {
      // Save original role data in case we need to revert
      const originalRole = roles.find(r => r.id === currentRole.id);
      
      // Optimistic UI update
      setRoles(prevRoles => 
        prevRoles.map(role => {
          if (role.id === currentRole.id) {
            return {
              ...role,
              permissions: selectedPermissions.map(id => {
                const permission = permissions.find(p => p.id === id);
                return permission || { id };
              })
            };
          }
          return role;
        })
      );
      
      setIsPermissionModalOpen(false);
      
      // First, get current role's permissions
      const roleDetail = await roleService.getRole(currentRole.id);
      const currentPermissions = (roleDetail.data.permissions || []).map((permission) =>
        typeof permission === 'string' ? permission : permission.id
      );
      
      // Permissions to add
      const permissionsToAdd = selectedPermissions.filter(p => !currentPermissions.includes(p));
      
      // Permissions to remove
      const permissionsToRemove = currentPermissions.filter(p => !selectedPermissions.includes(p));
      
      // Add new permissions
      for (const permId of permissionsToAdd) {
        await roleService.assignPermission(currentRole.id, { permission_id: permId });
      }
      
      // Remove old permissions
      for (const permId of permissionsToRemove) {
        await roleService.removePermission(currentRole.id, permId);
      }
      
      // Refresh data from server to ensure all permission changes are reflected correctly
      triggerRefresh();
    } catch (err) {
      console.error('Error updating permissions:', err);
      setError(err.message || 'Failed to update permissions. Please check network connection and try again.');
      // Undo optimistic update on error
      triggerRefresh();
    }
  };
  
  const openEditModal = (role) => {
    setCurrentRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      is_active: role.is_active
    });
    setIsEditRoleModalOpen(true);
  };
  
  const openDeleteModal = (role) => {
    setCurrentRole(role);
    setIsDeleteModalOpen(true);
  };
  
  const openPermissionModal = async (role) => {
    setCurrentRole(role);
    try {
      const roleObjectId = role._id || role.id;
      const roleDetail = await roleService.getRole(roleObjectId);
      // Set selected permissions based on the role's current permissions
      setSelectedPermissions(
        (roleDetail.data.permissions || []).map((permission) =>
          typeof permission === 'string' ? permission : permission.id
        )
      );
      setIsPermissionModalOpen(true);
    } catch (err) {
      console.error('Error fetching role details:', err);
      setError('Failed to load role permissions');
    }
  };
  
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true
    });
    setCurrentRole(null);
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
          <h1 className="text-xl font-semibold text-gray-900">Role Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage roles and permissions for system administrators
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={() => setIsAddRoleModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-cvsu-green px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Add Role
          </button>
        </div>
      </div>
      
      {/* Error message */}
      {error && error.trim() !== '' && (
        <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex justify-between items-center">
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
            <button
              onClick={triggerRefresh}
              className="ml-4 bg-white py-1 px-3 border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Roles Table */}
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Role Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Description
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
                  {roles.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-4 px-6 text-center text-sm text-gray-500">
                        No roles found
                      </td>
                    </tr>
                  ) : (
                    roles.map((role) => (
                      <tr key={role.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {role.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {role.description || "No description"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            role.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {role.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => openPermissionModal(role)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            <ShieldCheckIcon className="h-5 w-5" aria-hidden="true" />
                            <span className="sr-only">Manage permissions for {role.name}</span>
                          </button>
                          <button
                            onClick={() => openEditModal(role)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <PencilIcon className="h-5 w-5" aria-hidden="true" />
                            <span className="sr-only">Edit {role.name}</span>
                          </button>
                          <button
                            onClick={() => openDeleteModal(role)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" aria-hidden="true" />
                            <span className="sr-only">Delete {role.name}</span>
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
              Showing <span className="font-medium">{roles.length ? (pagination.page - 1) * pagination.limit + 1 : 0}</span> to{' '}
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
                    key={i}
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
      
      {/* Add Role Modal */}
      {isAddRoleModalOpen && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Add Role</h3>
                <form onSubmit={handleAddRole} className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Role Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        name="description"
                        id="description"
                        rows={3}
                        value={formData.description}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
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
                      Add Role
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddRoleModalOpen(false)}
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
      
      {/* Edit Role Modal */}
      {isEditRoleModalOpen && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Edit Role</h3>
                <form onSubmit={handleEditRole} className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="edit_name" className="block text-sm font-medium text-gray-700">
                        Role Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="edit_name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit_description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        name="description"
                        id="edit_description"
                        rows={3}
                        value={formData.description}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                      />
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
                      onClick={() => setIsEditRoleModalOpen(false)}
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
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Delete Role</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete the "{currentRole?.name}" role? This action cannot be undone.
                    </p>
                    <p className="text-sm text-red-500 mt-2 font-medium">
                      Warning: Deleting this role will affect all users assigned to it.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleDeleteRole}
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
      
      {/* Permissions Modal */}
      {isPermissionModalOpen && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-xl sm:p-6 sm:align-middle">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <ShieldCheckIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    Manage Permissions for "{currentRole?.name}"
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Select the permissions that should be assigned to this role.
                    </p>
                  </div>
                </div>
                
                <div className="mt-5 max-h-60 overflow-y-auto">
                  <fieldset>
                    <legend className="sr-only">Permissions</legend>
                    <div className="space-y-2">
                      {permissions.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center">No permissions available</p>
                      ) : (
                        permissions.map((permission) => (
                          <div key={permission.id} className="relative flex items-start">
                            <div className="flex h-5 items-center">
                              <input
                                id={`permission-${permission.id}`}
                                name={`permission-${permission.id}`}
                                type="checkbox"
                                checked={selectedPermissions.includes(permission.id)}
                                onChange={() => handlePermissionChange(permission.id)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </div>
                            <div className="ml-3 text-sm">
                              <label htmlFor={`permission-${permission.id}`} className="font-medium text-gray-700">
                                {permission.name}
                              </label>
                              {permission.description && (
                                <p className="text-gray-500">{permission.description}</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </fieldset>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
                >
                  Save Permissions
                </button>
                <button
                  type="button"
                  onClick={() => setIsPermissionModalOpen(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
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
