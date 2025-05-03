import React from 'react';
import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <ExclamationTriangleIcon className="h-20 w-20 text-yellow-500 mx-auto" />
          <h1 className="mt-6 text-5xl font-extrabold text-gray-900 tracking-tight">404</h1>
          <h2 className="mt-2 text-3xl font-bold text-gray-900">Page Not Found</h2>
          <p className="mt-4 text-gray-600">
            We couldn't find the page you're looking for. Please check the URL or navigate back to the homepage.
          </p>
        </div>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage; 