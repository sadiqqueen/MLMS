import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Maps each role to where they should land after login
const ROLE_HOME = {
  super_admin: '/admin/dashboard',
  admin:       '/admin/students',
  professor:   '/admin/dashboard',
  doctor:      '/doctor/students',
  student:     '/reports',
  director:    '/director/dashboard'
};

// This component wraps a page and decides if the user is allowed to see it.
// Usage in App.jsx:
//   <ProtectedRoute allowedRoles={['student']}>
//     <Dashboard />
//   </ProtectedRoute>
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  // While we're checking localStorage for an existing session, render nothing.
  // Without this, the app would flash the login page even if you're already logged in.
  if (loading) return null;

  // Not logged in → send to login page
  if (!user) return <Navigate to="/" replace />;

  // Logged in but wrong role → send to their correct homepage
  // e.g. a doctor trying to visit /dashboard (student route) goes to /doctor/dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
  }

  // ✅ All good — render the actual page
  return children;
}
