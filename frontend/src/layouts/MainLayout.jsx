import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Dialog, Popover } from '@headlessui/react';
import { 
  Bars3Icon, 
  XMarkIcon, 
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import cvsuLogo from '../assets/cvsu-logo.png';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Alumni Directory', to: '/alumni-directory' },
  { label: 'Events', to: '/events' },
  { label: 'Verify Document', to: '/verify' },
];

export default function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link to="/" className="-m-1.5 p-1.5 flex items-center">
              <img
                className="h-10 w-auto"
                src={cvsuLogo}
                alt="CVSU"
              />
              <span className="ml-3 text-base font-bold text-cvsu-green sm:text-lg">CVSU-Carmona Alumni</span>
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
          <Popover.Group className="hidden lg:flex lg:gap-x-8">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} className="text-sm font-semibold leading-6 text-slate-700 hover:text-cvsu-green">
                {item.label}
              </Link>
            ))}
          </Popover.Group>
          <div className="hidden lg:flex lg:flex-1 lg:justify-end">
            {currentUser ? (
              <div className="flex items-center">
                {currentUser.is_admin && (
                  <Link
                    to="/admin"
                    className="mr-4 text-sm font-semibold text-slate-700 hover:text-cvsu-green"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  to="/dashboard"
                  className="mr-4 text-sm font-semibold text-slate-700 hover:text-cvsu-green"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-semibold text-slate-700 hover:text-cvsu-green"
                >
                  Log out
                </button>
              </div>
            ) : (
              <Link to="/login" className="rounded-md border border-cvsu-green/20 px-4 py-2 text-sm font-semibold leading-6 text-cvsu-green hover:bg-cvsu-green hover:text-white">
                Log in
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
                  {navItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-slate-900 hover:bg-slate-50"
                    >
                      {item.label}
                    </Link>
                  ))}
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
      <footer className="bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center">
                <img className="h-9 w-auto" src={cvsuLogo} alt="CVSU" />
                <h3 className="ml-3 text-lg font-semibold">CVSU-Carmona</h3>
              </div>
              <p className="mt-4 max-w-sm text-sm text-slate-300">
                Alumni Profile Management System with Blockchain Document Verification
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Links</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="hover:text-white">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <p className="text-sm text-slate-300">Cavite State University - Carmona Campus</p>
              <p className="text-sm text-slate-300">Carmona, Cavite, Philippines</p>
              <p className="text-sm text-slate-300">info@cvsu-carmona.edu.ph</p>
            </div>
          </div>
          <div className="mt-8 border-t border-white/10 pt-8 text-center text-sm text-slate-400">
            <p>&copy; {new Date().getFullYear()} CVSU-Carmona. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 
