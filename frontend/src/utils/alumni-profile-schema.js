/*
Frontend Alumni Form Schema

This schema reflects the fields actually edited in AlumniProfilePage.jsx.
It is intentionally smaller than the dashboard profile schema.
*/

export const alumniProfileSchema = {
  user_id: '',
  full_name: '',
  email: '',
  student_id: '',
  phone: '',
  graduation_year: '',
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
  current_job: '',
  current_employer: '',
  course_other: '',
  department_other: ''
};

export const buildAlumniProfileData = (profileData = {}) => {
  return {
    ...alumniProfileSchema,
    ...profileData
  };
};
