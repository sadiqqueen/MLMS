import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Reports from './pages/Reports';
import Grades from './pages/Grades';
import Timeline from './pages/Timeline';
import Profile from './pages/Profile';

import AdminDashboard from './pages/AdminDashboard';
import Users from './pages/Users';
import HospitalsUniversities from './pages/HospitalsUniversities';
import Distributions from './pages/Distributions';
import Certificates from './pages/Certificates';

import SupervisorTrainees from './pages/SupervisorTrainees';
import SupervisorReports from './pages/SupervisorReports';
import SupervisorEvaluations from './pages/SupervisorEvaluations';

import ProgramDirectorTrainees from './pages/ProgramDirectorTrainees';
import ProgramDirectorSupervisors from './pages/ProgramDirectorSupervisors';
import ProgramDirectorReports from './pages/ProgramDirectorReports';

import SecretaryTrainees from './pages/SecretaryTrainees';
import SecretarySupervisors from './pages/SecretarySupervisors';
import SecretaryProgramDirectors from './pages/SecretaryProgramDirectors';
import SecretaryHospitals from './pages/SecretaryHospitals';

import DioDashboard from './pages/DioDashboard';
import DioTrainees from './pages/DioTrainees';
import DioTraineeDetail from './pages/DioTraineeDetail';
import DioSupervisors from './pages/DioSupervisors';
import DioProgramDirectors from './pages/DioProgramDirectors';
import DioSecretaries from './pages/DioSecretaries';
import DioCertificates from './pages/DioCertificates';
import DioDistributions from './pages/DioDistributions';
import DioRotations from './pages/DioRotations';
import CertificatePrint from './pages/CertificatePrint';

import PresidentTrainees from './pages/PresidentTrainees';
import PresidentSupervisors from './pages/PresidentSupervisors';
import PresidentProgramDirectors from './pages/PresidentProgramDirectors';
import PresidentSecretaries from './pages/PresidentSecretaries';

import AdminSpecialties from './pages/AdminSpecialties';
import AuditLog from './pages/AuditLog';
import VerifyCertificate from './pages/VerifyCertificate';

const ROLE_HOME = {
  super_admin: '/admin/dashboard',
  secretary: '/secretary/trainees',
  dio: '/dio/dashboard',
  supervisor: '/supervisor/trainees',
  trainee: '/timeline',
  president: '/president/trainees',
  program_director: '/program-director/trainees',
};

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;

  if (user) return <Navigate to={ROLE_HOME[user.role] || '/timeline'} replace />;
  window.location.replace('/');
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/verify/:code" element={<VerifyCertificate />} />

          <Route path="/timeline" element={
            <ProtectedRoute allowedRoles={['trainee']}>
              <Timeline />
            </ProtectedRoute>
          } />
          <Route path="/Timeline" element={<Navigate to="/timeline" replace />} />
          <Route path="/reports" element={
            <ProtectedRoute allowedRoles={['trainee']}>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/grades" element={
            <ProtectedRoute allowedRoles={['trainee']}>
              <Grades />
            </ProtectedRoute>
          } />

          <Route path="/supervisor/trainees" element={
            <ProtectedRoute allowedRoles={['supervisor']}>
              <SupervisorTrainees />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/reports" element={
            <ProtectedRoute allowedRoles={['supervisor']}>
              <SupervisorReports />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/evaluations" element={
            <ProtectedRoute allowedRoles={['supervisor']}>
              <SupervisorEvaluations />
            </ProtectedRoute>
          } />

          <Route path="/program-director/trainees" element={
            <ProtectedRoute allowedRoles={['program_director']}>
              <ProgramDirectorTrainees />
            </ProtectedRoute>
          } />
          <Route path="/program-director/supervisors" element={
            <ProtectedRoute allowedRoles={['program_director']}>
              <ProgramDirectorSupervisors />
            </ProtectedRoute>
          } />
          <Route path="/program-director/reports" element={
            <ProtectedRoute allowedRoles={['program_director']}>
              <ProgramDirectorReports />
            </ProtectedRoute>
          } />

          <Route path="/secretary/trainees" element={
            <ProtectedRoute allowedRoles={['secretary']}>
              <SecretaryTrainees />
            </ProtectedRoute>
          } />
          <Route path="/secretary/supervisors" element={
            <ProtectedRoute allowedRoles={['secretary']}>
              <SecretarySupervisors />
            </ProtectedRoute>
          } />
          <Route path="/secretary/program-directors" element={
            <ProtectedRoute allowedRoles={['secretary']}>
              <SecretaryProgramDirectors />
            </ProtectedRoute>
          } />
          <Route path="/secretary/hospitals" element={
            <ProtectedRoute allowedRoles={['secretary']}>
              <SecretaryHospitals />
            </ProtectedRoute>
          } />

          <Route path="/dio/dashboard" element={
            <ProtectedRoute allowedRoles={['dio']}>
              <DioDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dio/trainees" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioTrainees />
            </ProtectedRoute>
          } />
          <Route path="/dio/trainees/:id" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioTraineeDetail />
            </ProtectedRoute>
          } />
          <Route path="/dio/supervisors" element={
            <ProtectedRoute allowedRoles={['dio']}>
              <DioSupervisors />
            </ProtectedRoute>
          } />
          <Route path="/dio/program-directors" element={
            <ProtectedRoute allowedRoles={['dio']}>
              <DioProgramDirectors />
            </ProtectedRoute>
          } />
          <Route path="/dio/secretaries" element={
            <ProtectedRoute allowedRoles={['dio']}>
              <DioSecretaries />
            </ProtectedRoute>
          } />
          <Route path="/dio/certificates" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioCertificates />
            </ProtectedRoute>
          } />
          <Route path="/dio/certificates/:id/print" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin', 'program_director', 'president']}>
              <CertificatePrint />
            </ProtectedRoute>
          } />
          <Route path="/dio/distributions" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioDistributions />
            </ProtectedRoute>
          } />
          <Route path="/dio/rotations" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioRotations />
            </ProtectedRoute>
          } />

          <Route path="/president/trainees" element={
            <ProtectedRoute allowedRoles={['president']}>
              <PresidentTrainees />
            </ProtectedRoute>
          } />
          <Route path="/president/supervisors" element={
            <ProtectedRoute allowedRoles={['president']}>
              <PresidentSupervisors />
            </ProtectedRoute>
          } />
          <Route path="/president/program-directors" element={
            <ProtectedRoute allowedRoles={['president']}>
              <PresidentProgramDirectors />
            </ProtectedRoute>
          } />
          <Route path="/president/secretaries" element={
            <ProtectedRoute allowedRoles={['president']}>
              <PresidentSecretaries />
            </ProtectedRoute>
          } />

          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['super_admin', 'dio']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Users />
            </ProtectedRoute>
          } />
          <Route path="/admin/hospitals" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <HospitalsUniversities />
            </ProtectedRoute>
          } />
          <Route path="/admin/distributions" element={
            <ProtectedRoute allowedRoles={['super_admin', 'secretary']}>
              <Distributions />
            </ProtectedRoute>
          } />
          <Route path="/admin/certificates" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Certificates />
            </ProtectedRoute>
          } />
          <Route path="/admin/specialties" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AdminSpecialties />
            </ProtectedRoute>
          } />
          <Route path="/admin/audit-log" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AuditLog />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['trainee', 'supervisor', 'program_director', 'secretary', 'dio', 'president', 'super_admin']}>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
