import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, AcademicCapIcon } from '@heroicons/react/24/outline';
import { alumniService } from '../services/api';

export default function AlumniDirectoryPage() {
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [totalAlumni, setTotalAlumni] = useState(0);
  const [page, setPage] = useState(0);
  const [featuredAlumni, setFeaturedAlumni] = useState([]);
  const limit = 12;

  useEffect(() => {
    fetchAlumni();
    fetchFeaturedAlumni();
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
  
  // Fetch a small selection of featured alumni
  const fetchFeaturedAlumni = async () => {
    try {
      // Get 3 random alumni to feature
      const response = await alumniService.getAllAlumni({ limit: 3 });
      setFeaturedAlumni(response.data.results);
    } catch (error) {
      console.error('Error fetching featured alumni:', error);
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

  // Get profile image URL
  const getProfileImageUrl = (profilePicture) => {
    if (profilePicture) {
      // Parse the API URL to avoid path duplication
      let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      // Remove trailing slash if present
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      return `${baseUrl}/${profilePicture}`;
    }
    return 'https://via.placeholder.com/150?text=No+Image';
  };

  return (
    <div className="bg-white">
      {/* Hero section */}
      <div className="bg-cvsu-green py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Alumni Directory
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white">
            Connect with CVSU-Carmona graduates and build your professional network.
          </p>
        </div>
      </div>
      
      {/* Featured Alumni Section */}
      {featuredAlumni.length > 0 && (
        <div className="bg-gray-50 py-12">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl text-center mb-8">
              Featured Alumni
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredAlumni.map((alumnus) => (
                <div key={alumnus._id} className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex items-center space-x-4">
                    <img
                      src={getProfileImageUrl(alumnus.profile_picture)}
                      alt={alumnus.full_name}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        <Link to={`/alumni/${alumnus._id}`} className="hover:text-cvsu-green">
                          {alumnus.full_name}
                        </Link>
                      </h3>
                      <p className="text-sm text-gray-500">{alumnus.course}</p>
                      <p className="text-sm text-gray-500">Class of {alumnus.graduation_year}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link 
                      to={`/alumni/${alumnus._id}`}
                      className="text-cvsu-green hover:text-green-700 text-sm font-medium"
                    >
                      View Profile →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
          <div className="w-full md:w-1/2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search Alumni
            </label>
            <div className="relative mt-1 rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                name="search"
                id="search"
                className="block w-full rounded-md border-gray-300 pl-10 focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                placeholder="Search by name, student ID, or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
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
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
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
            className="mt-4 md:mt-0 w-full md:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
            onClick={handleSearch}
          >
            Search
          </button>
        </div>
        
        <div className="text-sm text-gray-500 mb-4">
          Showing {alumni.length} of {totalAlumni} alumni
        </div>
      </div>

      {/* Alumni grid */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
          </div>
        ) : alumni.length === 0 ? (
          <div className="text-center py-10 px-6 border-2 border-dashed border-gray-300 rounded-lg">
            <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No alumni found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search filters to find alumni.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {alumni.map((alumnus) => (
                <Link 
                  key={alumnus._id} 
                  to={`/alumni/${alumnus._id}`}
                  className="block bg-white shadow rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-center space-x-4">
                      <img
                        src={getProfileImageUrl(alumnus.profile_picture)}
                        alt={alumnus.full_name}
                        className="h-16 w-16 rounded-full object-cover"
                      />
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{alumnus.full_name}</h3>
                        <p className="text-sm text-gray-500">{alumnus.course}</p>
                        <p className="text-sm text-gray-500">Class of {alumnus.graduation_year}</p>
                      </div>
                    </div>
                    {alumnus.bio && (
                      <p className="mt-4 text-sm text-gray-500 line-clamp-2">{alumnus.bio}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <nav className="inline-flex rounded-md shadow">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className={`relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-medium ${
                      page === 0 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Previous
                  </button>
                  
                  {[...Array(totalPages).keys()].map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${
                        page === pageNum
                          ? 'bg-cvsu-green text-white'
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page === totalPages - 1}
                    className={`relative inline-flex items-center rounded-r-md px-3 py-2 text-sm font-medium ${
                      page === totalPages - 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 