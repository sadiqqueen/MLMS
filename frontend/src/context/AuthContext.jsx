import { createContext, useContext, useState, useEffect, useRef } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser   ] = useState(null);
  const [token,   setToken  ] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser  = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setLoading(false);
      scheduleRefresh(storedToken);
    } else {
      fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.token && data?.user) {
            setToken(data.token);
            setUser(data.user);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            scheduleRefresh(data.token);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  function scheduleRefresh(currentToken) {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.token) {
          setToken(data.token);
          if (data.user) {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
          }
          localStorage.setItem('token', data.token);
          scheduleRefresh(data.token);
        }
      } catch {}
    }, 14 * 60 * 1000);
  }

  const login = (tokenValue, userData) => {
    localStorage.setItem('token', tokenValue);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(tokenValue);
    setUser(userData);
    scheduleRefresh(tokenValue);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setToken(null);
    setUser(null);
    window.location.href = '/';
  };

  const updateToken = (newToken, newUser) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
    if (newUser) {
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, updateToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
