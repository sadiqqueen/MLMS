import { lazy, Suspense } from 'react';
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
import AdminSystem from './pages/AdminSystem';

import SupervisorTrainees from './pages/SupervisorTrainees';
import SupervisorReports from './pages/SupervisorReports';
import SupervisorEvaluations from './pages/SupervisorEvaluations';
import SupervisorResearch from './pages/SupervisorResearch';

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
import ConsultantMemoApproved from './pages/ConsultantMemoApproved';
import Initiatives from './pages/Initiatives';
import CertificatePrint from './pages/CertificatePrint';

import PresidentTrainees from './pages/PresidentTrainees';
import PresidentSupervisors from './pages/PresidentSupervisors';
import PresidentProgramDirectors from './pages/PresidentProgramDirectors';
import PresidentSecretaries from './pages/PresidentSecretaries';
import PresidentDios from './pages/PresidentDios';
import PresidentHospitals from './pages/PresidentHospitals';

import AuditLog from './pages/AuditLog';
import VerifyCertificate from './pages/VerifyCertificate';
import EventFeedback from './pages/EventFeedback';

// Registry (Data-entry clerk) — Phase 2b
import RegistryCenters from './pages/RegistryCenters';
import RegistryCenterDetail from './pages/RegistryCenterDetail';
import RegistryCountries from './pages/RegistryCountries';
import RegistrySpecialties from './pages/RegistrySpecialties';
import RegistryDios from './pages/RegistryDios';
import RegistryPds from './pages/RegistryPds';

// Data Analyzer + Central Secretary — Phase 3b
import AnalyzerDashboard from './pages/AnalyzerDashboard';
import AnalyzerStaff from './pages/AnalyzerStaff';
import AnalyzerExports from './pages/AnalyzerExports';
import CentralTrainees from './pages/CentralTrainees';
import CentralTrainers from './pages/CentralTrainers';

// Role pages — Phase 4b (DIO-view suite, SG suite, Announcements, Log Book, PD dashboard/program)
import DioViewDashboard from './pages/DioViewDashboard';
import DioViewCenters from './pages/DioViewCenters';
import DioViewPds from './pages/DioViewPds';
import DioViewTrainees from './pages/DioViewTrainees';
import DioViewTrainers from './pages/DioViewTrainers';
import Announcements from './pages/Announcements';
import LogBook from './pages/LogBook';
import SupervisorLogBook from './pages/SupervisorLogBook';
import SgDashboard from './pages/SgDashboard';
import SgCenters from './pages/SgCenters';
import SgDios from './pages/SgDios';
import SgSpecialties from './pages/SgSpecialties';
import SgPrograms from './pages/SgPrograms';
import SgPds from './pages/SgPds';
import SgTrainees from './pages/SgTrainees';
import SgReports from './pages/SgReports';
import ProgramDirectorDashboard from './pages/ProgramDirectorDashboard';
import ProgramDirectorProgram from './pages/ProgramDirectorProgram';

// ── mt- redesign (Agent F) ────────────────────────────────────────────────
// Previously-orphaned page now wired into the nav.
import AdminSpecialties from './pages/AdminSpecialties';
// New screens — lazy so the initial bundle stays lean. These are minimal STUBS
// today; the role waves replace each file with the real implementation.
const HocDashboard              = lazy(() => import('./pages/HocDashboard'));
const HocCenters                = lazy(() => import('./pages/HocCenters'));
const HocPrograms               = lazy(() => import('./pages/HocPrograms'));
const CentralDashboard          = lazy(() => import('./pages/CentralDashboard'));
const CentralCountries          = lazy(() => import('./pages/CentralCountries'));
const CentralCenters            = lazy(() => import('./pages/CentralCenters'));
const CentralPrograms           = lazy(() => import('./pages/CentralPrograms'));
const RegistryDashboard         = lazy(() => import('./pages/RegistryDashboard'));
const RegistryPrograms          = lazy(() => import('./pages/RegistryPrograms'));
const RegistryPermissions       = lazy(() => import('./pages/RegistryPermissions'));
const AnalyzerPending           = lazy(() => import('./pages/AnalyzerPending'));
const AnalyzerCountries         = lazy(() => import('./pages/AnalyzerCountries'));
const AnalyzerCenters           = lazy(() => import('./pages/AnalyzerCenters'));
const AnalyzerDios              = lazy(() => import('./pages/AnalyzerDios'));
const AnalyzerPrograms          = lazy(() => import('./pages/AnalyzerPrograms'));
const AnalyzerPds               = lazy(() => import('./pages/AnalyzerPds'));
const AnalyzerClerks            = lazy(() => import('./pages/AnalyzerClerks'));
const AnalyzerHocs              = lazy(() => import('./pages/AnalyzerHocs'));
const AnalyzerSpecialties       = lazy(() => import('./pages/AnalyzerSpecialties'));
const AnalyzerCentralSecretaries= lazy(() => import('./pages/AnalyzerCentralSecretaries'));
const AnalyzerTrainees          = lazy(() => import('./pages/AnalyzerTrainees'));
const DioViewOdios              = lazy(() => import('./pages/DioViewOdios'));
const DioPdAssignment           = lazy(() => import('./pages/DioPdAssignment'));
const ProgramDirectorLogBook    = lazy(() => import('./pages/ProgramDirectorLogBook'));

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
        <Suspense fallback={<div className="loading">Loading…</div>}>
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
          <Route path="/supervisor/research" element={
            <ProtectedRoute allowedRoles={['supervisor']}>
              <SupervisorResearch />
            </ProtectedRoute>
          } />

          <Route path="/program-director/dashboard" element={
            <ProtectedRoute allowedRoles={['program_director', 'sub_pd', 'super_admin']}>
              <ProgramDirectorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/program-director/program" element={
            <ProtectedRoute allowedRoles={['program_director', 'sub_pd', 'super_admin']}>
              <ProgramDirectorProgram />
            </ProtectedRoute>
          } />
          <Route path="/program-director/trainees" element={
            <ProtectedRoute allowedRoles={['program_director', 'sub_pd']}>
              <ProgramDirectorTrainees />
            </ProtectedRoute>
          } />
          <Route path="/program-director/supervisors" element={
            <ProtectedRoute allowedRoles={['program_director', 'sub_pd']}>
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
            <ProtectedRoute allowedRoles={['dio', 'super_admin', 'program_director', 'president', 'dio_view', 'sub_dio']}>
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
          <Route path="/consultant-memo/approved" element={
            <ProtectedRoute allowedRoles={['asg1', 'asg2']}>
              <ConsultantMemoApproved />
            </ProtectedRoute>
          } />
          {/* Initiatives — ASG roles only (mirrors the backend 403 guard).
              The page also self-gates via useInitiativeAccess. */}
          <Route path="/initiatives" element={
            <ProtectedRoute allowedRoles={['asg1', 'asg2']}>
              <Initiatives />
            </ProtectedRoute>
          } />

          <Route path="/president/dashboard" element={
            <ProtectedRoute allowedRoles={['president']}>
              <DioDashboard />
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
          <Route path="/admin/system" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AdminSystem />
            </ProtectedRoute>
          } />
          <Route path="/admin/audit-log" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AuditLog />
            </ProtectedRoute>
          } />
          <Route path="/admin/event-feedback" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <EventFeedback />
            </ProtectedRoute>
          } />

          {/* ══════════════════════════════════════════════════════════
              REGISTRY — Data-entry clerk (+ Developer). Global, unscoped.
          ══════════════════════════════════════════════════════════ */}
          <Route path="/registry/centers" element={
            <ProtectedRoute allowedRoles={['data_entry', 'super_admin', 'head_ad']}>
              <RegistryCenters />
            </ProtectedRoute>
          } />
          <Route path="/registry/centers/:id" element={
            <ProtectedRoute allowedRoles={['data_entry', 'super_admin', 'head_ad']}>
              <RegistryCenterDetail />
            </ProtectedRoute>
          } />
          <Route path="/registry/countries" element={
            <ProtectedRoute allowedRoles={['data_entry', 'super_admin', 'head_ad']}>
              <RegistryCountries />
            </ProtectedRoute>
          } />
          <Route path="/registry/specialties" element={
            <ProtectedRoute allowedRoles={['data_entry', 'super_admin', 'head_ad']}>
              <RegistrySpecialties />
            </ProtectedRoute>
          } />
          <Route path="/registry/dios" element={
            <ProtectedRoute allowedRoles={['data_entry', 'super_admin', 'head_ad']}>
              <RegistryDios />
            </ProtectedRoute>
          } />
          <Route path="/registry/pds" element={
            <ProtectedRoute allowedRoles={['data_entry', 'super_admin', 'head_ad']}>
              <RegistryPds />
            </ProtectedRoute>
          } />

          {/* ══════════════════════════════════════════════════════════
              DATA ANALYZER — filterable dashboard + staff management.
          ══════════════════════════════════════════════════════════ */}
          <Route path="/analyzer/dashboard" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}>
              <AnalyzerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/analyzer/staff" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin']}>
              <AnalyzerStaff />
            </ProtectedRoute>
          } />
          <Route path="/analyzer/exports" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin']}>
              <AnalyzerExports />
            </ProtectedRoute>
          } />

          {/* ══════════════════════════════════════════════════════════
              CENTRAL SECRETARY — global trainee/trainer management.
          ══════════════════════════════════════════════════════════ */}
          <Route path="/central/trainees" element={
            <ProtectedRoute allowedRoles={['central_secretary', 'super_admin']}>
              <CentralTrainees />
            </ProtectedRoute>
          } />
          {/* TODO(fable): RULINGS §D21 says remove CentralTrainers/DioViewTrainers
              routes+links, but task §7 + frontend_map §8 list them as trainer-ENTITY
              refs to keep. I removed the NAV LINKS (new CS/DIO navs) but kept these
              ROUTES functional (no feature removal / no deep-link 404). Confirm
              whether to also delete the routes + page files. */}
          <Route path="/central/trainers" element={
            <ProtectedRoute allowedRoles={['central_secretary', 'super_admin']}>
              <CentralTrainers />
            </ProtectedRoute>
          } />

          {/* ══════════════════════════════════════════════════════════
              DIO-VIEW SUITE — DIO (dio_view) + Sub-DIO (sub_dio) read-only
              oversight scoped to the caller's center set.
          ══════════════════════════════════════════════════════════ */}
          <Route path="/dio-view/dashboard" element={
            <ProtectedRoute allowedRoles={['dio_view', 'sub_dio', 'super_admin']}>
              <DioViewDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dio-view/centers" element={
            <ProtectedRoute allowedRoles={['dio_view', 'sub_dio', 'super_admin']}>
              <DioViewCenters />
            </ProtectedRoute>
          } />
          <Route path="/dio-view/program-directors" element={
            <ProtectedRoute allowedRoles={['dio_view', 'sub_dio', 'super_admin']}>
              <DioViewPds />
            </ProtectedRoute>
          } />
          <Route path="/dio-view/trainees" element={
            <ProtectedRoute allowedRoles={['dio_view', 'sub_dio', 'super_admin']}>
              <DioViewTrainees />
            </ProtectedRoute>
          } />
          <Route path="/dio-view/trainers" element={
            <ProtectedRoute allowedRoles={['dio_view', 'sub_dio', 'super_admin']}>
              <DioViewTrainers />
            </ProtectedRoute>
          } />
          <Route path="/dio-view/certificates" element={
            <ProtectedRoute allowedRoles={['dio_view', 'sub_dio', 'super_admin']}>
              <DioCertificates />
            </ProtectedRoute>
          } />

          {/* ══════════════════════════════════════════════════════════
              SECRETARY GENERAL / ASSISTANT SECRETARY — read-only suite.
          ══════════════════════════════════════════════════════════ */}
          <Route path="/sg/dashboard" element={
            <ProtectedRoute allowedRoles={['secretary_general', 'assistant_secretary', 'super_admin']}>
              <SgDashboard />
            </ProtectedRoute>
          } />
          <Route path="/sg/centers" element={
            <ProtectedRoute allowedRoles={['secretary_general', 'assistant_secretary', 'super_admin']}>
              <SgCenters />
            </ProtectedRoute>
          } />
          <Route path="/sg/dios" element={
            <ProtectedRoute allowedRoles={['secretary_general', 'assistant_secretary', 'super_admin']}>
              <SgDios />
            </ProtectedRoute>
          } />
          <Route path="/sg/specialties" element={
            <ProtectedRoute allowedRoles={['secretary_general', 'assistant_secretary', 'super_admin']}>
              <SgSpecialties />
            </ProtectedRoute>
          } />
          <Route path="/sg/programs" element={
            <ProtectedRoute allowedRoles={['secretary_general', 'assistant_secretary', 'super_admin']}>
              <SgPrograms />
            </ProtectedRoute>
          } />
          <Route path="/sg/pds" element={
            <ProtectedRoute allowedRoles={['secretary_general', 'assistant_secretary', 'super_admin']}>
              <SgPds />
            </ProtectedRoute>
          } />
          <Route path="/sg/trainees" element={
            <ProtectedRoute allowedRoles={['secretary_general', 'assistant_secretary', 'super_admin']}>
              <SgTrainees />
            </ProtectedRoute>
          } />
          <Route path="/sg/reports" element={
            <ProtectedRoute allowedRoles={['secretary_general', 'assistant_secretary', 'super_admin']}>
              <SgReports />
            </ProtectedRoute>
          } />

          {/* ══════════════════════════════════════════════════════════
              ANNOUNCEMENTS + LOG BOOK — shared board + trainee/trainer logs.
          ══════════════════════════════════════════════════════════ */}
          <Route path="/announcements" element={
            <ProtectedRoute allowedRoles={['trainee', 'supervisor', 'program_director', 'sub_pd', 'super_admin']}>
              <Announcements />
            </ProtectedRoute>
          } />
          <Route path="/logbook" element={
            <ProtectedRoute allowedRoles={['trainee', 'super_admin']}>
              <LogBook />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/logbook" element={
            <ProtectedRoute allowedRoles={['supervisor', 'super_admin']}>
              <SupervisorLogBook />
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
          <Route path="/basic/supervisor/research" element={
            <ProtectedRoute allowedRoles={['b_supervisor']}><SupervisorResearch /></ProtectedRoute>
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
          <Route path="/basic/president/dashboard" element={
            <ProtectedRoute allowedRoles={['b_president']}><DioDashboard /></ProtectedRoute>
          } />
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

          {/* ══════════════════════════════════════════════════════════
              mt- REDESIGN ROUTES (Agent F). Behind these paths are minimal
              STUB pages today; role waves replace each file in place. HOC is a
              NEW role (Agent B adds it to the User enum); super_admin can view
              every screen for oversight.
          ══════════════════════════════════════════════════════════ */}
          {/* Developer — wire the previously-orphaned Specialties page */}
          <Route path="/admin/specialties" element={
            <ProtectedRoute allowedRoles={['super_admin']}><AdminSpecialties /></ProtectedRoute>
          } />

          {/* HOC (NEW role) — read-only council scope */}
          <Route path="/hoc/dashboard" element={
            <ProtectedRoute allowedRoles={['hoc', 'super_admin']}><HocDashboard /></ProtectedRoute>
          } />
          <Route path="/hoc/centers" element={
            <ProtectedRoute allowedRoles={['hoc', 'super_admin']}><HocCenters /></ProtectedRoute>
          } />
          <Route path="/hoc/programs" element={
            <ProtectedRoute allowedRoles={['hoc', 'super_admin']}><HocPrograms /></ProtectedRoute>
          } />

          {/* Central Secretary — new dashboard + registry drill screens */}
          <Route path="/central/dashboard" element={
            <ProtectedRoute allowedRoles={['central_secretary', 'super_admin']}><CentralDashboard /></ProtectedRoute>
          } />
          <Route path="/central/countries" element={
            <ProtectedRoute allowedRoles={['central_secretary', 'super_admin']}><CentralCountries /></ProtectedRoute>
          } />
          <Route path="/central/centers" element={
            <ProtectedRoute allowedRoles={['central_secretary', 'super_admin']}><CentralCenters /></ProtectedRoute>
          } />
          <Route path="/central/programs" element={
            <ProtectedRoute allowedRoles={['central_secretary', 'super_admin']}><CentralPrograms /></ProtectedRoute>
          } />

          {/* Clerk (data_entry) — new dashboard + programs list */}
          <Route path="/registry/dashboard" element={
            <ProtectedRoute allowedRoles={['data_entry', 'super_admin', 'head_ad']}><RegistryDashboard /></ProtectedRoute>
          } />
          <Route path="/registry/programs" element={
            <ProtectedRoute allowedRoles={['data_entry', 'super_admin', 'head_ad']}><RegistryPrograms /></ProtectedRoute>
          } />
          {/* Head AD only — the clerk must never review its own requests. */}
          <Route path="/registry/permissions" element={
            <ProtectedRoute allowedRoles={['head_ad', 'super_admin']}><RegistryPermissions /></ProtectedRoute>
          } />

          {/* Analyzer — 13-item nav: registry read-only views + Pending inbox */}
          <Route path="/analyzer/pending" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerPending /></ProtectedRoute>
          } />
          <Route path="/analyzer/countries" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerCountries /></ProtectedRoute>
          } />
          <Route path="/analyzer/centers" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerCenters /></ProtectedRoute>
          } />
          <Route path="/analyzer/dios" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerDios /></ProtectedRoute>
          } />
          <Route path="/analyzer/programs" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerPrograms /></ProtectedRoute>
          } />
          <Route path="/analyzer/pds" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerPds /></ProtectedRoute>
          } />
          <Route path="/analyzer/clerks" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerClerks /></ProtectedRoute>
          } />
          <Route path="/analyzer/hocs" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerHocs /></ProtectedRoute>
          } />
          <Route path="/analyzer/specialties" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerSpecialties /></ProtectedRoute>
          } />
          <Route path="/analyzer/central-secretaries" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerCentralSecretaries /></ProtectedRoute>
          } />
          <Route path="/analyzer/trainees" element={
            <ProtectedRoute allowedRoles={['data_analyzer', 'super_admin', 'head_cs']}><AnalyzerTrainees /></ProtectedRoute>
          } />

          {/* DIO (dio_view) — ODIOs list + Add-ODIO (its only write) */}
          <Route path="/dio-view/odios" element={
            <ProtectedRoute allowedRoles={['dio_view', 'sub_dio', 'super_admin']}><DioViewOdios /></ProtectedRoute>
          } />

          {/* ODIO — PD Assignment. W2-ODIO builds the real page here, reusing the
              existing ProgramDirectorsPanel export from DioAssignPds.jsx. */}
          <Route path="/dio/assign-pds" element={
            <ProtectedRoute allowedRoles={['dio', 'super_admin']}><DioPdAssignment /></ProtectedRoute>
          } />

          {/* PD — Log Book sign-off */}
          <Route path="/program-director/log-book" element={
            <ProtectedRoute allowedRoles={['program_director', 'super_admin']}><ProgramDirectorLogBook /></ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['trainee', 'supervisor', 'program_director', 'secretary', 'dio', 'president', 'super_admin', 'b_trainee', 'b_supervisor', 'b_program_director', 'b_secretary', 'b_dio', 'b_president', 'secretary_general', 'assistant_secretary', 'data_analyzer', 'head_cs', 'head_ad', 'data_entry', 'central_secretary', 'hoc', 'dio_view', 'sub_dio', 'sub_pd']}>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
      </PrefsProvider>
    </AuthProvider>
  );
}
