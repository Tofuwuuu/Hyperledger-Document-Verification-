function normalizeApiOrigin(value) {
  if (!value) return '';
  let v = value.trim();
  v = v.endsWith('/') ? v.slice(0, -1) : v;
  // Accept either origin-only or origin+`/api/v1` env values.
  if (v.endsWith('/api/v1')) v = v.slice(0, -('/api/v1'.length));
  return v;
}

// Local-only build: prefer IPv4 loopback to avoid Docker/WSL localhost (::1) collisions.
export const API_ORIGIN = 'http://127.0.0.1:8000';

export const API_PREFIX = '/api/v1';

// Always use an explicit origin so dev/prod behave the same.
export const API_URL = `${API_ORIGIN}${API_PREFIX}`;
