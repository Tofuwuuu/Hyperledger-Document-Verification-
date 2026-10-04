import {
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { PROFILE_TABS } from './profileOptions';

// Summary card: photo, name, quick facts, completion, and tab navigation.
export default function ProfileHeader({
  activeTab,
  completedRequired,
  completionColor,
  completionPercentage,
  completionTone,
  getDisplayValue,
  isEditing,
  missingRequiredCount,
  previewUrl,
  profile,
  profileFacts,
  profileInitials,
  requiredFields,
  setActiveTab,
  startEditing,
  statusText,
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-cvsu-green shadow-sm">
              {previewUrl ? (
                <img src={previewUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-white">
                  {profileInitials || 'A'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-semibold text-slate-950">
                  {profile.full_name || 'Alumni Profile'}
                </h2>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${completionTone}`}>
                  {statusText}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {getDisplayValue(profile.course, 'Complete your profile details to keep alumni records current')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 ring-1 ring-slate-200">
                  <IdentificationIcon className="h-4 w-4 text-cvsu-green" />
                  {getDisplayValue(profile.student_id, 'Student ID pending')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 ring-1 ring-slate-200">
                  <CalendarDaysIcon className="h-4 w-4 text-cvsu-green" />
                  {getDisplayValue(profile.graduation_year || profile.batch, 'Batch pending')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 ring-1 ring-slate-200">
                  <BriefcaseIcon className="h-4 w-4 text-cvsu-green" />
                  {getDisplayValue(profile.is_employed, 'Employment pending')}
                </span>
              </div>
            </div>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center justify-center rounded-lg bg-cvsu-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cvsu-green/90 focus:outline-none focus:ring-2 focus:ring-cvsu-green focus:ring-offset-2"
            >
              <PencilIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {profileFacts.map((fact) => {
            const Icon = fact.icon;
            return (
              <div key={fact.label} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Icon className="h-4 w-4 text-cvsu-green" />
                  {fact.label}
                </div>
                <p className="mt-2 break-words text-sm font-semibold text-slate-950">{fact.value}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Profile Completion</p>
              <p className="mt-1 text-xs text-slate-500">{completedRequired} of {requiredFields.length} required fields complete</p>
            </div>
            <span className="text-2xl font-semibold text-slate-950">{completionPercentage}%</span>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`${completionColor} h-full rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-slate-600">Status: {statusText}</span>
            {missingRequiredCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                <ExclamationTriangleIcon className="h-4 w-4" />
                {missingRequiredCount} missing
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <CheckCircleIcon className="h-4 w-4" />
                Required complete
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-2 overflow-x-auto py-3" aria-label="Tabs">
          {PROFILE_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-cvsu-green text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.name}</span>
                <span className="sm:hidden">{tab.shortName}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
