import {
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// Sticky Cancel / Save bar shown while editing.
export default function ProfileActionBar({
  cancelEditing,
  errorMessage,
  loading,
  saveProfile,
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {errorMessage && (
          <p className="text-sm font-medium text-red-600 truncate max-w-sm md:max-w-md">
            {errorMessage}
          </p>
        )}
        {!errorMessage && (
          <p className="text-sm text-gray-500">
            Make changes to your profile and save when done
          </p>
        )}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={cancelEditing}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
          >
            <XMarkIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
            Cancel
          </button>
          <button
            type="button"
            onClick={saveProfile}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-cvsu-green hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
          >
            {loading ? (
              <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <CheckIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
