import FieldError from './FieldError';

// Skills & Abilities tab.
export default function SkillsTab({
  getInputClass,
  handleInputChange,
  isEditing,
  profile,
  validationErrors,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Skills & Abilities</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Share your professional skills and achievements</p>
      </div>

      <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
        {/* Professional Skills */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">
            Professional Skills
            <div className="mt-1 text-xs text-slate-400 font-normal">
              List your key professional skills
            </div>
          </dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <textarea
                name="skills"
                id="skills"
                rows={4}
                value={profile.skills || ''}
                onChange={handleInputChange}
                placeholder="List your technical skills, soft skills, and industry-specific competencies (e.g., Programming Languages, Project Management, Communication, etc.)"
                className={getInputClass('skills')}
              />
            ) : (
              <div className="whitespace-pre-line">
                {profile.skills || 'No skills listed'}
              </div>
            )}
            <FieldError name="skills" errors={validationErrors} />
          </dd>
        </div>

        {/* Achievements */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">
            Achievements
            <div className="mt-1 text-xs text-slate-400 font-normal">
              List your notable achievements and awards
            </div>
          </dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <textarea
                name="achievements"
                id="achievements"
                rows={4}
                value={profile.achievements || ''}
                onChange={handleInputChange}
                placeholder="List awards, recognition, or significant accomplishments in your career or academic life"
                className={getInputClass('achievements')}
              />
            ) : (
              <div className="whitespace-pre-line">
                {profile.achievements || 'No achievements listed'}
              </div>
            )}
            <FieldError name="achievements" errors={validationErrors} />
          </dd>
        </div>

        {/* Special Projects */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">
            Special Projects
            <div className="mt-1 text-xs text-slate-400 font-normal">
              Describe any significant projects you've worked on
            </div>
          </dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <textarea
                name="special_projects"
                id="special_projects"
                rows={4}
                value={profile.special_projects || ''}
                onChange={handleInputChange}
                placeholder="Describe special projects, research, or initiatives you've led or been part of"
                className={getInputClass('special_projects')}
              />
            ) : (
              <div className="whitespace-pre-line">
                {profile.special_projects || 'No special projects listed'}
              </div>
            )}
            <FieldError name="special_projects" errors={validationErrors} />
          </dd>
        </div>

        {/* Professional Organizations */}
        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <dt className="text-sm font-semibold text-slate-600">
            Professional Organizations
            <div className="mt-1 text-xs text-slate-400 font-normal">
              List any professional groups or associations you belong to
            </div>
          </dt>
          <dd className="mt-1 text-sm text-slate-900 sm:mt-0">
            {isEditing ? (
              <textarea
                name="professional_organizations"
                id="professional_organizations"
                rows={3}
                value={profile.professional_organizations || ''}
                onChange={handleInputChange}
                placeholder="List organizations, associations, or professional groups you're affiliated with"
                className={getInputClass('professional_organizations')}
              />
            ) : (
              <div className="whitespace-pre-line">
                {profile.professional_organizations || 'No professional organizations listed'}
              </div>
            )}
            <FieldError name="professional_organizations" errors={validationErrors} />
          </dd>
        </div>
      </div>
    </div>
  );
}
