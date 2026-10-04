import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import useAlumniProfile from './profile/useAlumniProfile';
import ProfileHeader from './profile/ProfileHeader';
import PersonalInfoTab from './profile/PersonalInfoTab';
import EducationTab from './profile/EducationTab';
import EligibilityTab from './profile/EligibilityTab';
import EmploymentTab from './profile/EmploymentTab';
import SkillsTab from './profile/SkillsTab';
import ProfileActionBar from './profile/ProfileActionBar';

export default function ProfilePage() {
  const {
    activeTab,
    addSocialMedia,
    cancelEditing,
    completedRequired,
    completionColor,
    completionPercentage,
    completionTone,
    courseOptions,
    errorMessage,
    getCourseOptionLabel,
    getCourseOptionValue,
    getDisplayValue,
    getFieldValue,
    getInputClass,
    handleInputChange,
    handleProfilePictureChange,
    handleSocialMediaChange,
    handleUnemploymentReasonChange,
    isEditing,
    isUploading,
    loading,
    missingRequiredCount,
    previewUrl,
    profile,
    profileFacts,
    profileInitials,
    profilePicture,
    removeSocialMedia,
    requiredFields,
    saveProfile,
    setActiveTab,
    setProfile,
    startEditing,
    statusText,
    successMessage,
    uploadProfilePicture,
    validationErrors,
  } = useAlumniProfile();

  if (loading && !isEditing) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cvsu-green"></div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-7xl space-y-6">
      <ProfileHeader
        activeTab={activeTab}
        completedRequired={completedRequired}
        completionColor={completionColor}
        completionPercentage={completionPercentage}
        completionTone={completionTone}
        getDisplayValue={getDisplayValue}
        isEditing={isEditing}
        missingRequiredCount={missingRequiredCount}
        previewUrl={previewUrl}
        profile={profile}
        profileFacts={profileFacts}
        profileInitials={profileInitials}
        requiredFields={requiredFields}
        setActiveTab={setActiveTab}
        startEditing={startEditing}
        statusText={statusText}
      />

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3">
            <CheckIcon className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-3">
            <XMarkIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="text-sm font-medium text-red-800">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Profile content */}
      <div>
        <dl>
          {/* Personal Information Tab Content */}
          {activeTab === 'personal' && (
            <PersonalInfoTab
              addSocialMedia={addSocialMedia}
              getInputClass={getInputClass}
              handleInputChange={handleInputChange}
              handleProfilePictureChange={handleProfilePictureChange}
              handleSocialMediaChange={handleSocialMediaChange}
              isEditing={isEditing}
              isUploading={isUploading}
              previewUrl={previewUrl}
              profile={profile}
              profileInitials={profileInitials}
              profilePicture={profilePicture}
              removeSocialMedia={removeSocialMedia}
              uploadProfilePicture={uploadProfilePicture}
              validationErrors={validationErrors}
            />
          )}

          {/* Educational Background Tab Content */}
          {activeTab === 'education' && (
            <EducationTab
              courseOptions={courseOptions}
              getCourseOptionLabel={getCourseOptionLabel}
              getCourseOptionValue={getCourseOptionValue}
              getFieldValue={getFieldValue}
              getInputClass={getInputClass}
              handleInputChange={handleInputChange}
              isEditing={isEditing}
              profile={profile}
              setProfile={setProfile}
              validationErrors={validationErrors}
            />
          )}

          {/* Add placeholder sections for other tabs */}
          {activeTab === 'eligibility' && (
            <EligibilityTab
              getInputClass={getInputClass}
              handleInputChange={handleInputChange}
              isEditing={isEditing}
              profile={profile}
              validationErrors={validationErrors}
            />
          )}

          {activeTab === 'employment' && (
            <EmploymentTab
              getInputClass={getInputClass}
              handleInputChange={handleInputChange}
              handleUnemploymentReasonChange={handleUnemploymentReasonChange}
              isEditing={isEditing}
              profile={profile}
              setProfile={setProfile}
              validationErrors={validationErrors}
            />
          )}

          {activeTab === 'skills' && (
            <SkillsTab
              getInputClass={getInputClass}
              handleInputChange={handleInputChange}
              isEditing={isEditing}
              profile={profile}
              validationErrors={validationErrors}
            />
          )}
        </dl>
      </div>

      {/* Add sticky action bar at the bottom */}
      {isEditing && (
        <ProfileActionBar
          cancelEditing={cancelEditing}
          errorMessage={errorMessage}
          loading={loading}
          saveProfile={saveProfile}
        />
      )}
      
      {/* Add padding at the bottom when editing to prevent content from being hidden behind the action bar */}
      {isEditing && <div className="pb-16"></div>}
    </div>
  );
}
