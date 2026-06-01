import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = {
  super_admin:      '/admin/dashboard',
  secretary:        '/secretary/trainees',
  dio:              '/dio/dashboard',
  supervisor:       '/supervisor/trainees',
  doctor:           '/supervisor/trainees',
  trainee:          '/timeline',
  student:          '/timeline',
  president:        '/president/trainees',
  program_director: '/program-director/trainees',
  director:         '/president/trainees',
  admin:            '/admin/dashboard',
  professor:        '/admin/dashboard',
};

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to="/" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
  }

  return children;
}
