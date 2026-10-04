import FieldError from './FieldError';
import { degreeReasons } from './profileOptions';

// Educational Background tab.
export default function EducationTab({
  courseOptions,
  getCourseOptionLabel,
  getCourseOptionValue,
  getFieldValue,
  getInputClass,
  handleFieldBlur,
  handleInputChange,
  isEditing,
  profile,
  setProfile,
  validationErrors,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Educational Background</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Your academic history and achievements</p>
      </div>

      <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
        {/* Department, Batch, Course fields */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Department</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <input
                type="text"
                name="department"
                id="department"
                value={getFieldValue(profile.department)}
                onChange={handleInputChange}
                className={getInputClass('department')}
              />
            ) : (
              profile.department
            )}
            <FieldError name="department" errors={validationErrors} />
          </dd>
        </div>

        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Course</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <select
                name="course"
                id="course"
                value={getFieldValue(profile.course)}
                onChange={handleInputChange}
                className={getInputClass('course')}
              >
                <option value="">Select course</option>
                {courseOptions.map((course, index) => (
                  <option key={getCourseOptionValue(course) || index} value={getCourseOptionValue(course)}>
                    {getCourseOptionLabel(course)}
                  </option>
                ))}
              </select>
            ) : (
              profile.course
            )}
            <FieldError name="course" errors={validationErrors} />
          </dd>
        </div>

        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Batch</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <input
                type="text"
                name="batch"
                id="batch"
                value={getFieldValue(profile.batch)}
                onChange={handleInputChange}
                className={getInputClass('batch')}
              />
            ) : (
              profile.batch
            )}
            <FieldError name="batch" errors={validationErrors} />
          </dd>
        </div>

        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Graduation Year</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <input
                type="number"
                name="graduation_year"
                id="graduation_year"
                min="1948"
                max={new Date().getFullYear()}
                value={getFieldValue(profile.graduation_year)}
                onChange={handleInputChange}
                onBlur={handleFieldBlur}
                aria-invalid={validationErrors.graduation_year ? 'true' : undefined}
                aria-describedby={validationErrors.graduation_year ? 'graduation_year-error' : undefined}
                className={getInputClass('graduation_year')}
              />
            ) : (
              profile.graduation_year
            )}
            <FieldError name="graduation_year" errors={validationErrors} />
          </dd>
        </div>

        {/* Graduation Month */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Graduation Period</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <select
                name="graduation_month"
                id="graduation_month"
                value={profile.graduation_month || ''}
                onChange={handleInputChange}
                className={getInputClass('graduation_month')}
              >
                <option value="">Select graduation period</option>
                <option value="April">April</option>
                <option value="September">September</option>
                <option value="November">November</option>
              </select>
            ) : (
              profile.graduation_month ? `${profile.graduation_month} ${profile.graduation_year}` : profile.graduation_year
            )}
            <FieldError name="graduation_month" errors={validationErrors} />
          </dd>
        </div>

        {/* Honors and Awards */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">
            Honors/Awards Received
            <div className="mt-1 text-xs text-slate-400 font-normal">
              List any academic honors, dean's list awards, or scholarships you received
            </div>
          </dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <textarea
                name="honors_awards"
                id="honors_awards"
                rows={3}
                value={profile.honors_awards || ''}
                onChange={handleInputChange}
                placeholder="List any honors or awards received during college (or enter N/A)"
                className={getInputClass('honors_awards')}
              />
            ) : (
              profile.honors_awards || 'N/A'
            )}
            <FieldError name="honors_awards" errors={validationErrors} />
          </dd>
        </div>

        {/* Reasons for pursuing degree */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Reasons for Pursuing Degree</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <div className="space-y-2">
                {degreeReasons.map((reason, index) => (
                  <div key={index} className="flex items-start">
                    <input
                      type="checkbox"
                      id={`reason-${index}`}
                      checked={profile.degree_reasons?.includes(reason) || false}
                      onChange={(e) => {
                        const updatedReasons = e.target.checked
                          ? [...(profile.degree_reasons || []), reason]
                          : (profile.degree_reasons || []).filter(r => r !== reason);
                        setProfile({...profile, degree_reasons: updatedReasons});
                      }}
                      className="h-4 w-4 text-cvsu-green focus:ring-cvsu-green border-gray-300 rounded mt-1"
                    />
                    <label htmlFor={`reason-${index}`} className="ml-2 block text-sm text-slate-700">
                      {reason}
                    </label>
                  </div>
                ))}
                <div>
                  <label htmlFor="reason-other" className="block text-sm text-slate-700 mb-1">
                    Other reason:
                  </label>
                  <input
                    type="text"
                    id="reason-other"
                    name="degree_reasons_other"
                    value={profile.degree_reasons_other || ''}
                    onChange={handleInputChange}
                    className={getInputClass('degree_reasons_other')}
                  />
                </div>
              </div>
            ) : (
              <div>
                {profile.degree_reasons?.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {profile.degree_reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                    {profile.degree_reasons_other && <li>{profile.degree_reasons_other}</li>}
                  </ul>
                ) : 'Not specified'}
              </div>
            )}
          </dd>
        </div>

        {/* Advanced Studies */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-slate-600">Advanced Studies</dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <div className="space-y-3">
                <select
                  name="advanced_studies_level"
                  id="advanced_studies_level"
                  value={profile.advanced_studies?.level || 'None'}
                  onChange={(e) => setProfile({
                    ...profile,
                    advanced_studies: {
                      ...(profile.advanced_studies || {}),
                      level: e.target.value
                    }
                  })}
                  className={getInputClass('advanced_studies_level')}
                >
                  <option value="None">None</option>
                  <option value="MA Units">MA Units</option>
                  <option value="MA Graduate">MA Graduate</option>
                  <option value="PhD Units">PhD Units</option>
                </select>

                {profile.advanced_studies?.level && profile.advanced_studies.level !== 'None' && (
                  <>
                    <div>
                      <label className="block text-sm text-slate-700 mb-1">
                        Institution
                      </label>
                      <input
                        type="text"
                        name="advanced_studies_institution"
                        value={profile.advanced_studies?.institution || ''}
                        onChange={(e) => setProfile({
                          ...profile,
                          advanced_studies: {
                            ...(profile.advanced_studies || {}),
                            institution: e.target.value
                          }
                        })}
                        className={getInputClass('advanced_studies_institution')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-700 mb-1">
                        Field of Study
                      </label>
                      <input
                        type="text"
                        name="advanced_studies_field"
                        value={profile.advanced_studies?.field || ''}
                        onChange={(e) => setProfile({
                          ...profile,
                          advanced_studies: {
                            ...(profile.advanced_studies || {}),
                            field: e.target.value
                          }
                        })}
                        className={getInputClass('advanced_studies_field')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-700 mb-1">
                        Motivation
                      </label>
                      <textarea
                        name="advanced_studies_motivation"
                        rows={3}
                        value={profile.advanced_studies?.motivation || ''}
                        onChange={(e) => setProfile({
                          ...profile,
                          advanced_studies: {
                            ...(profile.advanced_studies || {}),
                            motivation: e.target.value
                          }
                        })}
                        placeholder="Explain what made you pursue advanced studies (e.g., professional growth, promotion)"
                        className={getInputClass('advanced_studies_motivation')}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div>
                {profile.advanced_studies?.level && profile.advanced_studies.level !== 'None' ? (
                  <div className="space-y-2">
                    <p><strong>Level:</strong> {profile.advanced_studies.level}</p>
                    {profile.advanced_studies.institution && <p><strong>Institution:</strong> {profile.advanced_studies.institution}</p>}
                    {profile.advanced_studies.field && <p><strong>Field:</strong> {profile.advanced_studies.field}</p>}
                    {profile.advanced_studies.motivation && <p><strong>Motivation:</strong> {profile.advanced_studies.motivation}</p>}
                  </div>
                ) : 'None'}
              </div>
            )}
          </dd>
        </div>
      </div>
    </div>
  );
}
