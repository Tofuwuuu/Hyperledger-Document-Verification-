import FieldError from './FieldError';

// Eligibility & Licensure tab.
export default function EligibilityTab({
  getInputClass,
  handleInputChange,
  isEditing,
  profile,
  validationErrors,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Eligibility & Licensure</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Information about your professional credentials and certifications</p>
      </div>

      <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
        {/* Civil Service Eligibility */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">
            Civil Service Professional (CSC) Passer
          </dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <>
              <div className="space-y-4">
                <div>
                  <label htmlFor="csc_passer" className="block text-sm font-medium text-gray-700 mb-1">
                    Are you a Civil Service Professional (CSC) Passer?
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <input
                        id="csc_passer_yes"
                        name="csc_passer"
                        type="radio"
                        checked={profile.csc_passer === true}
                        onChange={() => handleInputChange({ target: { name: 'csc_passer', value: true } })}
                        className="focus:ring-cvsu-green h-4 w-4 text-cvsu-green border-gray-300"
                      />
                      <label htmlFor="csc_passer_yes" className="ml-2 block text-sm text-slate-700">
                        Yes
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="csc_passer_no"
                        name="csc_passer"
                        type="radio"
                        checked={profile.csc_passer === false}
                        onChange={() => handleInputChange({ target: { name: 'csc_passer', value: false } })}
                        className="focus:ring-cvsu-green h-4 w-4 text-cvsu-green border-gray-300"
                      />
                      <label htmlFor="csc_passer_no" className="ml-2 block text-sm text-slate-700">
                        No
                      </label>
                    </div>
                  </div>
                </div>

                {profile.csc_passer && (
                  <div>
                    <label htmlFor="csc_year" className="block text-sm font-medium text-gray-700 mb-1">
                      If YES (CSC), what year?
                    </label>
                    <input
                      type="number"
                      name="csc_year"
                      id="csc_year"
                      min="1948"
                      max={new Date().getFullYear()}
                      value={profile.csc_year || ''}
                      onChange={handleInputChange}
                      placeholder="[Your answer]"
                      className={getInputClass('csc_year')}
                    />
                  </div>
                )}
              </div>
              </>
            ) : (
              <div>
                {profile.csc_passer ? (
                  <div className="space-y-2">
                    <p>Yes</p>
                    <p><span className="font-medium">Year:</span> {profile.csc_year || 'Not specified'}</p>
                  </div>
                ) : (
                  <p>No</p>
                )}
              </div>
            )}
            <FieldError name="csc_passer" errors={validationErrors} />
            <FieldError name="csc_year" errors={validationErrors} />
          </dd>
        </div>

        {/* Professional Examinations */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">
            Professional Examination(s) Passed
            <div className="mt-1 text-xs text-slate-400 font-normal">
              PRC Licensure Examinations and the like
            </div>
          </dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <textarea
                name="professional_exams"
                id="professional_exams"
                rows={3}
                value={profile.professional_exams || ''}
                onChange={handleInputChange}
                placeholder="List any professional examinations passed (e.g., PRC Licensure Examinations)"
                className={getInputClass('professional_exams')}
              />
            ) : (
              profile.professional_exams || 'N/A'
            )}
            <FieldError name="professional_exams" errors={validationErrors} />
          </dd>
        </div>

        {/* Certifications */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">
            Certification
            <div className="mt-1 text-xs text-slate-400 font-normal">
              NC Level, Microsoft Certificates, CISCO Certificates, etc. (Be Specific)
            </div>
          </dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <textarea
                name="certifications"
                id="certifications"
                rows={3}
                value={profile.certifications || ''}
                onChange={handleInputChange}
                placeholder="List your certifications with specific details (e.g., Microsoft Certified: Azure Administrator Associate, CCNA, etc.)"
                className={getInputClass('certifications')}
              />
            ) : (
              profile.certifications || 'N/A'
            )}
            <FieldError name="certifications" errors={validationErrors} />
          </dd>
        </div>
      </div>
    </div>
  );
}
