export function normalizeApiOrigin(value) {
  if (!value) return '';
  let v = value.trim();
  v = v.endsWith('/') ? v.slice(0, -1) : v;
  // Accept either origin-only or origin+`/api/v1` env values.
  if (v.endsWith('/api/v1')) v = v.slice(0, -('/api/v1'.length));
  return v;
}

// No fallback origin. If neither variable is set, the build runs in preview mode.
export const API_ORIGIN = normalizeApiOrigin(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_ORIGIN || ''
);

// Preview mode: the screens render, but nothing is sent to any API.
// On when no API origin is configured, or when VITE_PREVIEW_MODE=true.
export const PREVIEW_MODE =
  !API_ORIGIN || String(import.meta.env.VITE_PREVIEW_MODE || '').toLowerCase() === 'true';

export const API_PREFIX = '/api/v1';

// Always use an explicit origin so dev/prod behave the same.
export const API_URL = PREVIEW_MODE ? '' : `${API_ORIGIN}${API_PREFIX}`;

export const REPO_URL = 'https://github.com/Tofuwuuu/Hyperledger-Document-Verification-';

// The backend keeps password reset off while the demo has no email sending.
// Set VITE_PASSWORD_RESET_ENABLED=true only when the server has it on too.
export const PASSWORD_RESET_ENABLED =
  String(import.meta.env.VITE_PASSWORD_RESET_ENABLED || '').toLowerCase() === 'true';

export const RESET_UNAVAILABLE_MESSAGE = "Password reset isn't available in the demo.";
