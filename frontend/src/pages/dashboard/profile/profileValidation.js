// Field rules and copy for the alumni profile form. Pure functions so they
// can be checked without rendering anything.

export const MIN_GRADUATION_YEAR = 1948;

export const FIELD_MESSAGES = {
  email: 'Enter an email like name@example.com.',
  student_id: 'Use only letters, numbers, and hyphens.',
  graduation_year_format: 'Enter a 4-digit year.',
  graduation_year_min: 'Enter a year from 1948 on.',
  graduation_year_future: "Enter a year that's already passed.",
};

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

// Validated fields in on-screen order, with the tab each one lives on.
export const VALIDATED_FIELDS = [
  { name: 'student_id', tab: 'personal' },
  { name: 'email', tab: 'personal' },
  { name: 'graduation_year', tab: 'education' },
];

const FIELD_NAMES = VALIDATED_FIELDS.map((field) => field.name);

export const isValidatedField = (name) => FIELD_NAMES.includes(name);

export const tabForField = (name) =>
  VALIDATED_FIELDS.find((field) => field.name === name)?.tab;

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
  return FIELD_NAMES.find((name) => errors[name]);
}

// Server-side message for a field we know. Prefer what the client rules say
// about the current value; otherwise pick by the error type. Never returns
// the server's own text.
function serverFieldMessage(name, value, type = '') {
  const clientMessage = validateField(name, value);
  if (clientMessage) return clientMessage;
  if (name === 'email') return FIELD_MESSAGES.email;
  if (name === 'student_id') return FIELD_MESSAGES.student_id;
  if (/greater_than|too_small|min/.test(type)) return FIELD_MESSAGES.graduation_year_min;
  if (/less_than|too_big|max|future/.test(type)) return FIELD_MESSAGES.graduation_year_future;
  return FIELD_MESSAGES.graduation_year_format;
}

// Maps a 422 `detail` (FastAPI list or a {field: message} object) to field
// messages. `unmatched` counts errors that don't belong to a known field.
export function mapServerErrors(detail, profile) {
  const fieldErrors = {};
  let unmatched = 0;
  const add = (name, type) => {
    if (isValidatedField(name)) {
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
