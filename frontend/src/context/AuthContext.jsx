import { createContext, useContext, useState, useEffect, useRef } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser   ] = useState(null);
  const [token,   setToken  ] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  const toSafeUser = (userData) => userData ? {
    _id:      userData._id,
    name:     userData.name,
    email:    userData.email,
    role:     userData.role,
    initials: userData.initials,
    photoUrl: userData.photoUrl,
  } : null;

  useEffect(() => {
    fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.token && data?.user) {
          const safeUser = toSafeUser(data.user);
          setToken(data.token);
          setUser(safeUser);
          localStorage.setItem('user', JSON.stringify(safeUser));
          scheduleRefresh(data.token);
        } else {
          localStorage.removeItem('user');
        }
      })
      .catch(() => localStorage.removeItem('user'))
      .finally(() => setLoading(false));

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
            const safeUser = toSafeUser(data.user);
            setUser(safeUser);
            localStorage.setItem('user', JSON.stringify(safeUser));
          }
          scheduleRefresh(data.token);
        }
      } catch {}
    }, 14 * 60 * 1000);
  }

  const login = (tokenValue, userData) => {
    const safeUser = toSafeUser(userData);
    setToken(tokenValue);
    setUser(safeUser);
    localStorage.setItem('user', JSON.stringify(safeUser));
    scheduleRefresh(tokenValue);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    localStorage.removeItem('user');
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setToken(null);
    setUser(null);
    window.location.href = '/';
  };

  const updateToken = (newToken, newUser) => {
    setToken(newToken);
    if (newUser) {
      const safeUser = toSafeUser(newUser);
      setUser(safeUser);
      localStorage.setItem('user', JSON.stringify(safeUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, updateToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
