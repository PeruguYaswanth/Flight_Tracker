/**
 * Base URL for every backend call. The backend mounts all routes under
 * `/api` (see server/src/app.ts). VITE_API_BASE_URL may be given either as
 * the backend origin ("https://backend.example.com") or including the
 * prefix ("https://backend.example.com/api", "/api"); both resolve to
 * `<origin>/api`. Unset means same-origin `/api` (the Vite dev proxy).
 */
export const API_BASE_URL = (() => {
  const raw = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
})();
