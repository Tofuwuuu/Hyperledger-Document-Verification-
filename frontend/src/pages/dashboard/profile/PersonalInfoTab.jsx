import {
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import FieldError from './FieldError';
import { getImageFromLocalStorage } from './profileStorage';
import { philippineRegions } from './profileOptions';

// Personal Information tab.
export default function PersonalInfoTab({
  addSocialMedia,
  getInputClass,
  handleFieldBlur,
  handleInputChange,
  handleProfilePictureChange,
  handleSocialMediaChange,
  isEditing,
  isUploading,
  photoError,
  previewUrl,
  profile,
  profileInitials,
  profilePicture,
  removeSocialMedia,
  uploadProfilePicture,
  validationErrors,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Personal Information</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Your basic personal details</p>
      </div>

      <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
        {/* Profile Picture Section */}
        <div className="py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Profile Picture</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-shrink-0">
                <div className="relative h-20 w-20 overflow-hidden rounded-full bg-slate-100 ring-4 ring-slate-50">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      key={previewUrl?.substring(0, 30)}
                      onError={(e) => {
                        e.target.onerror = null;
                        if (profile.user_id) {
                          const localImage = getImageFromLocalStorage(profile.user_id);
                          if (localImage && localImage !== previewUrl) {
                            e.target.src = localImage;
                            return;
                          }
                        }
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-cvsu-green text-lg font-semibold text-white">
                      {profileInitials || 'A'}
                    </div>
                  )}
                </div>
              </div>
              {isEditing && (
                <div>
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap text-sm text-slate-600">
                      <label
                        htmlFor="profile-picture-upload"
                        className="relative cursor-pointer font-semibold text-cvsu-green hover:text-cvsu-green/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-cvsu-green focus-within:ring-offset-2"
                      >
                        <span>Upload a file</span>
                        <input id="profile-picture-upload" name="profile-picture-upload" type="file" accept="image/jpeg,image/png" className="sr-only" onChange={handleProfilePictureChange} aria-describedby={photoError ? 'profile_picture-error' : undefined} />
                      </label>
                      <p className="pl-1">to update your photo</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">JPG or PNG up to 10 MB</p>
                    {profilePicture && (
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => uploadProfilePicture()}
                        className="mt-3 inline-flex items-center rounded-md border border-transparent bg-cvsu-green/10 px-3 py-1.5 text-xs font-semibold text-cvsu-green hover:bg-cvsu-green/20 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2"
                      >
                        {isUploading ? 'Uploading...' : 'Upload Image'}
                      </button>
                    )}
                  </div>
                  <FieldError name="profile_picture" errors={{ profile_picture: photoError }} />
                </div>
              )}
            </div>
          </dd>
        </div>

        {/* Basic Personal Info Fields */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Full Name</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <input
                type="text"
                name="full_name"
                id="full_name"
                value={profile.full_name}
                onChange={handleInputChange}
                className={getInputClass('full_name')}
              />
            ) : (
              profile.full_name
            )}
            <FieldError name="full_name" errors={validationErrors} />
          </dd>
        </div>

        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Student ID</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <input
                type="text"
                name="student_id"
                id="student_id"
                value={profile.student_id}
                onChange={handleInputChange}
                onBlur={handleFieldBlur}
                aria-invalid={validationErrors.student_id ? 'true' : undefined}
                aria-describedby={validationErrors.student_id ? 'student_id-error' : undefined}
                className={getInputClass('student_id')}
              />
            ) : (
              profile.student_id
            )}
            <FieldError name="student_id" errors={validationErrors} />
          </dd>
        </div>

        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Email</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <input
                type="email"
                name="email"
                id="email"
                value={profile.email}
                onChange={handleInputChange}
                onBlur={handleFieldBlur}
                aria-invalid={validationErrors.email ? 'true' : undefined}
                aria-describedby={validationErrors.email ? 'email-error' : undefined}
                className={getInputClass('email')}
              />
            ) : (
              profile.email
            )}
            <FieldError name="email" errors={validationErrors} />
          </dd>
        </div>

        {/* Sex/Gender */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Sex</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <select
                name="sex"
                id="sex"
                value={profile.sex}
                onChange={handleInputChange}
                className={getInputClass('sex')}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            ) : (
              profile.sex ? profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1) : ''
            )}
            <FieldError name="sex" errors={validationErrors} />
          </dd>
        </div>

        {/* Civil Status */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Civil Status</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <select
                name="civil_status"
                id="civil_status"
                value={profile.civil_status}
                onChange={handleInputChange}
                className={getInputClass('civil_status')}
              >
                <option value="">Select civil status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="separated">Separated</option>
                <option value="widowed">Widow/er</option>
              </select>
            ) : (
              profile.civil_status ? profile.civil_status.charAt(0).toUpperCase() + profile.civil_status.slice(1) : ''
            )}
            <FieldError name="civil_status" errors={validationErrors} />
          </dd>
        </div>

        {/* Birthday */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">
            Birthday
            <div className="mt-1 text-xs text-slate-400 font-normal">
              Please enter your date of birth in YYYY-MM-DD format
            </div>
          </dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <input
                type="date"
                name="birthday"
                id="birthday"
                value={profile.birthday}
                onChange={handleInputChange}
                className={getInputClass('birthday')}
              />
            ) : (
              profile.birthday ? new Date(profile.birthday).toLocaleDateString() : ''
            )}
            <FieldError name="birthday" errors={validationErrors} />
          </dd>
        </div>

        {/* Region of Origin */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Region of Origin</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <select
                name="region_of_origin"
                id="region_of_origin"
                value={profile.region_of_origin}
                onChange={handleInputChange}
                className={getInputClass('region_of_origin')}
              >
                <option value="">Select region</option>
                {philippineRegions.map((region, index) => (
                  <option key={index} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            ) : (
              profile.region_of_origin
            )}
            <FieldError name="region_of_origin" errors={validationErrors} />
          </dd>
        </div>

        {/* Phone */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Phone</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <input
                type="text"
                name="phone"
                id="phone"
                value={profile.phone}
                onChange={handleInputChange}
                className={getInputClass('phone')}
              />
            ) : (
              profile.phone
            )}
            <FieldError name="phone" errors={validationErrors} />
          </dd>
        </div>

        {/* Address */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Address</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <textarea
                name="address"
                id="address"
                rows={3}
                value={profile.address}
                onChange={handleInputChange}
                className={getInputClass('address')}
              />
            ) : (
              profile.address
            )}
            <FieldError name="address" errors={validationErrors} />
          </dd>
        </div>

        {/* Bio */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Bio</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <textarea
                name="bio"
                id="bio"
                rows={4}
                value={profile.bio}
                onChange={handleInputChange}
                className={getInputClass('bio')}
              />
            ) : (
              profile.bio
            )}
            <FieldError name="bio" errors={validationErrors} />
          </dd>
        </div>

        {/* Social Media */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">Social Media</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <div className="space-y-4">
                {profile.social_media?.map((social, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <select
                      value={social.platform || ''}
                      onChange={(e) => handleSocialMediaChange(index, 'platform', e.target.value)}
                      className="max-w-lg block shadow-sm focus:ring-cvsu-green focus:border-cvsu-green sm:max-w-xs sm:text-sm border-gray-300 rounded-md"
                    >
                      <option value="">Select platform</option>
                      <option value="facebook">Facebook</option>
                      <option value="twitter">Twitter</option>
                      <option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="github">GitHub</option>
                      <option value="youtube">YouTube</option>
                      <option value="tiktok">TikTok</option>
                      <option value="discord">Discord</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="text"
                      value={social.url || ''}
                      onChange={(e) => handleSocialMediaChange(index, 'url', e.target.value)}
                      placeholder="Enter URL"
                      className="max-w-lg flex-1 block shadow-sm focus:ring-cvsu-green focus:border-cvsu-green sm:text-sm border-gray-300 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => removeSocialMedia(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSocialMedia}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cvsu-green"
                >
                  <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                  Add Social Media
                </button>
              </div>
            ) : (
              <div>
                {profile.social_media?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {profile.social_media.map((social, index) => (
                      <a 
                        key={index} 
                        href={social.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 text-white ${
                          social.platform === 'facebook' ? 'bg-blue-600' :
                          social.platform === 'twitter' ? 'bg-blue-400' :
                          social.platform === 'instagram' ? 'bg-pink-500' :
                          social.platform === 'linkedin' ? 'bg-blue-700' :
                          social.platform === 'github' ? 'bg-gray-900' :
                          social.platform === 'youtube' ? 'bg-red-600' :
                          social.platform === 'tiktok' ? 'bg-black' :
                          social.platform === 'discord' ? 'bg-indigo-600' :
                          'bg-gray-500'
                        }`}>
                          {social.platform.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium capitalize">{social.platform}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">{social.url}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : 'No social media profiles added'}
              </div>
            )}
          </dd>
        </div>
      </div>
    </div>
  );
}
