function normalizeApiOrigin(value) {
  if (!value) return '';
  let v = value.trim();
  v = v.endsWith('/') ? v.slice(0, -1) : v;
  // Accept either origin-only or origin+`/api/v1` env values.
  if (v.endsWith('/api/v1')) v = v.slice(0, -('/api/v1'.length));
  return v;
}

export const API_ORIGIN =
  normalizeApiOrigin(import.meta.env.VITE_API_URL) ||
  normalizeApiOrigin(import.meta.env.VITE_API_ORIGIN) ||
  'http://localhost:8000';

export const API_PREFIX = '/api/v1';

// In dev we prefer the Vite proxy. In prod we call the absolute URL.
export const API_URL = import.meta.env.DEV ? API_PREFIX : `${API_ORIGIN}${API_PREFIX}`;
