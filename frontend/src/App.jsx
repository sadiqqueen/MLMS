import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// ── EXISTING PAGES (kept from V1 — still work) ────────────────────────────
import Dashboard             from './pages/Dashboard';
import Reports               from './pages/Reports';
import Grades                from './pages/Grades';
import Timeline              from './pages/Timeline';
import Profile               from './pages/Profile';

import AdminDashboard        from './pages/AdminDashboard';
import AdminDoctors          from './pages/AdminDoctors';
import Users                 from './pages/Users';
import HospitalsUniversities from './pages/HospitalsUniversities';
import Distributions         from './pages/Distributions';
import Certificates          from './pages/Certificates';

import DoctorStudents        from './pages/DoctorStudents';
import DoctorReports         from './pages/DoctorReports';
import DoctorEvaluations     from './pages/DoctorEvaluations';

import DirectorDashboard     from './pages/DirectorDashboard';
import DirectorDoctors       from './pages/DirectorDoctors';
import DirectorCertificates  from './pages/DirectorCertificates';
import Students              from './pages/Students';

// ── NEW V2 PAGES ──────────────────────────────────────────────────────────

// Supervisor
import SupervisorTrainees    from './pages/SupervisorTrainees';
import SupervisorReports     from './pages/SupervisorReports';
import SupervisorEvaluations from './pages/SupervisorEvaluations';

// Program Director
import ProgramDirectorTrainees    from './pages/ProgramDirectorTrainees';
import ProgramDirectorSupervisors from './pages/ProgramDirectorSupervisors';
import ProgramDirectorReports     from './pages/ProgramDirectorReports';

// Secretary
import SecretaryTrainees         from './pages/SecretaryTrainees';
import SecretarySupervisors      from './pages/SecretarySupervisors';
import SecretaryProgramDirectors from './pages/SecretaryProgramDirectors';
import SecretaryHospitals        from './pages/SecretaryHospitals';

// DIO
import DioDashboard        from './pages/DioDashboard';
import DioTrainees         from './pages/DioTrainees';
import DioSupervisors      from './pages/DioSupervisors';
import DioProgramDirectors from './pages/DioProgramDirectors';
import DioSecretaries      from './pages/DioSecretaries';
import DioCertificates     from './pages/DioCertificates';

// President
import PresidentTrainees          from './pages/PresidentTrainees';
import PresidentSupervisors       from './pages/PresidentSupervisors';
import PresidentProgramDirectors  from './pages/PresidentProgramDirectors';
import PresidentSecretaries       from './pages/PresidentSecretaries';

// Admin V2
import AdminSpecialties from './pages/AdminSpecialties';
import AuditLog         from './pages/AuditLog';

// Public
import VerifyCertificate from './pages/VerifyCertificate';

// ── ROOT REDIRECT ──────────────────────────────────────────────────────────
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;

  const ROLE_HOME = {
    super_admin:      '/admin/dashboard',
    secretary:        '/secretary/trainees',
    dio:              '/dio/dashboard',
    supervisor:       '/supervisor/trainees',
    trainee:          '/timeline',
    president:        '/president/trainees',
    program_director: '/program-director/trainees',
    // Legacy V1 roles
    admin:     '/admin/students',
    professor: '/admin/dashboard',
    doctor:    '/doctor/students',
    student:   '/timeline',
    director:  '/director/dashboard',
  };

  if (user) return <Navigate to={ROLE_HOME[user.role] || '/timeline'} replace />;
  window.location.replace('/');
  return null;
}

// ── APP ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── PUBLIC ── */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/verify/:code" element={<VerifyCertificate />} />

          {/* ── TRAINEE (was student) ── */}
          <Route path="/timeline" element={
            <ProtectedRoute allowedRoles={['trainee', 'student']}>
              <Timeline />
            </ProtectedRoute>
          } />
          <Route path="/Timeline" element={<Navigate to="/timeline" replace />} />
          <Route path="/reports" element={
            <ProtectedRoute allowedRoles={['trainee', 'student']}>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/grades" element={
            <ProtectedRoute allowedRoles={['trainee', 'student']}>
              <Grades />
            </ProtectedRoute>
          } />

          {/* ── SUPERVISOR (was doctor) ── */}
          <Route path="/supervisor/trainees" element={
            <ProtectedRoute allowedRoles={['supervisor', 'doctor']}>
              <SupervisorTrainees />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/reports" element={
            <ProtectedRoute allowedRoles={['supervisor', 'doctor']}>
              <SupervisorReports />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/evaluations" element={
            <ProtectedRoute allowedRoles={['supervisor', 'doctor']}>
              <SupervisorEvaluations />
            </ProtectedRoute>
          } />

          {/* Legacy doctor routes — redirect to supervisor */}
          <Route path="/doctor/students"    element={<Navigate to="/supervisor/trainees"    replace />} />
          <Route path="/doctor/reports"     element={<Navigate to="/supervisor/reports"     replace />} />
          <Route path="/doctor/evaluations" element={<Navigate to="/supervisor/evaluations" replace />} />

          {/* ── PROGRAM DIRECTOR (new role) ── */}
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

          {/* ── SECRETARY (was admin) ── */}
          <Route path="/secretary/trainees" element={
            <ProtectedRoute allowedRoles={['secretary', 'admin']}>
              <SecretaryTrainees />
            </ProtectedRoute>
          } />
          <Route path="/secretary/supervisors" element={
            <ProtectedRoute allowedRoles={['secretary', 'admin']}>
              <SecretarySupervisors />
            </ProtectedRoute>
          } />
          <Route path="/secretary/program-directors" element={
            <ProtectedRoute allowedRoles={['secretary', 'admin']}>
              <SecretaryProgramDirectors />
            </ProtectedRoute>
          } />
          <Route path="/secretary/hospitals" element={
            <ProtectedRoute allowedRoles={['secretary', 'admin']}>
              <SecretaryHospitals />
            </ProtectedRoute>
          } />

          {/* Legacy admin routes — redirect to secretary */}
          <Route path="/admin/students" element={<Navigate to="/secretary/trainees"    replace />} />
          <Route path="/admin/doctors"  element={<Navigate to="/secretary/supervisors" replace />} />

          {/* ── DIO (was professor) ── */}
          <Route path="/dio/dashboard" element={
            <ProtectedRoute allowedRoles={['dio', 'professor']}>
              <DioDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dio/trainees" element={
            <ProtectedRoute allowedRoles={['dio', 'professor']}>
              <DioTrainees />
            </ProtectedRoute>
          } />
          <Route path="/dio/supervisors" element={
            <ProtectedRoute allowedRoles={['dio', 'professor']}>
              <DioSupervisors />
            </ProtectedRoute>
          } />
          <Route path="/dio/program-directors" element={
            <ProtectedRoute allowedRoles={['dio', 'professor']}>
              <DioProgramDirectors />
            </ProtectedRoute>
          } />
          <Route path="/dio/secretaries" element={
            <ProtectedRoute allowedRoles={['dio', 'professor']}>
              <DioSecretaries />
            </ProtectedRoute>
          } />
          <Route path="/dio/certificates" element={
            <ProtectedRoute allowedRoles={['dio', 'professor', 'super_admin']}>
              <DioCertificates />
            </ProtectedRoute>
          } />

          {/* ── PRESIDENT (was director) ── */}
          <Route path="/president/trainees" element={
            <ProtectedRoute allowedRoles={['president', 'director']}>
              <PresidentTrainees />
            </ProtectedRoute>
          } />
          <Route path="/president/supervisors" element={
            <ProtectedRoute allowedRoles={['president', 'director']}>
              <PresidentSupervisors />
            </ProtectedRoute>
          } />
          <Route path="/president/program-directors" element={
            <ProtectedRoute allowedRoles={['president', 'director']}>
              <PresidentProgramDirectors />
            </ProtectedRoute>
          } />
          <Route path="/president/secretaries" element={
            <ProtectedRoute allowedRoles={['president', 'director']}>
              <PresidentSecretaries />
            </ProtectedRoute>
          } />

          {/* Legacy director routes — redirect to president */}
          <Route path="/director/dashboard"    element={<Navigate to="/president/trainees"    replace />} />
          <Route path="/director/doctors"      element={<Navigate to="/president/supervisors" replace />} />
          <Route path="/director/certificates" element={<Navigate to="/dio/certificates"      replace />} />

          {/* ── SUPER ADMIN ── */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['super_admin', 'professor', 'dio']}>
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

          {/* ── SHARED ── */}
          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['trainee','supervisor','program_director','secretary','dio','president','super_admin','student','doctor','admin','professor','director']}>
              <Profile />
            </ProtectedRoute>
          } />

          {/* ── CATCH ALL ── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
