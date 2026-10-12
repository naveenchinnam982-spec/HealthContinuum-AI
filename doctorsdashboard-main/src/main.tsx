import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/AppShell';
import { LoadingState } from '@/components/ui';
import { LoginPage } from '@/pages/LoginPage';
import { DoctorDashboardV2 } from '@/pages/DoctorDashboardV2';
import { PatientsPage } from '@/pages/PatientsPage';
import { PatientDetailPage } from '@/pages/PatientDetailPage';
import { SharedRecordsPage } from '@/pages/SharedRecordsPage';
import { ContinuityReviewPage } from '@/pages/ContinuityReviewPage';
import { FollowUpsPage } from '@/pages/FollowUpsPage';
import { AccessConsentPage } from '@/pages/AccessConsentPage';
import { AuditHistoryPage } from '@/pages/AuditHistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import type { JSX } from 'react';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { doctor, loading } = useAuth();
  if (loading) return <LoadingState message="Verifying session..." />;
  if (!doctor) return <Navigate to="/doctor/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function LoginRoute({ children }: { children: JSX.Element }) {
  const { doctor, loading } = useAuth();
  if (loading) return <LoadingState message="Loading..." />;
  if (doctor) return <Navigate to="/doctor/overview" replace />;
  return children;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/doctor/login" element={<LoginRoute><LoginPage /></LoginRoute>} />
          <Route path="/doctor/overview" element={<ProtectedRoute><DoctorDashboardV2 /></ProtectedRoute>} />
          <Route path="/doctor/patients" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
          <Route path="/doctor/patients/:patientId" element={<ProtectedRoute><PatientDetailPage /></ProtectedRoute>} />
          <Route path="/doctor/shared-records" element={<ProtectedRoute><SharedRecordsPage /></ProtectedRoute>} />
          <Route path="/doctor/continuity-review" element={<ProtectedRoute><ContinuityReviewPage /></ProtectedRoute>} />
          <Route path="/doctor/follow-ups" element={<ProtectedRoute><FollowUpsPage /></ProtectedRoute>} />
          <Route path="/doctor/access-consent" element={<ProtectedRoute><AccessConsentPage /></ProtectedRoute>} />
          <Route path="/doctor/audit-history" element={<ProtectedRoute><AuditHistoryPage /></ProtectedRoute>} />
          <Route path="/doctor/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/login" element={<Navigate to="/doctor/login" replace />} />
          <Route path="/overview" element={<Navigate to="/doctor/overview" replace />} />
          <Route path="/patients" element={<Navigate to="/doctor/patients" replace />} />
          <Route path="/shared-records" element={<Navigate to="/doctor/shared-records" replace />} />
          <Route path="/continuity-review" element={<Navigate to="/doctor/continuity-review" replace />} />
          <Route path="/follow-ups" element={<Navigate to="/doctor/follow-ups" replace />} />
          <Route path="/access-consent" element={<Navigate to="/doctor/access-consent" replace />} />
          <Route path="/audit-history" element={<Navigate to="/doctor/audit-history" replace />} />
          <Route path="/settings" element={<Navigate to="/doctor/settings" replace />} />
          <Route path="/" element={<Navigate to="/doctor/login" replace />} />
          <Route path="*" element={<Navigate to="/doctor/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
