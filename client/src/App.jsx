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

const STAFF = ['admin', 'super_admin', 'professor'];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Login />} />

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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
