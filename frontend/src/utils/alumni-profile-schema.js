/*
Frontend Alumni Profile Schema

This schema defines all alumni profile fields that appear on the profile page.
It is used to normalize payloads before sending them to the backend API.
*/

export const alumniProfileSchema = {
  user_id: '',
  full_name: '',
  email: '',
  student_id: '',
  phone: '',
  graduation_year: new Date().getFullYear(),
  graduation_month: '',
  batch: '',
  course: '',
  department: '',
  sex: '',
  civil_status: '',
  address: '',
  birthday: '',
  region_of_origin: '',
  bio: '',
  profile_picture: '',
  social_media: [],
  honors_awards: '',
  degree_reasons: [],
  degree_reasons_other: '',
  advanced_studies: {
    level: '',
    institution: '',
    field: '',
    motivation: ''
  },
  csc_passer: null,
  csc_year: '',
  professional_exams: '',
  certifications: '',
  is_employed: '',
  unemployment_reason: [],
  employment_status: '',
  occupation: '',
  company_name: '',
  company_address: '',
  company_sector: '',
  business_line: '',
  work_location: '',
  is_first_job: null,
  stay_reasons: [],
  first_job_related: null,
  first_job_reasons: [],
  first_job_tenure: '',
  first_job_acquisition: '',
  time_to_first_job: '',
  first_job_level: '',
  current_job_level: '',
  initial_salary: '',
  monthly_salary: '',
  curriculum_relevance_first: '',
  curriculum_relevance_current: '',
  date_employed: '',
  skills: '',
  achievements: '',
  special_projects: '',
  professional_organizations: '',
  data_privacy_consent: false
};

export const buildAlumniProfileData = (profileData = {}) => {
  return {
    ...alumniProfileSchema,
    ...profileData
  };
};
