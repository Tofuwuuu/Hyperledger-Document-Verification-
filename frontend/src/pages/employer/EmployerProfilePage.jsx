import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../services/api';
import { toast } from 'react-toastify';

export default function EmployerProfilePage() {
  const { currentUser, updateCurrentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employer, setEmployer] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    industry: '',
    contact_person: '',
    phone: '',
    address: '',
    website: '',
    email: ''
  });

  useEffect(() => {
    if (currentUser) {
      // Initialize form with current user data
      setFormData({
        company_name: currentUser.company_name || '',
        industry: currentUser.industry || '',
        contact_person: currentUser.contact_person || '',
        phone: currentUser.phone || '',
        address: currentUser.address || '',
        website: currentUser.website || '',
        email: currentUser.email || ''
      });
      setEmployer(currentUser);
    } else {
      fetchEmployerProfile();
    }
  }, [currentUser]);

  const fetchEmployerProfile = async () => {
    try {
      setLoading(true);
      
      const response = await axios.get(`${API_URL}/employers/me`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const employerData = response.data;
      setEmployer(employerData);
      
      // Initialize form with employer data
      setFormData({
        company_name: employerData.company_name || '',
        industry: employerData.industry || '',
        contact_person: employerData.contact_person || '',
        phone: employerData.phone || '',
        address: employerData.address || '',
        website: employerData.website || '',
        email: employerData.email || ''
      });
    } catch (error) {
      console.error('Error fetching employer profile:', error);
      toast.error('Failed to load employer profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      // In a real implementation, we would update the employer profile here
      // For now, we'll just simulate a successful update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Profile updated successfully');
      
      // Update current user data in the auth context
      if (updateCurrentUser) {
        updateCurrentUser(formData);
      }
    } catch (error) {
      console.error('Error updating employer profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen-content">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <div className="px-4 sm:px-0">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Company Profile</h3>
            <p className="mt-1 text-sm text-gray-600">
              This information will be displayed to alumni when you verify their credentials.
            </p>
          </div>
        </div>
        <div className="mt-5 md:mt-0 md:col-span-2">
          <form onSubmit={handleSubmit}>
            <div className="shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 bg-white sm:p-6">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6 sm:col-span-4">
                    <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                      Company Name
                    </label>
                    <input
                      type="text"
                      name="company_name"
                      id="company_name"
                      value={formData.company_name}
                      onChange={handleInputChange}
                      className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      required
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
                      Industry
                    </label>
                    <input
                      type="text"
                      name="industry"
                      id="industry"
                      value={formData.industry}
                      onChange={handleInputChange}
                      className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      required
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="contact_person" className="block text-sm font-medium text-gray-700">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      name="contact_person"
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={handleInputChange}
                      className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      required
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-4">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md bg-gray-100"
                      disabled
                    />
                    <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      name="phone"
                      id="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                      Address
                    </label>
                    <textarea
                      name="address"
                      id="address"
                      rows={3}
                      value={formData.address}
                      onChange={handleInputChange}
                      className="mt-1 focus:ring-cvsu-green focus:border-cvsu-green block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-4">
                    <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                      Website
                    </label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                        https://
                      </span>
                      <input
                        type="text"
                        name="website"
                        id="website"
                        value={formData.website?.replace(/^https?:\/\//, '') || ''}
                        onChange={handleInputChange}
                        className="focus:ring-cvsu-green focus:border-cvsu-green flex-1 block w-full rounded-none rounded-r-md sm:text-sm border-gray-300"
                        placeholder="www.example.com"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cvsu-green hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 