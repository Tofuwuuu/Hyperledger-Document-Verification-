import FieldError from './FieldError';
import { employmentOptions, companySectorOptions, businessLineOptions, workLocationOptions, stayReasons, firstJobReasons, tenureDurations, jobAcquisitionMethods, jobLevelOptions } from './profileOptions';

// Employment Data tab.
export default function EmploymentTab({
  getInputClass,
  handleInputChange,
  handleUnemploymentReasonChange,
  isEditing,
  profile,
  setProfile,
  validationErrors,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Employment Data</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Information about your current employment status</p>
      </div>

      <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
        {/* Employment Status */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">
            Are you presently employed? (Self-employed considered "employed")
          </dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Are you presently employed?
                </label>
                <div className="flex space-x-6">
                  {employmentOptions.map((option) => (
                    <div key={option} className="flex items-center">
                      <input
                        type="radio"
                        id={`employed_${option.toLowerCase().replace(' ', '_')}`}
                        name="is_employed"
                        value={option}
                        checked={profile.is_employed === option}
                        onChange={() => setProfile({ ...profile, is_employed: option })}
                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <label htmlFor={`employed_${option.toLowerCase().replace(' ', '_')}`} className="ml-2 block text-sm text-slate-700">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {profile.is_employed === "Yes" ? (
                  <div className="space-y-2">
                    <p>Yes</p>
                    <p><span className="font-medium">Employment Status:</span> {profile.employment_status || 'N/A'}</p>
                    <p><span className="font-medium">Occupation:</span> {profile.occupation || 'N/A'}</p>
                    <p><span className="font-medium">Company Name:</span> {profile.company_name || 'N/A'}</p>
                    <p><span className="font-medium">Company Address:</span> {profile.company_address || 'N/A'}</p>
                    <p><span className="font-medium">Company Sector:</span> {profile.company_sector || 'N/A'}</p>
                    <p><span className="font-medium">Business Line:</span> {profile.business_line || 'N/A'}</p>
                    <p><span className="font-medium">Work Location:</span> {profile.work_location || 'N/A'}</p>
                    <p><span className="font-medium">First Job:</span> {profile.is_first_job ? 'Yes' : 'No'}</p>
                    <p><span className="font-medium">Stay Reasons:</span> {profile.stay_reasons?.join(', ') || 'N/A'}</p>
                    <p><span className="font-medium">First Job Related:</span> {profile.first_job_related ? 'Yes' : 'No'}</p>
                    <p><span className="font-medium">First Job Reasons:</span> {profile.first_job_reasons?.join(', ') || 'N/A'}</p>
                    <p><span className="font-medium">First Job Tenure:</span> {profile.first_job_tenure || 'N/A'}</p>
                    <p><span className="font-medium">First Job Acquisition:</span> {profile.first_job_acquisition || 'N/A'}</p>
                    <p><span className="font-medium">Time to First Job:</span> {profile.time_to_first_job || 'N/A'}</p>
                    <p><span className="font-medium">First Job Level:</span> {profile.first_job_level || 'N/A'}</p>
                    <p><span className="font-medium">Current Job Level:</span> {profile.current_job_level || 'N/A'}</p>
                    <p><span className="font-medium">Initial Salary:</span> {profile.initial_salary || 'N/A'}</p>
                    <p><span className="font-medium">Curriculum Relevance First:</span> {profile.curriculum_relevance_first || 'N/A'}</p>
                    <p><span className="font-medium">Curriculum Relevance Current:</span> {profile.curriculum_relevance_current || 'N/A'}</p>
                    <p><span className="font-medium">Skills:</span> {profile.skills || 'N/A'}</p>
                    <p><span className="font-medium">Achievements:</span> {profile.achievements || 'N/A'}</p>
                    <p><span className="font-medium">Special Projects:</span> {profile.special_projects || 'N/A'}</p>
                    <p><span className="font-medium">Professional Organizations:</span> {profile.professional_organizations || 'N/A'}</p>
                  </div>
                ) : (
                  <div>
                    <p>{profile.is_employed}</p>
                    <p><span className="font-medium">Reason(s) why you are not yet employed:</span> {profile.unemployment_reason?.join(', ') || 'N/A'}</p>
                  </div>
                )}
              </div>
            )}
            <FieldError name="is_employed" errors={validationErrors} />
          </dd>
        </div>

        {/* Unemployment Reason - Only show if not employed */}
        {(profile.is_employed === "No" || profile.is_employed === "Never Employed") && isEditing && (
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6 border-t border-gray-200">
            <dt className="text-sm font-semibold text-slate-600">
              Reason(s) why you are not yet employed
            </dt>
            <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    id="reason-advanced-studies"
                    name="unemployment_reason"
                    type="checkbox"
                    checked={profile.unemployment_reason?.includes("Advanced Studies")}
                    onChange={(e) => handleUnemploymentReasonChange("Advanced Studies", e.target.checked)}
                    className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                  />
                  <label htmlFor="reason-advanced-studies" className="ml-2 block text-sm text-slate-700">
                    Advanced studies
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="reason-family"
                    name="unemployment_reason"
                    type="checkbox"
                    checked={profile.unemployment_reason?.includes("Family Concern")}
                    onChange={(e) => handleUnemploymentReasonChange("Family Concern", e.target.checked)}
                    className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                  />
                  <label htmlFor="reason-family" className="ml-2 block text-sm text-slate-700">
                    Family concern and decided not to find a job
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="reason-no-job"
                    name="unemployment_reason"
                    type="checkbox"
                    checked={profile.unemployment_reason?.includes("No Job Opportunity")}
                    onChange={(e) => handleUnemploymentReasonChange("No Job Opportunity", e.target.checked)}
                    className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                  />
                  <label htmlFor="reason-no-job" className="ml-2 block text-sm text-slate-700">
                    No job opportunity
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="reason-no-match"
                    name="unemployment_reason"
                    type="checkbox"
                    checked={profile.unemployment_reason?.includes("Skills Mismatch")}
                    onChange={(e) => handleUnemploymentReasonChange("Skills Mismatch", e.target.checked)}
                    className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                  />
                  <label htmlFor="reason-no-match" className="ml-2 block text-sm text-slate-700">
                    Did not match qualifications for available job opportunity
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="reason-salary"
                    name="unemployment_reason"
                    type="checkbox"
                    checked={profile.unemployment_reason?.includes("Salary Issue")}
                    onChange={(e) => handleUnemploymentReasonChange("Salary Issue", e.target.checked)}
                    className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                  />
                  <label htmlFor="reason-salary" className="ml-2 block text-sm text-slate-700">
                    Salary/compensation issue
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="reason-health"
                    name="unemployment_reason"
                    type="checkbox"
                    checked={profile.unemployment_reason?.includes("Health Issue")}
                    onChange={(e) => handleUnemploymentReasonChange("Health Issue", e.target.checked)}
                    className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                  />
                  <label htmlFor="reason-health" className="ml-2 block text-sm text-slate-700">
                    Health-related reason
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="reason-employment-strain"
                    name="unemployment_reason"
                    type="checkbox"
                    checked={profile.unemployment_reason?.includes("Employment Strain")}
                    onChange={(e) => handleUnemploymentReasonChange("Employment Strain", e.target.checked)}
                    className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                  />
                  <label htmlFor="reason-employment-strain" className="ml-2 block text-sm text-slate-700">
                    Strain and demand of employment
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="reason-other"
                    name="unemployment_reason"
                    type="checkbox"
                    checked={profile.unemployment_reason?.some(reason => reason.startsWith("Other:"))}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setProfile({
                          ...profile,
                          unemployment_reason: profile.unemployment_reason?.filter(reason => !reason.startsWith("Other:")) || []
                        });
                      } else {
                        setProfile({
                          ...profile,
                          unemployment_reason: [...(profile.unemployment_reason || []), "Other: "]
                        });
                      }
                    }}
                    className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded"
                  />
                  <label htmlFor="reason-other" className="ml-2 block text-sm text-slate-700">
                    Other
                  </label>
                </div>

                {profile.unemployment_reason?.some(reason => reason.startsWith("Other:")) && (
                  <div className="mt-1">
                    <input
                      type="text"
                      value={profile.unemployment_reason.find(reason => reason.startsWith("Other:"))?.substr(7) || ""}
                      onChange={(e) => {
                        const otherReasons = profile.unemployment_reason?.filter(reason => !reason.startsWith("Other:")) || [];
                        setProfile({
                          ...profile,
                          unemployment_reason: [...otherReasons, `Other: ${e.target.value}`]
                        });
                      }}
                      placeholder="Please specify"
                      className="shadow-sm focus:ring-cvsu-green focus:border-cvsu-green block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                )}
              </div>
              <FieldError name="unemployment_reason" errors={validationErrors} />
            </dd>
          </div>
        )}

        {/* Display unemployment reason if not editing and value exists */}
        {(profile.is_employed === "No" || profile.is_employed === "Never Employed") && !isEditing && profile.unemployment_reason && (
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6 border-t border-gray-200">
            <dt className="text-sm font-semibold text-slate-600">
              Reason(s) why you are not yet employed
            </dt>
            <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
              {typeof profile.unemployment_reason === 'string' 
                ? profile.unemployment_reason 
                : (Array.isArray(profile.unemployment_reason) 
                    ? profile.unemployment_reason.join(', ') 
                    : 'N/A')}
            </dd>
          </div>
        )}

        {/* Employment Fields - Only show if employed */}
        {profile.is_employed === "Yes" && (
          <>
            {/* Employment Type */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Employment Type
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <select
                    id="employment_status"
                    name="employment_status"
                    value={profile.employment_status || ''}
                    onChange={handleInputChange}
                    className={getInputClass('employment_status')}
                  >
                    <option value="">Select type</option>
                    <option value="REGULAR">Regular/Permanent</option>
                    <option value="TEMPORARY">Temporary</option>
                    <option value="CASUAL">Casual</option>
                    <option value="CONTRACTUAL">Contractual</option>
                    <option value="SELF_EMPLOYED">Self-employed</option>
                  </select>
                ) : (
                  profile.employment_status === 'REGULAR' ? 'Regular/Permanent' :
                  profile.employment_status === 'TEMPORARY' ? 'Temporary' :
                  profile.employment_status === 'CASUAL' ? 'Casual' :
                  profile.employment_status === 'CONTRACTUAL' ? 'Contractual' :
                  profile.employment_status === 'SELF_EMPLOYED' ? 'Self-employed' : 'N/A'
                )}
                <FieldError name="employment_status" errors={validationErrors} />
              </dd>
            </div>

            {/* Occupation/Position */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Present Occupation
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <input
                    type="text"
                    name="occupation"
                    id="occupation"
                    value={profile.occupation || ''}
                    onChange={handleInputChange}
                    placeholder="[Your answer]"
                    className={getInputClass('occupation')}
                  />
                ) : (
                  profile.occupation || 'N/A'
                )}
                <FieldError name="occupation" errors={validationErrors} />
              </dd>
            </div>

            {/* Company Name */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Name of Your Company or Organization?
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <input
                    type="text"
                    name="company_name"
                    id="company_name"
                    value={profile.company_name || ''}
                    onChange={handleInputChange}
                    placeholder="[Your answer]"
                    className={getInputClass('company_name')}
                  />
                ) : (
                  profile.company_name || 'N/A'
                )}
                <FieldError name="company_name" errors={validationErrors} />
              </dd>
            </div>

            {/* Company Address */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Complete address of your organization or institution?
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <textarea
                    name="company_address"
                    id="company_address"
                    rows={3}
                    value={profile.company_address || ''}
                    onChange={handleInputChange}
                    className={getInputClass('company_address')}
                  />
                ) : (
                  profile.company_address || 'N/A'
                )}
                <FieldError name="company_address" errors={validationErrors} />
              </dd>
            </div>

            {/* Company Sector */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Company Sector
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <select
                    id="company_sector"
                    name="company_sector"
                    value={profile.company_sector || ''}
                    onChange={handleInputChange}
                    className={getInputClass('company_sector')}
                  >
                    <option value="">Select sector</option>
                    {companySectorOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  profile.company_sector || 'N/A'
                )}
                <FieldError name="company_sector" errors={validationErrors} />
              </dd>
            </div>

            {/* Business Line */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Business Line
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <select
                    id="business_line"
                    name="business_line"
                    value={profile.business_line || ''}
                    onChange={handleInputChange}
                    className={getInputClass('business_line')}
                  >
                    <option value="">Select business line</option>
                    {businessLineOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  profile.business_line || 'N/A'
                )}
                <FieldError name="business_line" errors={validationErrors} />
              </dd>
            </div>

            {/* Work Location */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Work Location
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <select
                    id="work_location"
                    name="work_location"
                    value={profile.work_location || ''}
                    onChange={handleInputChange}
                    className={getInputClass('work_location')}
                  >
                    <option value="">Select location</option>
                    {workLocationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  profile.work_location || 'N/A'
                )}
                <FieldError name="work_location" errors={validationErrors} />
              </dd>
            </div>

            {/* Is First Job */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Is this your first job?
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <div className="flex space-x-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="is_first_job_yes"
                        name="is_first_job"
                        checked={profile.is_first_job === true}
                        onChange={() => setProfile({ ...profile, is_first_job: true })}
                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <label htmlFor="is_first_job_yes" className="ml-2 block text-sm text-slate-700">
                        Yes
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="is_first_job_no"
                        name="is_first_job"
                        checked={profile.is_first_job === false}
                        onChange={() => setProfile({ ...profile, is_first_job: false })}
                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <label htmlFor="is_first_job_no" className="ml-2 block text-sm text-slate-700">
                        No
                      </label>
                    </div>
                  </div>
                ) : (
                  profile.is_first_job ? 'Yes' : 'No'
                )}
                <FieldError name="is_first_job" errors={validationErrors} />
              </dd>
            </div>

            {/* Stay Reasons */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Reasons for staying on the job
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <div className="space-y-2">
                    {stayReasons.map((reason) => (
                      <div key={reason} className="flex items-start">
                        <input
                          type="checkbox"
                          id={`stay_reason_${reason.toLowerCase().replace(/\s+/g, '_')}`}
                          checked={profile.stay_reasons?.includes(reason) || false}
                          onChange={(e) => {
                            const updatedReasons = e.target.checked 
                              ? [...(profile.stay_reasons || []), reason]
                              : (profile.stay_reasons || []).filter(r => r !== reason);
                            setProfile({ ...profile, stay_reasons: updatedReasons });
                          }}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-1"
                        />
                        <label 
                          htmlFor={`stay_reason_${reason.toLowerCase().replace(/\s+/g, '_')}`} 
                          className="ml-2 block text-sm text-slate-700"
                        >
                          {reason}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  profile.stay_reasons?.join(', ') || 'N/A'
                )}
                <FieldError name="stay_reasons" errors={validationErrors} />
              </dd>
            </div>

            {/* First Job Related */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Is your first job related to your course?
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <div className="flex space-x-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="first_job_related_yes"
                        name="first_job_related"
                        checked={profile.first_job_related === true}
                        onChange={() => setProfile({ ...profile, first_job_related: true })}
                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <label htmlFor="first_job_related_yes" className="ml-2 block text-sm text-slate-700">
                        Yes
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="first_job_related_no"
                        name="first_job_related"
                        checked={profile.first_job_related === false}
                        onChange={() => setProfile({ ...profile, first_job_related: false })}
                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <label htmlFor="first_job_related_no" className="ml-2 block text-sm text-slate-700">
                        No
                      </label>
                    </div>
                  </div>
                ) : (
                  profile.first_job_related ? 'Yes' : 'No'
                )}
                <FieldError name="first_job_related" errors={validationErrors} />
              </dd>
            </div>

            {/* First Job Reasons */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Reasons for accepting first job
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <div className="space-y-2">
                    {firstJobReasons.map((reason) => (
                      <div key={reason} className="flex items-start">
                        <input
                          type="checkbox"
                          id={`first_job_reason_${reason.toLowerCase().replace(/\s+/g, '_')}`}
                          checked={profile.first_job_reasons?.includes(reason) || false}
                          onChange={(e) => {
                            const updatedReasons = e.target.checked 
                              ? [...(profile.first_job_reasons || []), reason]
                              : (profile.first_job_reasons || []).filter(r => r !== reason);
                            setProfile({ ...profile, first_job_reasons: updatedReasons });
                          }}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-1"
                        />
                        <label 
                          htmlFor={`first_job_reason_${reason.toLowerCase().replace(/\s+/g, '_')}`} 
                          className="ml-2 block text-sm text-slate-700"
                        >
                          {reason}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  profile.first_job_reasons?.join(', ') || 'N/A'
                )}
                <FieldError name="first_job_reasons" errors={validationErrors} />
              </dd>
            </div>

            {/* First Job Tenure */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                How long did you stay in your first job?
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <select
                    id="first_job_tenure"
                    name="first_job_tenure"
                    value={profile.first_job_tenure || ''}
                    onChange={handleInputChange}
                    className={getInputClass('first_job_tenure')}
                  >
                    <option value="">Select tenure</option>
                    {tenureDurations.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  profile.first_job_tenure || 'N/A'
                )}
                <FieldError name="first_job_tenure" errors={validationErrors} />
              </dd>
            </div>

            {/* First Job Acquisition */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                How did you find your first job?
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <select
                    id="first_job_acquisition"
                    name="first_job_acquisition"
                    value={profile.first_job_acquisition || ''}
                    onChange={handleInputChange}
                    className={getInputClass('first_job_acquisition')}
                  >
                    <option value="">Select method</option>
                    {jobAcquisitionMethods.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  profile.first_job_acquisition || 'N/A'
                )}
                <FieldError name="first_job_acquisition" errors={validationErrors} />
              </dd>
            </div>

            {/* Time to First Job */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                How long did it take to find your first job?
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <input
                    type="text"
                    name="time_to_first_job"
                    id="time_to_first_job"
                    value={profile.time_to_first_job || ''}
                    onChange={handleInputChange}
                    className={getInputClass('time_to_first_job')}
                    placeholder="e.g., 3 months after graduation"
                  />
                ) : (
                  profile.time_to_first_job || 'N/A'
                )}
                <FieldError name="time_to_first_job" errors={validationErrors} />
              </dd>
            </div>

            {/* First Job Level */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Level of your first job
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <select
                    id="first_job_level"
                    name="first_job_level"
                    value={profile.first_job_level || ''}
                    onChange={handleInputChange}
                    className={getInputClass('first_job_level')}
                  >
                    <option value="">Select level</option>
                    {jobLevelOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  profile.first_job_level || 'N/A'
                )}
                <FieldError name="first_job_level" errors={validationErrors} />
              </dd>
            </div>

            {/* Current Job Level */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Level of your current job
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <select
                    id="current_job_level"
                    name="current_job_level"
                    value={profile.current_job_level || ''}
                    onChange={handleInputChange}
                    className={getInputClass('current_job_level')}
                  >
                    <option value="">Select level</option>
                    {jobLevelOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  profile.current_job_level || 'N/A'
                )}
                <FieldError name="current_job_level" errors={validationErrors} />
              </dd>
            </div>

            {/* Initial Salary */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Initial Salary (First Job)
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <input
                    type="text"
                    name="initial_salary"
                    id="initial_salary"
                    value={profile.initial_salary || ''}
                    onChange={handleInputChange}
                    className={getInputClass('initial_salary')}
                    placeholder="e.g., ₱25,000/month"
                  />
                ) : (
                  profile.initial_salary || 'N/A'
                )}
                <FieldError name="initial_salary" errors={validationErrors} />
              </dd>
            </div>

            {/* Curriculum Relevance First */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Relevance of curriculum to first job
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <input
                    type="number"
                    name="curriculum_relevance_first"
                    id="curriculum_relevance_first"
                    min="1"
                    max="5"
                    value={profile.curriculum_relevance_first || ''}
                    onChange={handleInputChange}
                    className={getInputClass('curriculum_relevance_first')}
                    placeholder="Scale of 1-5 (5 being most relevant)"
                  />
                ) : (
                  profile.curriculum_relevance_first || 'N/A'
                )}
                <FieldError name="curriculum_relevance_first" errors={validationErrors} />
              </dd>
            </div>

            {/* Curriculum Relevance Current */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Relevance of curriculum to current job
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <input
                    type="number"
                    name="curriculum_relevance_current"
                    id="curriculum_relevance_current"
                    min="1"
                    max="5"
                    value={profile.curriculum_relevance_current || ''}
                    onChange={handleInputChange}
                    className={getInputClass('curriculum_relevance_current')}
                    placeholder="Scale of 1-5 (5 being most relevant)"
                  />
                ) : (
                  profile.curriculum_relevance_current || 'N/A'
                )}
                <FieldError name="curriculum_relevance_current" errors={validationErrors} />
              </dd>
            </div>

            {/* Date Employed */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Date Employed
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <input
                    type="date"
                    name="date_employed"
                    id="date_employed"
                    value={profile.date_employed || ''}
                    onChange={handleInputChange}
                    className={getInputClass('date_employed')}
                  />
                ) : (
                  profile.date_employed || 'N/A'
                )}
                <FieldError name="date_employed" errors={validationErrors} />
              </dd>
            </div>

            {/* Monthly Salary Range */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
              <dt className="text-sm font-semibold text-slate-600">
                Monthly Salary Range
              </dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
                {isEditing ? (
                  <select
                    id="monthly_salary"
                    name="monthly_salary"
                    value={profile.monthly_salary || ''}
                    onChange={handleInputChange}
                    className={getInputClass('monthly_salary')}
                  >
                    <option value="">Select range</option>
                    <option value="BELOW_10K">Below ₱10,000</option>
                    <option value="10K_15K">₱10,000 - ₱15,000</option>
                    <option value="15K_20K">₱15,001 - ₱20,000</option>
                    <option value="20K_25K">₱20,001 - ₱25,000</option>
                    <option value="25K_30K">₱25,001 - ₱30,000</option>
                    <option value="30K_35K">₱30,001 - ₱35,000</option>
                    <option value="35K_40K">₱35,001 - ₱40,000</option>
                    <option value="40K_50K">₱40,001 - ₱50,000</option>
                    <option value="50K_60K">₱50,001 - ₱60,000</option>
                    <option value="ABOVE_60K">Above ₱60,000</option>
                  </select>
                ) : (
                  profile.monthly_salary === 'BELOW_10K' ? 'Below ₱10,000' :
                  profile.monthly_salary === '10K_15K' ? '₱10,000 - ₱15,000' :
                  profile.monthly_salary === '15K_20K' ? '₱15,001 - ₱20,000' :
                  profile.monthly_salary === '20K_25K' ? '₱20,001 - ₱25,000' :
                  profile.monthly_salary === '25K_30K' ? '₱25,001 - ₱30,000' :
                  profile.monthly_salary === '30K_35K' ? '₱30,001 - ₱35,000' :
                  profile.monthly_salary === '35K_40K' ? '₱35,001 - ₱40,000' :
                  profile.monthly_salary === '40K_50K' ? '₱40,001 - ₱50,000' :
                  profile.monthly_salary === '50K_60K' ? '₱50,001 - ₱60,000' :
                  profile.monthly_salary === 'ABOVE_60K' ? 'Above ₱60,000' : 'N/A'
                )}
                <FieldError name="monthly_salary" errors={validationErrors} />
              </dd>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
