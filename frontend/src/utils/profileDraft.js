// Unsaved alumni profile edits kept across a session-expiry sign-in.
// sessionStorage only (never localStorage), keyed by user.
const PREFIX = 'alumni-profile-draft:';

export function saveProfileDraft(userId, profile) {
  if (!userId) return;
  try {
    sessionStorage.setItem(PREFIX + userId, JSON.stringify(profile));
  } catch (error) {
    console.error('Could not keep the profile draft:', error);
  }
}

export function readProfileDraft(userId) {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + userId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearProfileDraft(userId) {
  if (!userId) return;
  sessionStorage.removeItem(PREFIX + userId);
}

// Used by the deliberate Log out buttons.
export function clearAllProfileDrafts() {
  for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(PREFIX)) sessionStorage.removeItem(key);
  }
}
