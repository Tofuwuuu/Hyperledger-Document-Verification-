import { Outlet, Link, useNavigate } from 'react-router-dom';
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="bg-white">
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
                {currentUser.is_admin && (
                  <Link
                    to="/admin"
                    className="text-sm font-semibold text-gray-900 mr-4"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  to="/dashboard"
                  className="text-sm font-semibold text-gray-900 mr-4"
                >
                  Dashboard
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
                      {currentUser.is_admin && (
                        <Link
                          to="/admin"
                          className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                        >
                          Admin
                        </Link>
                      )}
                      <Link
                        to="/dashboard"
                        className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                      >
                        Dashboard
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
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-cvsu-green text-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">CVSU-Carmona</h3>
              <p className="text-sm">
                Alumni Profile Management System with Blockchain Document Verification
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Links</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="hover:underline">Home</Link></li>
                <li><Link to="/about" className="hover:underline">About</Link></li>
                <li><Link to="/alumni-directory" className="hover:underline">Alumni Directory</Link></li>
                <li><Link to="/events" className="hover:underline">Events</Link></li>
                <li><Link to="/verify" className="hover:underline">Verify Document</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <p className="text-sm">Cavite State University - Carmona Campus</p>
              <p className="text-sm">Carmona, Cavite, Philippines</p>
              <p className="text-sm">Email: info@cvsu-carmona.edu.ph</p>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-600 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} CVSU-Carmona. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 