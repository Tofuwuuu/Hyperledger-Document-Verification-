// Field rules and copy for the alumni profile form. Pure functions so they
// can be checked without rendering anything.

export const MIN_GRADUATION_YEAR = 1948;

export const FIELD_MESSAGES = {
  email: 'Enter an email like name@example.com.',
  student_id: 'Use only letters, numbers, and hyphens.',
  graduation_year_format: 'Enter a 4-digit year.',
  graduation_year_min: 'Enter a year from 1948 on.',
  graduation_year_future: "Enter a year that's already passed.",
  // Server-only rejections (no client rule failed).
  student_id_in_use: 'That student ID is already used by another account.',
  server_rejected: "This couldn't be saved. Check it and try again.",
};

export const PHOTO_MESSAGES = {
  tooLarge: 'That photo is over 10 MB. Choose a smaller one.',
  wrongType: 'Use a JPG or PNG photo.',
  failed: "Couldn't upload that photo. Try again.",
};

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png'];

// Client-side check before upload; '' when the file is fine.
export function validatePhoto(file) {
  if (!file) return '';
  if (!PHOTO_TYPES.includes(file.type)) return PHOTO_MESSAGES.wrongType;
  if (file.size > MAX_PHOTO_BYTES) return PHOTO_MESSAGES.tooLarge;
  return '';
}

export function photoErrorForStatus(status) {
  if (status === 413) return PHOTO_MESSAGES.tooLarge;
  if (status === 415) return PHOTO_MESSAGES.wrongType;
  return PHOTO_MESSAGES.failed;
}

export const FORM_MESSAGES = {
  fixFields: 'Fix the fields marked in red, then save again.',
  serverUnmatched: "Some details couldn't be saved. Check the form and try again.",
  network: "Couldn't reach the server. Check your connection and try again.",
  generic: "Couldn't save your profile. Try again in a moment.",
  saved: 'Profile saved.',
  savedOnDevice: 'Profile saved on this device.',
  signedOut: "You've been signed out. Sign in again and your changes will still be here.",
  welcomeBack: 'Welcome back. Your changes are still here, so press Save to finish.',
};

// Every field that shows a FieldError, in on-screen order per tab.
const FORM_FIELDS_BY_TAB = {
  personal: ['full_name', 'student_id', 'email', 'sex', 'civil_status', 'birthday', 'region_of_origin', 'phone', 'address', 'bio'],
  education: ['department', 'course', 'batch', 'graduation_year', 'graduation_month', 'honors_awards'],
  eligibility: ['csc_passer', 'csc_year', 'professional_exams', 'certifications'],
  employment: [
    'is_employed', 'unemployment_reason', 'employment_status', 'occupation', 'company_name', 'company_address',
    'company_sector', 'business_line', 'work_location', 'is_first_job', 'stay_reasons', 'first_job_related',
    'first_job_reasons', 'first_job_tenure', 'first_job_acquisition', 'time_to_first_job', 'first_job_level',
    'current_job_level', 'initial_salary', 'curriculum_relevance_first', 'curriculum_relevance_current',
    'date_employed', 'monthly_salary',
  ],
  skills: ['skills', 'achievements', 'special_projects', 'professional_organizations'],
};
const FORM_FIELDS = Object.values(FORM_FIELDS_BY_TAB).flat();

// Fields with client-side rules.
const FIELD_NAMES = ['student_id', 'email', 'graduation_year'];

export const isValidatedField = (name) => FIELD_NAMES.includes(name);
export const isFormField = (name) => FORM_FIELDS.includes(name);

export const tabForField = (name) =>
  Object.keys(FORM_FIELDS_BY_TAB).find((tab) => FORM_FIELDS_BY_TAB[tab].includes(name));

// Returns the message for one field, or '' when the value is fine or empty
// (only filled-in values are checked).
export function validateField(name, rawValue, now = new Date()) {
  const value = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();
  if (!value) return '';

  if (name === 'email') {
    return /^\S+@\S+\.\S+$/.test(value) ? '' : FIELD_MESSAGES.email;
  }
  if (name === 'student_id') {
    return /^[A-Za-z0-9-]+$/.test(value) ? '' : FIELD_MESSAGES.student_id;
  }
  if (name === 'graduation_year') {
    if (!/^\d{4}$/.test(value)) return FIELD_MESSAGES.graduation_year_format;
    const year = Number(value);
    if (year < MIN_GRADUATION_YEAR) return FIELD_MESSAGES.graduation_year_min;
    if (year > now.getFullYear()) return FIELD_MESSAGES.graduation_year_future;
  }
  return '';
}

export function validateProfile(profile, now = new Date()) {
  const errors = {};
  FIELD_NAMES.forEach((name) => {
    const message = validateField(name, profile?.[name], now);
    if (message) errors[name] = message;
  });
  return errors;
}

// First errored field in on-screen order (tab order, then field order).
export function firstErroredField(errors) {
  return FORM_FIELDS.find((name) => errors[name]);
}

// Message for a field the server rejected. Never the server's own text:
// 1. a client rule fails for the current value: that rule's message;
// 2. the server says the student ID belongs to another account;
// 3. anything else: a general line under that field.
function serverFieldMessage(name, value, type) {
  const clientMessage = validateField(name, value);
  if (clientMessage) return clientMessage;
  if (name === 'student_id' && type === 'student_id_in_use') return FIELD_MESSAGES.student_id_in_use;
  return FIELD_MESSAGES.server_rejected;
}

// Maps a 409/422 `detail` (FastAPI list or a {field: message} object) to
// field messages. `unmatched` counts errors that don't belong to a form field.
export function mapServerErrors(detail, profile) {
  const fieldErrors = {};
  let unmatched = 0;
  const add = (name, type) => {
    if (isFormField(name)) {
      fieldErrors[name] = fieldErrors[name] || serverFieldMessage(name, profile?.[name], type);
    } else {
      unmatched += 1;
    }
  };

  if (Array.isArray(detail)) {
    detail.forEach((item) => {
      const loc = Array.isArray(item?.loc) ? item.loc : [];
      const name = [...loc].reverse().find((part) => typeof part === 'string' && part !== 'body');
      add(name, String(item?.type || ''));
    });
  } else if (detail && typeof detail === 'object') {
    Object.keys(detail).forEach((name) => add(name, ''));
  } else {
    unmatched += 1;
  }
  return { fieldErrors, unmatched };
}
