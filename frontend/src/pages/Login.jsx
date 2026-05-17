import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

// Each role has a different home page after login
const ROLE_HOME = {
  super_admin: '/admin/dashboard',
  admin:       '/admin/students',
  professor:   '/admin/dashboard',
  doctor:      '/doctor/students',
  student:     '/Timeline',
  director:    '/director/dashboard',
};

export default function Login() {
  // useState gives a variable + a function to change it.
  // When the variable changes, React re-renders the component automatically.
  const [email,    setEmail   ] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass ] = useState(false);
  const [error,    setError   ] = useState('');
  const [loading,  setLoading ] = useState(false);

  const { login }  = useAuth();     // our login function from AuthContext
  const navigate   = useNavigate(); // lets us redirect programmatically

  async function handleSubmit(e) {
    e.preventDefault();   // stop the browser's default form submission (page reload)
    setError('');
    setLoading(true);

    try {
      // Send the email + password to the server
      const res = await api.post('/api/auth/login', { email, password });
      // res.data = { token: "...", user: { ... } }

      login(res.data.token, res.data.user);   // save to localStorage + context state

      // Redirect to the right page based on role
      navigate(ROLE_HOME[res.data.user.role] || '/dashboard');

    } catch (err) {
      // err.response.data.message is what the server sent back (e.g. "Invalid email or password")
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);   // always runs, even if there was an error
    }
  }

  return (
    <div className="login-page">

      {/* LEFT PANEL — branding */}
      <div className="login-left">
        <img src="logo.png" alt="MLMS" className="login-logo-img" style={{
          position: "relative",
          left: "10px",
          top: "-10px",


        }} />
          <p
            className="brand-sub"
            style={{
            position: "relative",
            left: "0px",
            top: "-40px",
            color: "white"
          }}
          >
          Medical Learning System<br />
          for medical residents
          </p>
      </div>

      {/* RIGHT PANEL — login form */}
      <div className="login-right">
        <div className="form-wrap">
          <div className="form-logo-wrap">
          </div>

          {/* onSubmit fires when the user presses Enter or clicks the button */}
          <form onSubmit={handleSubmit}>

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}  // update state on every keystroke
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                {/* type switches between "password" (dots) and "text" (visible) */}
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="eye-btn" onClick={() => setShowPass(v => !v)}>
                  {showPass ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            {/* Only rendered if there's an error message */}
            {error && <p className="error-msg">{error}</p>}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>

          </form>

          <p className="forgot">Forgot your password? Contact your administrator.</p>
        </div>
      </div>

    </div>
  );
}
