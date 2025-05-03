import { useState, useEffect } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: 'John Doe',
    studentId: 'CVS-2022-001',
    course: 'Bachelor of Science in Information Technology',
    graduationYear: '2022',
    email: 'johndoe@example.com',
    phone: '+63 912 345 6789',
    address: 'Carmona, Cavite',
    bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    skills: ['Web Development', 'Mobile Development', 'UI/UX Design'],
    socialLinks: {
      linkedin: 'https://linkedin.com/in/johndoe',
      github: 'https://github.com/johndoe',
      facebook: 'https://facebook.com/johndoe'
    }
  });

  const [formData, setFormData] = useState({ ...profile });
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([
    {
      id: 'DOC-001',
      name: 'Diploma',
      issueDate: '2022-05-15',
      verified: true,
      fileUrl: '#'
    },
    {
      id: 'DOC-002',
      name: 'Transcript of Records',
      issueDate: '2022-05-20',
      verified: true,
      fileUrl: '#'
    },
    {
      id: 'DOC-003',
      name: 'Certificate of Good Moral Character',
      issueDate: '2022-04-30',
      verified: false,
      fileUrl: '#'
    }
  ]);

  useEffect(() => {
    // In a real app, we would fetch the profile data from an API
    // fetchProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSkillChange = (index, value) => {
    const updatedSkills = [...formData.skills];
    updatedSkills[index] = value;
    setFormData({
      ...formData,
      skills: updatedSkills
    });
  };

  const addSkill = () => {
    setFormData({
      ...formData,
      skills: [...formData.skills, '']
    });
  };

  const removeSkill = (index) => {
    const updatedSkills = [...formData.skills];
    updatedSkills.splice(index, 1);
    setFormData({
      ...formData,
      skills: updatedSkills
    });
  };

  const handleSocialLinkChange = (platform, value) => {
    setFormData({
      ...formData,
      socialLinks: {
        ...formData.socialLinks,
        [platform]: value
      }
    });
  };

  const startEditing = () => {
    setFormData({ ...profile });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const saveProfile = async () => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setProfile(formData);
      setIsEditing(false);
      setLoading(false);
    }, 1000);
    
    // In a real app, you would call your API:
    // try {
    //   const response = await fetch('/api/profile', {
    //     method: 'PUT',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify(formData),
    //   });
    //   const data = await response.json();
    //   setProfile(data);
    //   setIsEditing(false);
    // } catch (error) {
    //   console.error('Error updating profile:', error);
    // } finally {
    //   setLoading(false);
    // }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white">
      {/* Profile header */}
      <div className="bg-cvsu-green shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
            <div className="flex items-center">
              <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-bold overflow-hidden">
                {/* Profile image placeholder - in a real app, this would be an img tag with the user's profile picture */}
                <span>{profile.name.split(' ').map(n => n[0]).join('')}</span>
              </div>
              <div className="ml-6">
                <h1 className="text-3xl font-bold text-white">{profile.name}</h1>
                <p className="text-lg text-white opacity-90">{profile.course}</p>
                <p className="text-md text-white opacity-80">Class of {profile.graduationYear}</p>
              </div>
            </div>
            {!isEditing && (
              <button
                type="button"
                onClick={startEditing}
                className="mt-4 md:mt-0 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-cvsu-green shadow-sm hover:bg-gray-100"
              >
                <PencilIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile information */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow sm:rounded-lg overflow-hidden">
              <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Profile Information</h3>
                  {isEditing && (
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={loading}
                        className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      >
                        <XMarkIcon className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveProfile}
                        disabled={loading}
                        className="inline-flex items-center rounded-md bg-cvsu-green px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cvsu-green/90"
                      >
                        {loading ? (
                          <span>Saving...</span>
                        ) : (
                          <>
                            <CheckIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-4 py-5 sm:p-6">
                {isEditing ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Full Name
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="name"
                            id="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">
                          Student ID
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="studentId"
                            id="studentId"
                            value={formData.studentId}
                            onChange={handleInputChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                            disabled
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          Email
                        </label>
                        <div className="mt-1">
                          <input
                            type="email"
                            name="email"
                            id="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                          Phone
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="phone"
                            id="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                          Address
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="address"
                            id="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                          Bio
                        </label>
                        <div className="mt-1">
                          <textarea
                            id="bio"
                            name="bio"
                            rows={4}
                            value={formData.bio}
                            onChange={handleInputChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Skills</label>
                      <div className="mt-2 space-y-2">
                        {formData.skills.map((skill, index) => (
                          <div key={index} className="flex items-center">
                            <input
                              type="text"
                              value={skill}
                              onChange={(e) => handleSkillChange(index, e.target.value)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeSkill(index)}
                              className="ml-2 inline-flex items-center rounded-md p-1.5 text-gray-500 hover:text-red-500"
                            >
                              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addSkill}
                          className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-cvsu-green shadow-sm ring-1 ring-inset ring-cvsu-green hover:bg-cvsu-green/10"
                        >
                          Add Skill
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Social Links</label>
                      <div className="mt-2 space-y-2">
                        <div>
                          <label htmlFor="linkedin" className="block text-sm font-medium text-gray-500">
                            LinkedIn
                          </label>
                          <input
                            type="url"
                            id="linkedin"
                            value={formData.socialLinks.linkedin}
                            onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="github" className="block text-sm font-medium text-gray-500">
                            GitHub
                          </label>
                          <input
                            type="url"
                            id="github"
                            value={formData.socialLinks.github}
                            onChange={(e) => handleSocialLinkChange('github', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="facebook" className="block text-sm font-medium text-gray-500">
                            Facebook
                          </label>
                          <input
                            type="url"
                            id="facebook"
                            value={formData.socialLinks.facebook}
                            onChange={(e) => handleSocialLinkChange('facebook', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-cvsu-green focus:ring-cvsu-green sm:text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Student ID</h3>
                        <p className="mt-1 text-sm text-gray-900">{profile.studentId}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Course</h3>
                        <p className="mt-1 text-sm text-gray-900">{profile.course}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Email</h3>
                        <p className="mt-1 text-sm text-gray-900">{profile.email}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Phone</h3>
                        <p className="mt-1 text-sm text-gray-900">{profile.phone}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <h3 className="text-sm font-medium text-gray-500">Address</h3>
                        <p className="mt-1 text-sm text-gray-900">{profile.address}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <h3 className="text-sm font-medium text-gray-500">Bio</h3>
                        <p className="mt-1 text-sm text-gray-900">{profile.bio}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Skills</h3>
                      <div className="mt-2">
                        <div className="flex flex-wrap gap-2">
                          {profile.skills.map((skill, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-600/20"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Social Links</h3>
                      <div className="mt-2 space-y-1">
                        {Object.entries(profile.socialLinks).map(([platform, url]) => (
                          <div key={platform} className="flex items-center">
                            <span className="text-sm font-medium text-gray-500 capitalize w-24">{platform}:</span>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-cvsu-green hover:underline">
                              {url}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Documents section */}
            <div className="mt-8 bg-white shadow sm:rounded-lg overflow-hidden">
              <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Academic Documents</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Your verified academic documents stored on the blockchain.
                </p>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                          Document
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Issue Date
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Status
                        </th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {documents.map((document) => (
                        <tr key={document.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {document.name}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatDate(document.issueDate)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {document.verified ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <a
                              href={document.fileUrl}
                              className="text-cvsu-green hover:text-cvsu-green/80"
                            >
                              View<span className="sr-only">, {document.name}</span>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            {/* Quick links */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Quick Links</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <nav className="space-y-2">
                  <a href="#" className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:bg-gray-50">
                    Submit New Document
                  </a>
                  <a href="#" className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:bg-gray-50">
                    Update Contact Information
                  </a>
                  <a href="#" className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:bg-gray-50">
                    Privacy Settings
                  </a>
                  <a href="#" className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:bg-gray-50">
                    Account Security
                  </a>
                </nav>
              </div>
            </div>

            {/* Alumni Network */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Alumni Network</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <p className="text-sm text-gray-500 mb-4">
                  Connect with other CVSU-Carmona alumni to expand your professional network.
                </p>
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md bg-cvsu-green px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cvsu-green/90"
                >
                  Browse Alumni Directory
                </button>
              </div>
            </div>

            {/* Job Opportunities */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Job Opportunities</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <p className="text-sm text-gray-500 mb-4">
                  Explore job postings shared by CVSU-Carmona alumni and partners.
                </p>
                <div className="space-y-3">
                  <div className="border-l-4 border-cvsu-green pl-3">
                    <h4 className="text-sm font-medium text-gray-900">Software Engineer</h4>
                    <p className="text-xs text-gray-500">Posted by: Acme Technologies</p>
                  </div>
                  <div className="border-l-4 border-cvsu-green pl-3">
                    <h4 className="text-sm font-medium text-gray-900">Marketing Specialist</h4>
                    <p className="text-xs text-gray-500">Posted by: Global Marketing Inc.</p>
                  </div>
                  <div className="border-l-4 border-cvsu-green pl-3">
                    <h4 className="text-sm font-medium text-gray-900">Data Analyst</h4>
                    <p className="text-xs text-gray-500">Posted by: Data Insights Co.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <a href="#" className="text-sm font-medium text-cvsu-green hover:text-cvsu-green/80">
                    View all job postings →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 