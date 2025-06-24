import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Fragment, useState } from 'react';
import { Dialog, Disclosure, Popover, Transition } from '@headlessui/react';
import { 
  Bars3Icon, 
  XMarkIcon, 
  UserCircleIcon,
  AcademicCapIcon,
  DocumentCheckIcon
} from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useAuth } from '../context/AuthContext';
import cvsuLogo from '../assets/cvsu-logo.png';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link to="/" className="-m-1.5 p-1.5 flex items-center">
              <img
                className="h-12 w-auto"
                src={cvsuLogo}
                alt="CVSU"
              />
              <span className="ml-3 text-xl font-bold text-cvsu-green">CVSU-Carmona Alumni</span>
            </Link>
          </div>
          <div className="flex lg:hidden">
            <button
              type="button"
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="sr-only">Open main menu</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <Popover.Group className="hidden lg:flex lg:gap-x-12">
            <Link to="/" className="text-sm font-semibold leading-6 text-gray-900">
              Home
            </Link>
            <Link to="/about" className="text-sm font-semibold leading-6 text-gray-900">
              About
            </Link>
            <Link to="/alumni-directory" className="text-sm font-semibold leading-6 text-gray-900">
              Alumni Directory
            </Link>
            <Link to="/events" className="text-sm font-semibold leading-6 text-gray-900">
              Events
            </Link>
            <Link to="/verify" className="text-sm font-semibold leading-6 text-gray-900">
              Verify Document
            </Link>
          </Popover.Group>
          <div className="hidden lg:flex lg:flex-1 lg:justify-end">
            {currentUser ? (
              <div className="flex items-center">
                <Link
                  to={currentUser.is_admin ? "/admin" : "/dashboard"}
                  className="text-sm font-semibold text-gray-900 mr-4"
                >
                  {currentUser.is_admin ? "Admin Dashboard" : "Dashboard"}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-semibold text-gray-900"
                >
                  Log out <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            ) : (
              <Link to="/login" className="text-sm font-semibold leading-6 text-gray-900">
                Log in <span aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </div>
        </nav>
        {/* Mobile menu */}
        <Dialog as="div" className="lg:hidden" open={mobileMenuOpen} onClose={setMobileMenuOpen}>
          <div className="fixed inset-0 z-10" />
          <Dialog.Panel className="fixed inset-y-0 right-0 z-10 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
            <div className="flex items-center justify-between">
              <Link to="/" className="-m-1.5 p-1.5 flex items-center">
                <img
                  className="h-8 w-auto"
                  src={cvsuLogo}
                  alt="CVSU"
                />
                <span className="ml-2 text-base font-bold text-cvsu-green">CVSU-Carmona</span>
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-gray-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-500/10">
                <div className="space-y-2 py-6">
                  <Link
                    to="/"
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  >
                    Home
                  </Link>
                  <Link
                    to="/about"
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  >
                    About
                  </Link>
                  <Link
                    to="/alumni-directory"
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  >
                    Alumni Directory
                  </Link>
                  <Link
                    to="/events"
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  >
                    Events
                  </Link>
                  <Link
                    to="/verify"
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  >
                    Verify Document
                  </Link>
                </div>
                <div className="py-6">
                  {currentUser ? (
                    <>
                      <Link
                        to={currentUser.is_admin ? "/admin" : "/dashboard"}
                        className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                      >
                        {currentUser.is_admin ? "Admin Dashboard" : "Dashboard"}
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50 w-full text-left"
                      >
                        Log out
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/login"
                      className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    >
                      Log in
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </Dialog.Panel>
        </Dialog>
      </header>

      {/* Main content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Enhanced Footer */}
      <footer className="bg-gradient-to-r from-cvsu-green to-green-700 text-white">
        <div className="max-w-7xl mx-auto pt-12 pb-8 px-4 sm:px-6 lg:px-8">
          {/* CTA Section */}
          <div className="mb-10 bg-opacity-20 bg-white p-8 rounded-lg shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="mb-6 md:mb-0">
                <h2 className="text-2xl font-bold text-white">Ready to get started?</h2>
                <p className="text-xl font-bold text-cvsu-yellow">Join our alumni network today.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/register" className="inline-flex justify-center items-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-cvsu-green bg-white hover:bg-gray-50 shadow-sm transition-all duration-200">
                  Get started
                </Link>
                <Link to="/about" className="inline-flex justify-center items-center px-5 py-3 border border-white text-base font-medium rounded-md text-white hover:bg-white hover:bg-opacity-10 transition-all duration-200">
                  Learn more
                </Link>
              </div>
            </div>
          </div>

          {/* Main Footer Content */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8">
            {/* Logo and Description */}
            <div className="md:col-span-4">
              <div className="flex items-center mb-4">
                <img src={cvsuLogo} alt="CVSU Logo" className="h-12 w-auto" />
                <div className="ml-3">
                  <h3 className="text-lg font-bold">CVSU-Carmona</h3>
                  <p className="text-sm text-gray-200">Alumni System</p>
                </div>
              </div>
              <p className="text-sm text-gray-200 mb-6">
                Alumni Profile Management System with Blockchain Document Verification
              </p>
              
              {/* Social Media Icons */}
              <div className="flex space-x-4">
                <a href="#" className="text-white hover:text-cvsu-yellow transition-colors">
                  <span className="sr-only">Facebook</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className="text-white hover:text-cvsu-yellow transition-colors">
                  <span className="sr-only">Twitter</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
              </div>
            </div>
            
            {/* Quick Links */}
            <div className="md:col-span-3 md:ml-auto">
              <h3 className="text-lg font-semibold mb-4 border-b border-green-600 pb-2">Quick Links</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link to="/" className="group flex items-center p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-all duration-200 text-white">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 bg-opacity-30 mr-3 group-hover:bg-cvsu-yellow group-hover:bg-opacity-100 transition-all duration-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                      </svg>
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200 group-hover:text-cvsu-yellow">Home</span>
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="group flex items-center p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-all duration-200 text-white">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 bg-opacity-30 mr-3 group-hover:bg-cvsu-yellow group-hover:bg-opacity-100 transition-all duration-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200 group-hover:text-cvsu-yellow">About</span>
                  </Link>
                </li>
                <li>
                  <Link to="/alumni-directory" className="group flex items-center p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-all duration-200 text-white">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 bg-opacity-30 mr-3 group-hover:bg-cvsu-yellow group-hover:bg-opacity-100 transition-all duration-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                      </svg>
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200 group-hover:text-cvsu-yellow">Alumni Directory</span>
                  </Link>
                </li>
                <li>
                  <Link to="/events" className="group flex items-center p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-all duration-200 text-white">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 bg-opacity-30 mr-3 group-hover:bg-cvsu-yellow group-hover:bg-opacity-100 transition-all duration-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200 group-hover:text-cvsu-yellow">Events</span>
                  </Link>
                </li>
                <li>
                  <Link to="/verify" className="group flex items-center p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-all duration-200 text-white">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 bg-opacity-30 mr-3 group-hover:bg-cvsu-yellow group-hover:bg-opacity-100 transition-all duration-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200 group-hover:text-cvsu-yellow">Verify Document</span>
                  </Link>
                </li>
              </ul>
            </div>
            
            {/* Resources */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold mb-4 border-b border-green-600 pb-2">Resources</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="group flex items-center p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-all duration-200 text-white">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 bg-opacity-30 mr-3 group-hover:bg-cvsu-yellow group-hover:bg-opacity-100 transition-all duration-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200 group-hover:text-cvsu-yellow">Help Center</span>
                  </a>
                </li>
                <li>
                  <a href="#" className="group flex items-center p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-all duration-200 text-white">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 bg-opacity-30 mr-3 group-hover:bg-cvsu-yellow group-hover:bg-opacity-100 transition-all duration-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200 group-hover:text-cvsu-yellow">Privacy Policy</span>
                  </a>
                </li>
                <li>
                  <a href="#" className="group flex items-center p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-all duration-200 text-white">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 bg-opacity-30 mr-3 group-hover:bg-cvsu-yellow group-hover:bg-opacity-100 transition-all duration-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200 group-hover:text-cvsu-yellow">Terms of Service</span>
                  </a>
                </li>
                <li>
                  <a href="#" className="group flex items-center p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-all duration-200 text-white">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 bg-opacity-30 mr-3 group-hover:bg-cvsu-yellow group-hover:bg-opacity-100 transition-all duration-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200 group-hover:text-cvsu-yellow">FAQ</span>
                  </a>
                </li>
              </ul>
            </div>
            
            {/* Contact */}
            <div className="md:col-span-3">
              <h3 className="text-lg font-semibold mb-4 border-b border-green-600 pb-2">Contact</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 text-cvsu-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  <div>
                    <p>Cavite State University - Carmona Campus</p>
                    <p>Carmona, Cavite, Philippines</p>
                  </div>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2 text-cvsu-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                  <span>info@cvsu-carmona.edu.ph</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2 text-cvsu-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                  </svg>
                  <span>(046) 123-4567</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-green-600 pt-8 mt-4 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-300">
              &copy; {new Date().getFullYear()} CVSU-Carmona. All rights reserved.
            </p>
            <div className="mt-4 md:mt-0">
              <p className="text-xs text-gray-400">
                Secured with Hyperledger Fabric blockchain technology
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 