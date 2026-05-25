import axios from 'axios';

const api = axios.create({
  baseURL: '',
  withCredentials: true
});

// ── REQUEST INTERCEPTOR ───────────────────────────────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── RESPONSE INTERCEPTOR ──────────────────────────────────────────────────
api.interceptors.response.use(
  response => {
    const newToken = response.headers['x-new-access-token'];
    if (newToken) {
      localStorage.setItem('token', newToken);
    }
    return response;
  },
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        if (res.data?.token) {
          const newToken = res.data.token;
          localStorage.setItem('token', newToken);
          if (res.data.user) {
            localStorage.setItem('user', JSON.stringify(res.data.user));
          }
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401) {
      const hadSession = !!localStorage.getItem('token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (hadSession) window.location.href = '/';
    }

    return Promise.reject(error);
  }
);

export default api;
