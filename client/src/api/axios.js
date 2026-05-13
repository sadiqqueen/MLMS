import axios from 'axios';

// We create a custom axios "instance" with a shared base URL.
// Instead of writing "http://localhost:5000/api/auth/login" every time,
// we just write "/api/auth/login" and the baseURL gets prepended automatically.
const api = axios.create({
  baseURL: 'http://localhost:5000'
});

// ── REQUEST INTERCEPTOR ───────────────────────────────────────────────────
// An interceptor is code that runs on EVERY request, automatically.
// Here we attach the JWT token to every outgoing request as a header.
// This is how the server knows who is making the request.
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  // localStorage is a key/value store in the browser that survives page refresh.
  // We save the JWT token here after login.

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // The server's auth middleware reads this header to verify the user
  }
  return config;
});

// ── RESPONSE INTERCEPTOR ──────────────────────────────────────────────────
// Runs on EVERY response that comes back from the server.
// If the server returns 401 (Unauthorized — token expired or invalid),
// we automatically clear the session and send the user back to the login page.
api.interceptors.response.use(
  response => response,   // success — just pass it through unchanged
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';   // force redirect to login
    }
    return Promise.reject(error);   // still pass the error to the calling code
  }
);

export default api;
