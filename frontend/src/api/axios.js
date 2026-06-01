import axios from 'axios';

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

const api = axios.create({
  baseURL: '',
  withCredentials: true
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
