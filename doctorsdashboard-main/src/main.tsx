import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/AppShell';
import { LoadingState } from '@/components/ui';
import { LoginPage } from '@/pages/LoginPage';
import { OverviewPage } from '@/pages/OverviewPage';
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
  if (!doctor) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function LoginRoute({ children }: { children: JSX.Element }) {
  const { doctor, loading } = useAuth();
  if (loading) return <LoadingState message="Loading..." />;
  if (doctor) return <Navigate to="/overview" replace />;
  return children;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Doctor dashboard routes. /doctor/login is reserved for the patient hackathon URL. */}
          <Route path="/doctor/overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
          <Route path="/doctor/patients" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
          <Route path="/doctor/patients/:patientId" element={<ProtectedRoute><PatientDetailPage /></ProtectedRoute>} />
          <Route path="/doctor/shared-records" element={<ProtectedRoute><SharedRecordsPage /></ProtectedRoute>} />
          <Route path="/doctor/continuity-review" element={<ProtectedRoute><ContinuityReviewPage /></ProtectedRoute>} />
          <Route path="/doctor/follow-ups" element={<ProtectedRoute><FollowUpsPage /></ProtectedRoute>} />
          <Route path="/doctor/access-consent" element={<ProtectedRoute><AccessConsentPage /></ProtectedRoute>} />
          <Route path="/doctor/audit-history" element={<ProtectedRoute><AuditHistoryPage /></ProtectedRoute>} />
          <Route path="/doctor/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

          {/* Doctor login remains available at /login. */}
          <Route path="/login" element={<LoginRoute><LoginPage /></LoginRoute>} />
          <Route path="/overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
          <Route path="/patients/:patientId" element={<ProtectedRoute><PatientDetailPage /></ProtectedRoute>} />
          <Route path="/shared-records" element={<ProtectedRoute><SharedRecordsPage /></ProtectedRoute>} />
          <Route path="/continuity-review" element={<ProtectedRoute><ContinuityReviewPage /></ProtectedRoute>} />
          <Route path="/follow-ups" element={<ProtectedRoute><FollowUpsPage /></ProtectedRoute>} />
          <Route path="/access-consent" element={<ProtectedRoute><AccessConsentPage /></ProtectedRoute>} />
          <Route path="/audit-history" element={<ProtectedRoute><AuditHistoryPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
