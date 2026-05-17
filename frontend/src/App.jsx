import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login                from './pages/Login';
import Reports              from './pages/Reports';
import Grades               from './pages/Grades';
import Timeline             from './pages/Timeline';
import Profile              from './pages/Profile';
import AdminDashboard        from './pages/AdminDashboard';
import Users                 from './pages/Users';
import HospitalsUniversities from './pages/HospitalsUniversities';
import Distributions         from './pages/Distributions';
import Students              from './pages/Students';
import DoctorStudents        from './pages/DoctorStudents';
import DoctorReports         from './pages/DoctorReports';
import DoctorEvaluations     from './pages/DoctorEvaluations';
import AdminDoctors          from './pages/AdminDoctors';
import DirectorDashboard     from './pages/DirectorDashboard';
import DirectorDoctors       from './pages/DirectorDoctors';
import DirectorCertificates  from './pages/DirectorCertificates';
import Certificates           from './pages/Certificates';

const STAFF = ['admin', 'super_admin', 'professor'];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          {/* Student pages */}
          <Route path="/reports" element={
            <ProtectedRoute allowedRoles={['student']}>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/grades" element={
            <ProtectedRoute allowedRoles={['student']}>
              <Grades />
            </ProtectedRoute>
          } />
          <Route path="/timeline" element={
            <ProtectedRoute allowedRoles={['student']}>
              <Timeline />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['student', 'doctor', 'professor', 'admin', 'super_admin']}>
              <Profile />
            </ProtectedRoute>
          } />

          {/* Admin / Super-Admin / Professor pages */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={STAFF}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute allowedRoles={STAFF}>
              <Users />
            </ProtectedRoute>
          } />
          <Route path="/admin/hospitals" element={
            <ProtectedRoute allowedRoles={STAFF}>
              <HospitalsUniversities />
            </ProtectedRoute>
          } />
          <Route path="/admin/distributions" element={
            <ProtectedRoute allowedRoles={STAFF}>
              <Distributions />
            </ProtectedRoute>
          } />
          <Route path="/admin/students" element={
            <ProtectedRoute allowedRoles={STAFF}>
              <Students />
            </ProtectedRoute>
          } />

          <Route path="/admin/doctors" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDoctors />
            </ProtectedRoute>
          } />
          <Route path="/admin/certificates" element={
            <ProtectedRoute allowedRoles={['super_admin', 'professor']}>
              <Certificates />
            </ProtectedRoute>
          } />

          {/* Doctor pages */}
          <Route path="/doctor/students" element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <DoctorStudents />
            </ProtectedRoute>
          } />
          <Route path="/doctor/reports" element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <DoctorReports />
            </ProtectedRoute>
          } />
          <Route path="/doctor/evaluations" element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <DoctorEvaluations />
            </ProtectedRoute>
          } />

          {/* Director pages */}
          <Route path="/director/dashboard" element={
            <ProtectedRoute allowedRoles={['director']}>
              <DirectorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/director/doctors" element={
            <ProtectedRoute allowedRoles={['director']}>
              <DirectorDoctors />
            </ProtectedRoute>
          } />
          <Route path="/director/certificates" element={
            <ProtectedRoute allowedRoles={['director']}>
              <DirectorCertificates />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
