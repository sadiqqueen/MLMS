import { createContext, useContext, useState, useEffect } from 'react';

// Step 1: Create the "box" that holds the shared data.
// null is the default — before the Provider sets a value.
const AuthContext = createContext(null);

// Step 2: The Provider — a component that WRAPS the whole app (in App.jsx).
// Any component inside the Provider can read from the context.
export function AuthProvider({ children }) {

  const [user,    setUser   ] = useState(null);   // the logged-in user object
  const [token,   setToken  ] = useState(null);   // the JWT string
  const [loading, setLoading] = useState(true);   // true while we check localStorage on startup

  // On app load, check if the user was already logged in from a previous session.
  // localStorage survives page refresh, so the user doesn't need to log in every time.
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser  = localStorage.getItem('user');  // stored as a JSON string

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));   // parse the JSON string back into an object
    }

    setLoading(false);   // done checking — allow the app to render
  }, []);  // the empty [] means "run this only once, when the app first loads"

  // Called after a successful login API response
  const login = (tokenValue, userData) => {
    localStorage.setItem('token', tokenValue);
    localStorage.setItem('user', JSON.stringify(userData));  // must stringify objects
    setToken(tokenValue);
    setUser(userData);
  };

  // Called on logout — wipes everything
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    // Step 3: Provide the values — any component inside can read these
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Step 4: A convenience hook — instead of writing "useContext(AuthContext)"
// every time, components just write "const { user, logout } = useAuth()"
export const useAuth = () => useContext(AuthContext);
