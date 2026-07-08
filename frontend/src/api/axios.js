import axios from 'axios';
import { readCache, writeCache, isFresh, invalidate } from './cache';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

function toSafeUser(userData) {
  return userData ? {
    _id:         userData._id,
    name:        userData.name,
    email:       userData.email,
    role:        userData.role,
    initials:    userData.initials,
    photoUrl:    userData.photoUrl,
    hospital:    userData.hospital,
    hospitalId:  userData.hospitalId,
    specialtyId: userData.specialtyId,
    specialty:   userData.specialty,
    studentId:   userData.studentId,
    year:        userData.year,
    department:  userData.department,
    phone:       userData.phone,
  } : null;
}

// ── GET response cache (stale-time) ──────────────────────────────────────────
// Transparently caches successful GET responses in-memory (via ./cache) so that
// navigating away and back to a page within CACHE_TTL serves instantly instead
// of refetching — the per-page skeleton then only shows on the first (cold) load.
// Any successful mutation (POST/PATCH/PUT/DELETE) clears the cache so data can't
// go stale. Auth, notifications and non-JSON (file) responses are never cached.
const CACHE_TTL = 20_000; // 20s
const baseAdapter = axios.getAdapter(axios.defaults.adapter);

function cacheKey(config) {
  const params = config.params ? JSON.stringify(config.params) : '';
  return `GET ${config.baseURL || ''}${config.url}?${params}`;
}
function isCacheableGet(config) {
  if ((config.method || 'get').toLowerCase() !== 'get') return false;
  if (config.cache === false) return false;
  if (config.responseType && config.responseType !== 'json') return false;
  const url = config.url || '';
  return !url.includes('/api/auth/') && !url.includes('/api/notifications');
}

async function cachingAdapter(config) {
  if (isCacheableGet(config)) {
    const key = cacheKey(config);
    const hit = readCache(key);
    if (isFresh(hit, CACHE_TTL)) {
      return { data: JSON.parse(JSON.stringify(hit.data)), status: 200, statusText: 'OK (cache)', headers: {}, config, request: {} };
    }
    const res = await baseAdapter(config);
    if (res.status >= 200 && res.status < 300) writeCache(key, res.data);
    return res;
  }
  const res = await baseAdapter(config);
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get' && res.status >= 200 && res.status < 400) invalidate();
  return res;
}

const api = axios.create({
  baseURL: '',
  withCredentials: true,
  adapter: cachingAdapter
});

// ── REQUEST INTERCEPTOR ───────────────────────────────────────────────────
api.interceptors.request.use(config => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── RESPONSE INTERCEPTOR ──────────────────────────────────────────────────
api.interceptors.response.use(
  response => {
    const newToken = response.headers['x-new-access-token'];
    if (newToken) {
      setAccessToken(newToken);
    }
    return response;
  },
  async error => {
    const originalRequest = error.config;

    // Don't intercept auth endpoints — login errors must surface to the UI
    const isAuthEndpoint = originalRequest.url?.includes('/api/auth/login')
      || originalRequest.url?.includes('/api/auth/refresh')
      || originalRequest.url?.includes('/api/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        if (res.data?.token) {
          const newToken = res.data.token;
          setAccessToken(newToken);
          if (res.data.user) {
            localStorage.setItem('user', JSON.stringify(toSafeUser(res.data.user)));
          }
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch {
        setAccessToken(null);
        localStorage.removeItem('user');
        window.location.href = '/';
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401 && !isAuthEndpoint) {
      const hadSession = !!accessToken || !!localStorage.getItem('user');
      setAccessToken(null);
      localStorage.removeItem('user');
      if (hadSession) window.location.href = '/';
    }

    return Promise.reject(error);
  }
);

export default api;
