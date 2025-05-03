import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, AcademicCapIcon, PlusIcon } from '@heroicons/react/24/outline';
import { alumniService } from '../../services/api';

export default function AdminAlumniPage() {
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [totalAlumni, setTotalAlumni] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20; // Show more alumni per page in admin view

  useEffect(() => {
    fetchAlumni();
  }, [page, selectedProgram, selectedYear, selectedDepartment]);

  // Fetch alumni with search parameters
  const fetchAlumni = async () => {
    setLoading(true);
    try {
      const params = {
        limit,
        offset: page * limit,
      };
      
      if (searchTerm) {
        params.name = searchTerm;
      }
      
      if (selectedProgram) {
        params.course = selectedProgram;
      }
      
      if (selectedYear) {
        params.graduation_year = parseInt(selectedYear);
      }
      
      if (selectedDepartment) {
        params.department = selectedDepartment;
      }
      
      const response = await alumniService.getAllAlumni(params);
      setAlumni(response.data.results);
      setTotalAlumni(response.data.total);
    } catch (error) {
      console.error('Error fetching alumni:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle search button click
  const handleSearch = () => {
    setPage(0); // Reset to first page
    fetchAlumni();
  };
  
  // Handle enter key in search box
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Extract unique programs, departments and years from alumni data
  const programs = [...new Set(alumni.map(a => a.course))].filter(Boolean);
  const departments = [...new Set(alumni.map(a => a.department))].filter(Boolean);
  const years = [...new Set(alumni.map(a => a.graduation_year))].sort((a, b) => b - a);

  // Calculate number of pages
  const totalPages = Math.ceil(totalAlumni / limit);

  const getProfileImageUrl = (profilePicture) => {
    if (!profilePicture) {
      return '/placeholder-profile.png';
    }
    
    // If path starts with http, it's already a full URL
    if (profilePicture.startsWith('http')) {
      return profilePicture;
    }
    
    // Otherwise, it's a relative path to the server
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return `${baseUrl}/${profilePicture}`;
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Alumni Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            View, search, and manage all alumni records
          </p>
        </div>
        <Link
          to="/admin/alumni/add"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          Add New Alumni
        </Link>
      </div>

      {/* Search and filter section */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-2/5">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search Alumni
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                name="search"
                id="search"
                className="focus:ring-cvsu-green focus:border-cvsu-green block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                placeholder="Search by name, email, or ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
          <div className="w-full md:w-1/6">
            <label htmlFor="program" className="block text-sm font-medium text-gray-700">
              Program
            </label>
            <select
              id="program"
              name="program"
              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-cvsu-green focus:outline-none focus:ring-cvsu-green sm:text-sm"
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
            >
              <option value="">All Programs</option>
              {programs.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-1/6">
            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
              Department
            </label>
            <select
              id="department"
              name="department"
              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-cvsu-green focus:outline-none focus:ring-cvsu-green sm:text-sm"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-1/6">
            <label htmlFor="year" className="block text-sm font-medium text-gray-700">
              Graduation Year
            </label>
            <select
              id="year"
              name="year"
              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-cvsu-green focus:outline-none focus:ring-cvsu-green sm:text-sm"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">All Years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="w-full md:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
            onClick={handleSearch}
          >
            Search
          </button>
        </div>
        
        <div className="text-sm text-gray-500 mt-4">
          Showing {alumni.length} of {totalAlumni} alumni
        </div>
      </div>

      {/* Alumni table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
          </div>
        ) : alumni.length === 0 ? (
          <div className="text-center py-10 px-6">
            <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No alumni found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search filters to find alumni.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alumni
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Program
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Graduation Year
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alumni.map((alumnus) => (
                  <tr key={alumnus._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img 
                            className="h-10 w-10 rounded-full object-cover" 
                            src={getProfileImageUrl(alumnus.profile_picture)} 
                            alt={alumnus.full_name} 
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{alumnus.full_name}</div>
                          <div className="text-sm text-gray-500">{alumnus.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {alumnus.student_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {alumnus.course}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {alumnus.graduation_year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{alumnus.email}</div>
                      <div>{alumnus.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link 
                        to={`/alumni/${alumnus._id}`} 
                        className="text-cvsu-green hover:text-green-700 mr-4"
                      >
                        View
                      </Link>
                      <Link 
                        to={`/admin/alumni/edit/${alumnus._id}`} 
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{page * limit + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min((page + 1) * limit, totalAlumni)}
                  </span>{' '}
                  of <span className="font-medium">{totalAlumni}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                      page === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show at most 5 page buttons
                    let pageNum;
                    if (totalPages <= 5) {
                      // If 5 or fewer pages, show all
                      pageNum = i;
                    } else if (page < 3) {
                      // If near the start, show first 5 pages
                      pageNum = i;
                    } else if (page > totalPages - 3) {
                      // If near the end, show last 5 pages
                      pageNum = totalPages - 5 + i;
                    } else {
                      // Otherwise show 2 before and 2 after current page
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border ${
                          page === pageNum
                            ? 'z-10 bg-cvsu-green border-cvsu-green text-white'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        } text-sm font-medium`}
                      >
                        {pageNum + 1}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page === totalPages - 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                      page === totalPages - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 