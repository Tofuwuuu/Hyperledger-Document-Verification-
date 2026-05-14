export function normalizeApiOrigin(value) {
  if (!value) return '';
  let v = value.trim();
  v = v.endsWith('/') ? v.slice(0, -1) : v;
  // Accept either origin-only or origin+`/api/v1` env values.
  if (v.endsWith('/api/v1')) v = v.slice(0, -('/api/v1'.length));
  return v;
}

export const API_ORIGIN = normalizeApiOrigin(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_ORIGIN || 'http://localhost:8000'
);

export const API_PREFIX = '/api/v1';

// Always use an explicit origin so dev/prod behave the same.
export const API_URL = `${API_ORIGIN}${API_PREFIX}`;
