import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AcademicCapIcon,
  ArrowRightIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
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

  const fetchAlumni = async () => {
    setLoading(true);
    try {
      const params = {
        limit,
        offset: page * limit,
      };

      if (searchTerm) params.name = searchTerm;
      if (selectedProgram) params.course = selectedProgram;
      if (selectedYear) params.graduation_year = parseInt(selectedYear);
      if (selectedDepartment) params.department = selectedDepartment;

      const response = await alumniService.getAllAlumni(params);
      setAlumni(response.data.results);
      setTotalAlumni(response.data.total);
    } catch (error) {
      console.error('Error fetching alumni:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturedAlumni = async () => {
    try {
      const response = await alumniService.getAllAlumni({ limit: 3 });
      setFeaturedAlumni(response.data.results);
    } catch (error) {
      console.error('Error fetching featured alumni:', error);
    }
  };

  const handleSearch = () => {
    setPage(0);
    fetchAlumni();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const programs = [...new Set(alumni.map((a) => String(a.course || '').trim()).filter(Boolean))];
  const departments = [...new Set(alumni.map((a) => String(a.department || '').trim()).filter(Boolean))];
  const years = [...new Set(alumni.map((a) => Number(a.graduation_year)).filter(Number.isFinite))].sort((a, b) => b - a);
  const totalPages = Math.ceil(totalAlumni / limit);
  const activeFilters = [searchTerm, selectedDepartment, selectedProgram, selectedYear].filter(Boolean).length;
  const firstResult = totalAlumni === 0 ? 0 : page * limit + 1;
  const lastResult = Math.min((page + 1) * limit, totalAlumni);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedDepartment('');
    setSelectedProgram('');
    setSelectedYear('');
    setPage(0);
  };

  const getProfileImageUrl = (profilePicture) => {
    if (profilePicture) {
      let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      return `${baseUrl}/${profilePicture}`;
    }
    return null;
  };

  const getAlumnusKey = (alumnus, index) => {
    return alumnus._id || alumnus.id || alumnus.user_id || `${alumnus.full_name || 'alumnus'}-${index}`;
  };

  const renderAvatar = (alumnus) => {
    const imageUrl = getProfileImageUrl(alumnus.profile_picture);
    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt={alumnus.full_name || 'Alumni profile'}
          className="h-16 w-16 rounded-full object-cover ring-1 ring-slate-200"
        />
      );
    }

    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cvsu-green/10 text-cvsu-green ring-1 ring-cvsu-green/10">
        <AcademicCapIcon className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  };

  const getClassYear = (alumnus) => alumnus.graduation_year || alumnus.batch || '';
  const getCourse = (alumnus) => alumnus.course || alumnus.program || 'Program not specified';
  const getDepartment = (alumnus) => alumnus.department || 'Department not specified';
  const getRole = (alumnus) => alumnus.current_job || alumnus.current_position || alumnus.occupation || '';
  const getEmployer = (alumnus) => alumnus.current_employer || alumnus.company || '';

  const getVisiblePages = () => {
    if (totalPages <= 7) {
      return [...Array(totalPages).keys()];
    }
    const start = Math.max(0, Math.min(page - 2, totalPages - 5));
    return [...Array(5).keys()].map((item) => start + item);
  };

  const AlumniCard = ({ alumnus, index, featured = false }) => {
    const classYear = getClassYear(alumnus);
    const role = getRole(alumnus);
    const employer = getEmployer(alumnus);

    return (
      <Link
        key={getAlumnusKey(alumnus, index)}
        to={`/alumni/${alumnus._id}`}
        className="group block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-cvsu-green/50 hover:shadow-md"
      >
        <div className="h-1 bg-gradient-to-r from-cvsu-green via-emerald-300 to-cvsu-yellow opacity-70 transition group-hover:opacity-100" />
        <div className="flex items-start gap-4 p-5">
          {renderAvatar(alumnus)}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-slate-950 group-hover:text-cvsu-green">
                  {alumnus.full_name || 'Unnamed alumnus'}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{getCourse(alumnus)}</p>
              </div>
              <ArrowRightIcon className="mt-1 h-4 w-4 flex-none text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cvsu-green" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-cvsu-green/10 px-2.5 py-1 text-xs font-medium text-cvsu-green-dark">
                <CalendarDaysIcon className="h-3.5 w-3.5" />
                {classYear ? `Class of ${classYear}` : 'Class year not set'}
              </span>
              {!featured && (
                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  <BuildingOffice2Icon className="h-3.5 w-3.5 flex-none" />
                  <span className="truncate">{getDepartment(alumnus)}</span>
                </span>
              )}
            </div>

            {(role || employer || alumnus.bio) && (
              <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
                {[role, employer].filter(Boolean).join(' at ') || alumnus.bio}
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="bg-slate-50">
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_12%_20%,rgba(255,193,7,0.20),transparent_26%),linear-gradient(135deg,#246f62_0%,#34a085_48%,#10b981_100%)]">
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/25" />
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-14">
          <div>
            <p className="inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
              CVSU-Carmona network
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Alumni Directory
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/90">
              Find graduates by name, program, department, or class year and open a profile in one click.
            </p>
            <div className="mt-6 h-1.5 w-24 rounded-full bg-cvsu-yellow shadow-[0_0_24px_rgba(255,193,7,0.55)]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:self-end">
            <div className="rounded-lg border border-white/25 bg-white/15 p-4 text-white shadow-lg shadow-emerald-950/10 backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20">
                <UserGroupIcon className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-bold">{totalAlumni || '--'}</p>
              <p className="text-sm text-white/80">Alumni records</p>
            </div>
            <div className="rounded-lg border border-white/25 bg-white/15 p-4 text-white shadow-lg shadow-emerald-950/10 backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20">
                <BuildingOffice2Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-bold">{departments.length || '--'}</p>
              <p className="text-sm text-white/80">Departments shown</p>
            </div>
            <div className="rounded-lg border border-white/25 bg-white/15 p-4 text-white shadow-lg shadow-emerald-950/10 backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20">
                <AcademicCapIcon className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-bold">{programs.length || '--'}</p>
              <p className="text-sm text-white/80">Programs shown</p>
            </div>
          </div>
        </div>
      </div>

      {featuredAlumni.length > 0 && (
        <div className="border-b border-slate-200 bg-white py-10">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-cvsu-green">Featured profiles</p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Recently listed alumni
                </h2>
              </div>
              <p className="text-sm text-slate-500">A quick look at profiles available in the directory.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {featuredAlumni.map((alumnus, index) => (
                <AlumniCard key={getAlumnusKey(alumnus, index)} alumnus={alumnus} index={index} featured />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="-mx-5 -mt-5 mb-5 h-1 rounded-t-lg bg-gradient-to-r from-cvsu-green via-emerald-400 to-cvsu-yellow" />
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">Browse directory</h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {firstResult}-{lastResult} of {totalAlumni} alumni
              </p>
            </div>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-cvsu-green/40 hover:bg-emerald-50"
              >
                <XMarkIcon className="h-4 w-4" />
                Clear filters
              </button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(260px,1.6fr)_repeat(3,minmax(160px,0.7fr))_auto] lg:items-end">
            <div>
              <label htmlFor="search" className="block text-sm font-semibold text-slate-700">
                Search alumni
              </label>
              <div className="relative mt-2 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
                <input
                  type="text"
                  name="search"
                  id="search"
                  className="block w-full rounded-md border-slate-300 bg-slate-50 py-2.5 pl-10 focus:border-cvsu-green focus:bg-white focus:ring-cvsu-green sm:text-sm"
                  placeholder="Search by name, student ID, or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-semibold text-slate-700">
                Department
              </label>
              <select
                id="department"
                name="department"
                className="mt-2 block w-full rounded-md border-slate-300 bg-slate-50 py-2.5 pl-3 pr-10 text-base focus:border-cvsu-green focus:bg-white focus:outline-none focus:ring-cvsu-green sm:text-sm"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((department, index) => (
                  <option key={`department-${department}-${index}`} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="program" className="block text-sm font-semibold text-slate-700">
                Program
              </label>
              <select
                id="program"
                name="program"
                className="mt-2 block w-full rounded-md border-slate-300 bg-slate-50 py-2.5 pl-3 pr-10 text-base focus:border-cvsu-green focus:bg-white focus:outline-none focus:ring-cvsu-green sm:text-sm"
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
              >
                <option value="">All Programs</option>
                {programs.map((program, index) => (
                  <option key={`program-${program}-${index}`} value={program}>
                    {program}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="year" className="block text-sm font-semibold text-slate-700">
                Graduation Year
              </label>
              <select
                id="year"
                name="year"
                className="mt-2 block w-full rounded-md border-slate-300 bg-slate-50 py-2.5 pl-3 pr-10 text-base focus:border-cvsu-green focus:bg-white focus:outline-none focus:ring-cvsu-green sm:text-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="">All Years</option>
                {years.map((year) => (
                  <option key={`year-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-transparent bg-cvsu-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cvsu-green-dark focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2 lg:w-auto"
              onClick={handleSearch}
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6).keys()].map((item) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex gap-4">
                  <div className="h-16 w-16 animate-pulse rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : alumni.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <AcademicCapIcon className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-950">No alumni found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Try adjusting your search filters to find alumni.
            </p>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 rounded-md bg-cvsu-green px-4 py-2 text-sm font-semibold text-white hover:bg-cvsu-green-dark"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {alumni.map((alumnus, index) => (
                <AlumniCard key={getAlumnusKey(alumnus, index)} alumnus={alumnus} index={index} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
                <p className="text-sm text-slate-500">
                  Page {page + 1} of {totalPages}
                </p>
                <nav className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className={`relative inline-flex items-center px-3 py-2 text-sm font-medium ${
                      page === 0
                        ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Previous
                  </button>

                  {getVisiblePages().map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`relative inline-flex items-center border-l border-slate-200 px-4 py-2 text-sm font-medium ${
                        page === pageNum
                          ? 'bg-cvsu-green text-white'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page === totalPages - 1}
                    className={`relative inline-flex items-center border-l border-slate-200 px-3 py-2 text-sm font-medium ${
                      page === totalPages - 1
                        ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                        : 'text-slate-600 hover:bg-slate-50'
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
