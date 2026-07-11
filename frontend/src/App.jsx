import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PrefsProvider } from './context/PrefsContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './pages/NotFound';
import { ROLE_HOME } from './config/roles';

import Reports from './pages/Reports';
import Grades from './pages/Grades';
import Timeline from './pages/Timeline';
import Profile from './pages/Profile';
import CertificatesCourses from './pages/CertificatesCourses';
import Research from './pages/Research';
import Notifications from './pages/Notifications';

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
import ProgramDirectorEvaluations from './pages/ProgramDirectorEvaluations';

import SecretaryTrainees from './pages/SecretaryTrainees';
import SecretarySupervisors from './pages/SecretarySupervisors';
import SecretaryHospitals from './pages/SecretaryHospitals';
import SecretaryResearch from './pages/SecretaryResearch';

import DioDashboard from './pages/DioDashboard';
import DioUsers from './pages/DioUsers';
import DioHospitals from './pages/DioHospitals';
import DioHospitalDetail from './pages/DioHospitalDetail';
import DioTraineeDetail from './pages/DioTraineeDetail';
import DioSupervisors from './pages/DioSupervisors';
import DioProgramDirectors from './pages/DioProgramDirectors';
import DioSecretaries from './pages/DioSecretaries';
import DioCertificates from './pages/DioCertificates';
import DioDistributions from './pages/DioDistributions';
import DioRotations from './pages/DioRotations';
import DioAssignments from './pages/DioAssignments';
import DioEvaluations from './pages/DioEvaluations';
import DioApprovals from './pages/DioApprovals';
import ConsultantMemo from './pages/ConsultantMemo';
import ConsultantMemoAll from './pages/ConsultantMemoAll';
import Initiatives from './pages/Initiatives';
import CertificatePrint from './pages/CertificatePrint';

import PresidentTrainees from './pages/PresidentTrainees';
import PresidentSupervisors from './pages/PresidentSupervisors';
import PresidentProgramDirectors from './pages/PresidentProgramDirectors';
import PresidentSecretaries from './pages/PresidentSecretaries';
import PresidentDios from './pages/PresidentDios';
import PresidentHospitals from './pages/PresidentHospitals';

import AdminSpecialties from './pages/AdminSpecialties';
import AuditLog from './pages/AuditLog';
import VerifyCertificate from './pages/VerifyCertificate';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;

  if (user) return <Navigate to={ROLE_HOME[user.role] || '/timeline'} replace />;
  window.location.replace('/');
  return null;
}

// Backward-compat redirect for the old trainee-card URL: the DIO trainee card
// now lives under the Users section (/dio/users/:id). <Navigate> can't
// interpolate :id, so we read it from the params here.
function LegacyTraineeRedirect({ prefix = '' }) {
  const { id } = useParams();
  return <Navigate to={`${prefix}/dio/users/${id}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <PrefsProvider>
      <BrowserRouter>
        <ErrorBoundary>
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
          <Route path="/certificates-courses" element={
            <ProtectedRoute allowedRoles={['trainee']}>
              <CertificatesCourses />
            </ProtectedRoute>
          } />
          <Route path="/research" element={
            <ProtectedRoute allowedRoles={['trainee']}>
              <Research />
            </ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute allowedRoles={['trainee']}>
              <Notifications />
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
          <Route path="/program-director/evaluations" element={
            <ProtectedRoute allowedRoles={['program_director']}>
              <ProgramDirectorEvaluations />
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
          <Route path="/secretary/hospitals" element={
            <ProtectedRoute allowedRoles={['secretary']}>
              <SecretaryHospitals />
            </ProtectedRoute>
          } />
          <Route path="/secretary/research" element={
            <ProtectedRoute allowedRoles={['secretary']}>
              <SecretaryResearch />
            </ProtectedRoute>
          } />

          <Route path="/dio/dashboard" element={
            <ProtectedRoute allowedRoles={['dio']}>
              <DioDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dio/users" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioUsers />
            </ProtectedRoute>
          } />
          <Route path="/dio/users/:id" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioTraineeDetail />
            </ProtectedRoute>
          } />
          <Route path="/dio/hospitals" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioHospitals />
            </ProtectedRoute>
          } />
          <Route path="/dio/hospitals/:id" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioHospitalDetail />
            </ProtectedRoute>
          } />
          {/* Legacy trainee routes — consolidated into the DIO Users section */}
          <Route path="/dio/trainees" element={<Navigate to="/dio/users" replace />} />
          <Route path="/dio/trainees/:id" element={<LegacyTraineeRedirect />} />
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
          <Route path="/dio/assignments" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioAssignments />
            </ProtectedRoute>
          } />
          <Route path="/dio/evaluations" element={
            <ProtectedRoute allowedRoles={['dio']}>
              <DioEvaluations />
            </ProtectedRoute>
          } />
          <Route path="/dio/approvals" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}>
              <DioApprovals />
            </ProtectedRoute>
          } />
          <Route path="/consultant-memo" element={
            <ProtectedRoute allowedRoles={['asg1', 'asg2']}>
              <ConsultantMemo />
            </ProtectedRoute>
          } />
          <Route path="/consultant-memo/all" element={
            <ProtectedRoute allowedRoles={['asg1', 'asg2']}>
              <ConsultantMemoAll />
            </ProtectedRoute>
          } />
          {/* Initiatives — ASG roles only (mirrors the backend 403 guard).
              The page also self-gates via useInitiativeAccess. */}
          <Route path="/initiatives" element={
            <ProtectedRoute allowedRoles={['asg1', 'asg2']}>
              <Initiatives />
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
          <Route path="/president/dios" element={
            <ProtectedRoute allowedRoles={['president']}>
              <PresidentDios />
            </ProtectedRoute>
          } />
          <Route path="/president/hospitals" element={
            <ProtectedRoute allowedRoles={['president']}>
              <PresidentHospitals />
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
          <Route path="/admin/certificates/:id/print" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <CertificatePrint />
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

          {/* ══════════════════════════════════════════════════════════
              BASIC TRAINING PORTAL — /basic/* mirrors the Advanced routes,
              reusing the same page components. Backend scopes b_* users to
              Basic-track data, so only the URL/role differ.
          ══════════════════════════════════════════════════════════ */}
          {/* Basic — trainee */}
          <Route path="/basic/timeline" element={
            <ProtectedRoute allowedRoles={['b_trainee']}><Timeline /></ProtectedRoute>
          } />
          <Route path="/basic/reports" element={
            <ProtectedRoute allowedRoles={['b_trainee']}><Reports /></ProtectedRoute>
          } />
          <Route path="/basic/grades" element={
            <ProtectedRoute allowedRoles={['b_trainee']}><Grades /></ProtectedRoute>
          } />
          <Route path="/basic/certificates-courses" element={
            <ProtectedRoute allowedRoles={['b_trainee']}><CertificatesCourses /></ProtectedRoute>
          } />
          <Route path="/basic/research" element={
            <ProtectedRoute allowedRoles={['b_trainee']}><Research /></ProtectedRoute>
          } />
          <Route path="/basic/notifications" element={
            <ProtectedRoute allowedRoles={['b_trainee']}><Notifications /></ProtectedRoute>
          } />

          {/* Basic — supervisor */}
          <Route path="/basic/supervisor/trainees" element={
            <ProtectedRoute allowedRoles={['b_supervisor']}><SupervisorTrainees /></ProtectedRoute>
          } />
          <Route path="/basic/supervisor/reports" element={
            <ProtectedRoute allowedRoles={['b_supervisor']}><SupervisorReports /></ProtectedRoute>
          } />
          <Route path="/basic/supervisor/evaluations" element={
            <ProtectedRoute allowedRoles={['b_supervisor']}><SupervisorEvaluations /></ProtectedRoute>
          } />

          {/* Basic — program director */}
          <Route path="/basic/program-director/trainees" element={
            <ProtectedRoute allowedRoles={['b_program_director']}><ProgramDirectorTrainees /></ProtectedRoute>
          } />
          <Route path="/basic/program-director/supervisors" element={
            <ProtectedRoute allowedRoles={['b_program_director']}><ProgramDirectorSupervisors /></ProtectedRoute>
          } />
          <Route path="/basic/program-director/reports" element={
            <ProtectedRoute allowedRoles={['b_program_director']}><ProgramDirectorReports /></ProtectedRoute>
          } />
          <Route path="/basic/program-director/evaluations" element={
            <ProtectedRoute allowedRoles={['b_program_director']}><ProgramDirectorEvaluations /></ProtectedRoute>
          } />

          {/* Basic — secretary */}
          <Route path="/basic/secretary/trainees" element={
            <ProtectedRoute allowedRoles={['b_secretary']}><SecretaryTrainees /></ProtectedRoute>
          } />
          <Route path="/basic/secretary/supervisors" element={
            <ProtectedRoute allowedRoles={['b_secretary']}><SecretarySupervisors /></ProtectedRoute>
          } />
          <Route path="/basic/secretary/hospitals" element={
            <ProtectedRoute allowedRoles={['b_secretary']}><SecretaryHospitals /></ProtectedRoute>
          } />
          <Route path="/basic/secretary/research" element={
            <ProtectedRoute allowedRoles={['b_secretary']}><SecretaryResearch /></ProtectedRoute>
          } />

          {/* Basic — DIO */}
          <Route path="/basic/dio/dashboard" element={
            <ProtectedRoute allowedRoles={['b_dio']}><DioDashboard /></ProtectedRoute>
          } />
          <Route path="/basic/dio/users" element={
            <ProtectedRoute allowedRoles={['b_dio', 'super_admin']}><DioUsers /></ProtectedRoute>
          } />
          <Route path="/basic/dio/users/:id" element={
            <ProtectedRoute allowedRoles={['b_dio', 'super_admin']}><DioTraineeDetail /></ProtectedRoute>
          } />
          <Route path="/basic/dio/hospitals" element={
            <ProtectedRoute allowedRoles={['b_dio', 'super_admin']}><DioHospitals /></ProtectedRoute>
          } />
          <Route path="/basic/dio/hospitals/:id" element={
            <ProtectedRoute allowedRoles={['b_dio', 'super_admin']}><DioHospitalDetail /></ProtectedRoute>
          } />
          {/* Legacy trainee routes — consolidated into the DIO Users section */}
          <Route path="/basic/dio/trainees" element={<Navigate to="/basic/dio/users" replace />} />
          <Route path="/basic/dio/trainees/:id" element={<LegacyTraineeRedirect prefix="/basic" />} />
          <Route path="/basic/dio/supervisors" element={
            <ProtectedRoute allowedRoles={['b_dio']}><DioSupervisors /></ProtectedRoute>
          } />
          <Route path="/basic/dio/program-directors" element={
            <ProtectedRoute allowedRoles={['b_dio']}><DioProgramDirectors /></ProtectedRoute>
          } />
          <Route path="/basic/dio/secretaries" element={
            <ProtectedRoute allowedRoles={['b_dio']}><DioSecretaries /></ProtectedRoute>
          } />
          <Route path="/basic/dio/certificates" element={
            <ProtectedRoute allowedRoles={['b_dio', 'super_admin']}><DioCertificates /></ProtectedRoute>
          } />
          <Route path="/basic/dio/certificates/:id/print" element={
            <ProtectedRoute allowedRoles={['b_dio', 'super_admin', 'b_program_director', 'b_president']}><CertificatePrint /></ProtectedRoute>
          } />
          <Route path="/basic/dio/distributions" element={
            <ProtectedRoute allowedRoles={['b_dio', 'super_admin']}><DioDistributions /></ProtectedRoute>
          } />
          <Route path="/basic/dio/rotations" element={
            <ProtectedRoute allowedRoles={['b_dio', 'super_admin']}><DioRotations /></ProtectedRoute>
          } />
          <Route path="/basic/dio/assignments" element={
            <ProtectedRoute allowedRoles={['b_dio', 'super_admin']}><DioAssignments /></ProtectedRoute>
          } />
          <Route path="/basic/dio/evaluations" element={
            <ProtectedRoute allowedRoles={['b_dio']}><DioEvaluations /></ProtectedRoute>
          } />
          <Route path="/basic/dio/approvals" element={
            <ProtectedRoute allowedRoles={['b_dio', 'super_admin']}><DioApprovals /></ProtectedRoute>
          } />

          {/* Basic — president */}
          <Route path="/basic/president/trainees" element={
            <ProtectedRoute allowedRoles={['b_president']}><PresidentTrainees /></ProtectedRoute>
          } />
          <Route path="/basic/president/supervisors" element={
            <ProtectedRoute allowedRoles={['b_president']}><PresidentSupervisors /></ProtectedRoute>
          } />
          <Route path="/basic/president/program-directors" element={
            <ProtectedRoute allowedRoles={['b_president']}><PresidentProgramDirectors /></ProtectedRoute>
          } />
          <Route path="/basic/president/secretaries" element={
            <ProtectedRoute allowedRoles={['b_president']}><PresidentSecretaries /></ProtectedRoute>
          } />
          <Route path="/basic/president/dios" element={
            <ProtectedRoute allowedRoles={['b_president']}><PresidentDios /></ProtectedRoute>
          } />
          <Route path="/basic/president/hospitals" element={
            <ProtectedRoute allowedRoles={['b_president']}><PresidentHospitals /></ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['trainee', 'supervisor', 'program_director', 'secretary', 'dio', 'president', 'super_admin', 'b_trainee', 'b_supervisor', 'b_program_director', 'b_secretary', 'b_dio', 'b_president']}>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
      </PrefsProvider>
    </AuthProvider>
  );
}
