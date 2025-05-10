import { useState, useEffect } from 'react';
import { apiHealthCheck } from '../services/api';

const DiagnosticPanel = () => {
  const [healthResults, setHealthResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const runHealthChecks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const results = await apiHealthCheck.runAllHealthChecks();
      setHealthResults(results);
    } catch (error) {
      setError(error.message || 'Failed to run health checks');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    runHealthChecks();
  }, []);
  
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">System Diagnostic</h2>
        <button
          onClick={runHealthChecks}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Running...' : 'Run Health Check'}
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {healthResults && (
        <div className="space-y-4">
          <div className="flex items-center">
            <div className={`h-4 w-4 rounded-full mr-2 ${healthResults.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">Overall Status: {healthResults.success ? 'Healthy' : 'Issues Detected'}</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* API Status */}
            <div className="border rounded p-4">
              <div className="flex items-center mb-2">
                <div className={`h-3 w-3 rounded-full mr-2 ${healthResults.api.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <h3 className="font-medium">API Connectivity</h3>
              </div>
              <div className="text-sm text-gray-600">
                {healthResults.api.success 
                  ? `Connected to API: ${healthResults.api.data?.message || 'OK'}`
                  : `API Connection Failed: ${healthResults.api.error}`
                }
              </div>
            </div>
            
            {/* Database Status */}
            <div className="border rounded p-4">
              <div className="flex items-center mb-2">
                <div className={`h-3 w-3 rounded-full mr-2 ${healthResults.database.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <h3 className="font-medium">Database Connectivity</h3>
              </div>
              <div className="text-sm text-gray-600">
                {healthResults.database.success 
                  ? `Connected to Database: ${healthResults.database.data?.collection_names?.length || 0} collections found`
                  : `Database Connection Failed: ${healthResults.database.error}`
                }
              </div>
            </div>
            
            {/* Alumni Status */}
            <div className="border rounded p-4">
              <div className="flex items-center mb-2">
                <div className={`h-3 w-3 rounded-full mr-2 ${healthResults.alumni.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <h3 className="font-medium">Alumni Data</h3>
              </div>
              <div className="text-sm text-gray-600">
                {healthResults.alumni.success 
                  ? `Alumni Collection: ${healthResults.alumni.data?.alumni_count || 0} records found`
                  : `Alumni Check Failed: ${healthResults.alumni.error}`
                }
              </div>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 mt-4">
            Last checked: {new Date(healthResults.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticPanel; 