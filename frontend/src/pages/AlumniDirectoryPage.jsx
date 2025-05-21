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
      <div className="relative bg-cover bg-center h-[300px]" style={{ backgroundImage: "url('/src/assets/graduation.jpg')" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-cvsu-green/90 to-cvsu-green/80"></div>
        <div className="absolute inset-0 bg-[url('/src/assets/pattern.svg')] opacity-10"></div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 h-full flex flex-col justify-center">
          <div className="max-w-3xl">
            <div className="animate-slideDown">
              <span className="inline-flex items-center rounded-full bg-cvsu-yellow/90 text-white px-4 py-1.5 text-sm font-medium mb-5 shadow-md backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-white mr-1.5 animate-pulse"></span>
                Connect With Alumni
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl drop-shadow-md animate-fadeIn">
              Alumni <span className="text-cvsu-yellow">Directory</span>
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 text-white/95 drop-shadow font-light backdrop-blur-[2px] pl-3 border-l-4 border-cvsu-yellow animate-slideUp">
              Connect with CVSU-Carmona graduates and build your professional network.
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
      </div>
      
      {/* Featured Alumni Section */}
      {featuredAlumni.length > 0 && (
        <div className="bg-gray-50 py-12">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl relative inline-block">
                Featured Alumni
                <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-cvsu-green to-cvsu-yellow"></span>
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Meet some of our outstanding graduates making an impact in their fields
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredAlumni.map((alumnus, index) => (
                <div 
                  key={alumnus._id} 
                  className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 hover:border-cvsu-green"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="flex flex-col items-center text-center mb-4">
                    <div className="relative mb-4">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-cvsu-green/20 shadow-md">
                        <img
                          src={getProfileImageUrl(alumnus.profile_picture)}
                          alt={alumnus.full_name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="absolute bottom-0 right-0 bg-cvsu-green text-white text-xs px-2 py-1 rounded-full shadow-sm">
                        Featured
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-cvsu-green">
                      <Link to={`/alumni/${alumnus._id}`} className="hover:text-cvsu-green transition-colors">
                        {alumnus.full_name}
                      </Link>
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{alumnus.course}</p>
                    <p className="text-sm font-medium text-cvsu-yellow mt-1">Class of {alumnus.graduation_year}</p>
                  </div>
                  
                  {alumnus.bio && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-3 text-center italic">
                      "{alumnus.bio}"
                    </p>
                  )}
                  
                  <div className="mt-6 text-center">
                    <Link 
                      to={`/alumni/${alumnus._id}`}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cvsu-green hover:bg-green-700 transition-colors"
                    >
                      View Profile
                      <svg className="ml-2 -mr-1 w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8 animate-fadeIn">
          <div className="flex items-center mb-6">
            <div className="flex-shrink-0 h-10 w-10 bg-cvsu-green/10 rounded-full flex items-center justify-center mr-4">
              <MagnifyingGlassIcon className="h-5 w-5 text-cvsu-green" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Find Alumni</h2>
              <p className="text-sm text-gray-500">Use the filters below to search for alumni by name, program, or graduation year</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-2/5">
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
            
            <div className="w-full md:w-1/5">
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
            
            <div className="w-full md:w-1/5">
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
            
            <div className="w-full md:w-1/5">
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
              className="mt-4 md:mt-0 w-full md:w-auto px-6 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green transition-colors duration-200 flex items-center justify-center"
              onClick={handleSearch}
            >
              <MagnifyingGlassIcon className="h-4 w-4 mr-2" aria-hidden="true" />
              Search
            </button>
          </div>
          
          {(searchTerm || selectedDepartment || selectedProgram || selectedYear) && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center">
              <span className="text-sm text-gray-500 mr-2">Active filters:</span>
              {searchTerm && (
                <span className="inline-flex items-center m-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-cvsu-green">
                  Search: {searchTerm}
                  <button
                    type="button"
                    className="ml-1 inline-flex text-cvsu-green focus:outline-none"
                    onClick={() => {
                      setSearchTerm('');
                      setPage(0);
                      fetchAlumni();
                    }}
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {selectedDepartment && (
                <span className="inline-flex items-center m-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-cvsu-green">
                  Department: {selectedDepartment}
                  <button
                    type="button"
                    className="ml-1 inline-flex text-cvsu-green focus:outline-none"
                    onClick={() => {
                      setSelectedDepartment('');
                      setPage(0);
                      fetchAlumni();
                    }}
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {selectedProgram && (
                <span className="inline-flex items-center m-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-cvsu-green">
                  Program: {selectedProgram}
                  <button
                    type="button"
                    className="ml-1 inline-flex text-cvsu-green focus:outline-none"
                    onClick={() => {
                      setSelectedProgram('');
                      setPage(0);
                      fetchAlumni();
                    }}
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {selectedYear && (
                <span className="inline-flex items-center m-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-cvsu-green">
                  Year: {selectedYear}
                  <button
                    type="button"
                    className="ml-1 inline-flex text-cvsu-green focus:outline-none"
                    onClick={() => {
                      setSelectedYear('');
                      setPage(0);
                      fetchAlumni();
                    }}
                  >
                    <span className="sr-only">Remove filter</span>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              <button
                type="button"
                className="ml-auto text-xs text-cvsu-green hover:text-green-700 font-medium"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedDepartment('');
                  setSelectedProgram('');
                  setSelectedYear('');
                  setPage(0);
                  fetchAlumni();
                }}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
        
        <div className="bg-cvsu-green/10 rounded-md py-2 px-3 flex justify-between items-center mb-6">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{alumni.length}</span> of <span className="font-medium">{totalAlumni}</span> alumni
            {(searchTerm || selectedDepartment || selectedProgram || selectedYear) && <span> with applied filters</span>}
          </div>
          <div className="text-sm text-gray-700">
            Page <span className="font-medium">{page + 1}</span> of <span className="font-medium">{totalPages || 1}</span>
          </div>
        </div>
      </div>

      {/* Alumni grid */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cvsu-green"></div>
          </div>
        ) : alumni.length === 0 ? (
          <div className="text-center py-12 px-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <AcademicCapIcon className="mx-auto h-16 w-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No alumni found</h3>
            <p className="mt-2 text-base text-gray-500">
              Try adjusting your search filters or clear them to see all alumni.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedDepartment('');
                setSelectedProgram('');
                setSelectedYear('');
                setPage(0);
                fetchAlumni();
              }}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cvsu-green hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {alumni.map((alumnus, index) => (
                <Link 
                  key={alumnus._id} 
                  to={`/alumni/${alumnus._id}`}
                  className="group bg-white shadow rounded-xl overflow-hidden hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-cvsu-green transform hover:-translate-y-1"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="bg-gradient-to-r from-cvsu-green to-green-700 h-3 w-full"></div>
                  <div className="p-6">
                    <div className="flex items-center">
                      <div className="relative flex-shrink-0">
                        <img
                          src={getProfileImageUrl(alumnus.profile_picture)}
                          alt={alumnus.full_name}
                          className="h-16 w-16 rounded-full object-cover border-2 border-gray-100 group-hover:border-cvsu-green transition-colors duration-200"
                        />
                        {alumnus.is_verified && (
                          <span className="absolute bottom-0 right-0 bg-cvsu-green text-white rounded-full p-1 border-2 border-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-cvsu-green transition-colors">
                          {alumnus.full_name}
                        </h3>
                        <div className="mt-1 flex flex-col space-y-1">
                          <p className="text-sm text-gray-600 flex items-center">
                            <AcademicCapIcon className="h-4 w-4 mr-1.5 text-cvsu-green" />
                            <span>{alumnus.course || 'Program not specified'}</span>
                          </p>
                          <p className="text-sm text-gray-600 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-cvsu-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Class of {alumnus.graduation_year || 'Unknown'}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {alumnus.bio && (
                      <div className="mt-4 pb-3 border-b border-gray-100">
                        <p className="text-sm text-gray-500 line-clamp-2">{alumnus.bio}</p>
                      </div>
                    )}
                    
                    <div className="mt-4 flex justify-end">
                      <span className="inline-flex items-center text-sm font-medium text-cvsu-green group-hover:translate-x-1 transition-transform">
                        View Profile
                        <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex justify-center">
                <nav className="inline-flex rounded-md shadow isolate">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className={`relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 ${
                      page === 0 
                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
                        : 'bg-white text-gray-900 hover:bg-gray-50 focus:z-10 transition-colors'
                    }`}
                  >
                    <svg className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>
                  
                  {totalPages <= 7 ? (
                    [...Array(totalPages).keys()].map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 focus:z-10 ${
                          page === pageNum
                            ? 'bg-cvsu-green text-white hover:bg-green-700 z-10'
                            : 'bg-white text-gray-900 hover:bg-gray-50 transition-colors'
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    ))
                  ) : (
                    <>
                      {/* Always show first page */}
                      <button
                        onClick={() => setPage(0)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 focus:z-10 ${
                          page === 0
                            ? 'bg-cvsu-green text-white hover:bg-green-700 z-10'
                            : 'bg-white text-gray-900 hover:bg-gray-50 transition-colors'
                        }`}
                      >
                        1
                      </button>
                      
                      {/* Show ellipsis if not close to first page */}
                      {page > 3 && (
                        <span className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 bg-white">
                          ...
                        </span>
                      )}
                      
                      {/* Show current page neighborhood */}
                      {[...Array(totalPages).keys()]
                        .filter(num => num > 0 && num < totalPages - 1)
                        .filter(num => Math.abs(num - page) < 2)
                        .map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 focus:z-10 ${
                              page === pageNum
                                ? 'bg-cvsu-green text-white hover:bg-green-700 z-10'
                                : 'bg-white text-gray-900 hover:bg-gray-50 transition-colors'
                            }`}
                          >
                            {pageNum + 1}
                          </button>
                        ))
                      }
                      
                      {/* Show ellipsis if not close to last page */}
                      {page < totalPages - 4 && (
                        <span className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 bg-white">
                          ...
                        </span>
                      )}
                      
                      {/* Always show last page */}
                      <button
                        onClick={() => setPage(totalPages - 1)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 focus:z-10 ${
                          page === totalPages - 1
                            ? 'bg-cvsu-green text-white hover:bg-green-700 z-10'
                            : 'bg-white text-gray-900 hover:bg-gray-50 transition-colors'
                        }`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page === totalPages - 1}
                    className={`relative inline-flex items-center rounded-r-md px-3 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 ${
                      page === totalPages - 1
                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-900 hover:bg-gray-50 focus:z-10 transition-colors'
                    }`}
                  >
                    Next
                    <svg className="h-5 w-5 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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