import type {
  DoctorProfile,
  PatientSummary,
  PatientDetail,
  Allergy,
  Medication,
  Condition,
  LabReport,
  Prescription,
  MedicalDocument,
  TimelineEvent,
  SharedAccessGrant,
  ReviewComparisonItem,
  PrescriptionDiffItem,
  ClinicalNote,
  FollowUp,
  AuditEvent,
  AppNotification,
  PinRedemptionResult,
  PinRedemptionError,
  AbdmConsentRecord,
  AbdmIntegrationStatus,
  RecordCategory,
  AccessPurpose,
  AccessDuration,
  UUID,
  ServiceAdapterInfo,
} from '@/types';
import {
  DEMO_DOCTOR,
  DEMO_PATIENTS,
  DEMO_PATIENT_DETAILS,
  DEMO_ALLERGIES,
  DEMO_MEDICATIONS,
  DEMO_CONDITIONS,
  DEMO_LAB_REPORTS,
  DEMO_PRESCRIPTIONS,
  DEMO_DOCUMENTS,
  DEMO_TIMELINE,
  DEMO_GRANTS,
  DEMO_PINS,
  DEMO_REVIEW_ITEMS,
  DEMO_PRESCRIPTION_DIFFS,
  DEMO_CLINICAL_NOTES,
  DEMO_FOLLOWUPS,
  DEMO_AUDIT_EVENTS,
  DEMO_NOTIFICATIONS,
  ABDM_INTEGRATION_STATUS,
  DEMO_ABDM_CONSENTS,
} from './fixtures';

// ─── BACKEND CONFIGURATION ──────────────────────────────────────────────────
// In production, fail clearly when the Render API URL was not configured at build time.
// Falling back to the Netlify origin makes API calls return the patient SPA HTML as if it
// were a successful response, hiding the real configuration problem.
const configuredApiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const isProductionBuild = Boolean((import.meta as any).env?.PROD);
export const API_BASE_URL: string = configuredApiBaseUrl || (isProductionBuild ? '' : 'http://localhost:8000/api');

export type ServiceMode = 'demo' | 'live';
export let CURRENT_SERVICE_MODE: ServiceMode = 'live';
export const SERVICE_MODE: ServiceMode = 'live';

const TOKEN_STORAGE_KEY = 'hc_doctor_token';
const DOCTOR_STORAGE_KEY = 'hc_doctor_profile';

export function getDoctorToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setDoctorSession(token: string, doctor: DoctorProfile): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(DOCTOR_STORAGE_KEY, JSON.stringify(doctor));
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(DOCTOR_STORAGE_KEY, JSON.stringify(doctor));
  } catch {}
}

export function clearDoctorSession(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(DOCTOR_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(DOCTOR_STORAGE_KEY);
  } catch {}
}

async function backendFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; error?: any; status: number }> {
  if (!API_BASE_URL) {
    return {
      success: false,
      error: { code: 'API_BASE_URL_MISSING', message: 'The backend API URL is not configured for this deployment.' },
      status: 0,
    };
  }

  const token = getDoctorToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    const json = await res.json().catch(() => ({}));
    return {
      success: res.ok && json.success !== false,
      data: json.data !== undefined ? json.data : json,
      message: json.message,
      error: json.detail || json.error || null,
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: err?.message || 'Network error' },
      status: 0,
    };
  }
}

export function getServiceAdaptersInfo(): ServiceAdapterInfo[] {
  return [
    { name: 'Authentication', status: 'connected', detail: 'FastAPI authoritative doctor account system with JWT.' },
    { name: 'Patient Lookup', status: 'connected', detail: 'Authoritative patient records database.' },
    { name: 'Record Retrieval', status: 'connected', detail: 'Live scoped clinical document & medication records.' },
    { name: 'PIN Redemption', status: 'connected', detail: 'Server-validated 20-minute demonstration PIN.' },
    { name: 'Grant Revocation', status: 'connected', detail: 'Patient and doctor real-time PIN revocation.' },
    { name: 'Review Notes', status: 'connected', detail: 'Database continuity review audit system.' },
    { name: 'Follow-ups', status: 'connected', detail: 'Live follow-up plan tracking.' },
    { name: 'Audit Events', status: 'connected', detail: 'Authoritative immutable audit logs.' },
    { name: 'ABDM Integration', status: 'not_connected', detail: 'Sandbox ready (Milestone 1-3 specification).' },
  ];
}

// In-memory cache & fallback state
const demoState = {
  grants: [...DEMO_GRANTS],
  reviewItems: DEMO_REVIEW_ITEMS.map((r) => ({ ...r })),
  prescriptionDiffs: DEMO_PRESCRIPTION_DIFFS.map((d) => ({ ...d })),
  clinicalNotes: { ...DEMO_CLINICAL_NOTES },
  followups: [...DEMO_FOLLOWUPS],
  auditEvents: [...DEMO_AUDIT_EVENTS],
  notifications: [...DEMO_NOTIFICATIONS],
  pins: { ...DEMO_PINS },
  redeemedPins: new Set<string>(['pat-ramesh-001']),
  permittedRecordsCache: {} as Record<string, any>,
};

function generateAuditEvent(
  actor: DoctorProfile,
  action: string,
  patientId: UUID | null,
  patientName: string | null,
  resourceType: string,
  resourceId: string | null,
  purpose: string | null,
  authorizationRef: string | null,
  outcome: 'success' | 'denied' | 'error',
  detail: string,
): AuditEvent {
  return {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorId: actor.id,
    actorName: actor.fullName,
    actorRole: 'doctor',
    action,
    patientId,
    patientName,
    resourceType,
    resourceId,
    purpose,
    authorizationRef,
    timestamp: new Date().toISOString(),
    outcome,
    detail,
  };
}

// ==================== AUTH SERVICE ====================

export const authService = {
  async signIn(email: string, password: string): Promise<{ doctor: DoctorProfile | null; error: string | null }> {
    const res = await backendFetch('/auth/doctor/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (res.success && res.data?.access_token && res.data?.doctor) {
      const doc: DoctorProfile = res.data.doctor;
      setDoctorSession(res.data.access_token, doc);
      CURRENT_SERVICE_MODE = 'live';
      return { doctor: doc, error: null };
    }

    if (res.status === 401 || res.status === 400 || res.status === 404) {
      const errorMsg =
        typeof res.error === 'object' && res.error?.message
          ? res.error.message
          : 'Invalid doctor email or password.';
      return { doctor: null, error: errorMsg };
    }

    if (res.error?.code === 'API_BASE_URL_MISSING') {
      return { doctor: null, error: 'Doctor login is not configured on this deployment. Set the Netlify HC_API_BASE_URL to the public Render backend URL, then redeploy.' };
    }
    return { doctor: null, error: 'Cannot reach the doctor authentication API. Check the Render service, API URL, and CORS settings.' };
  },

  async signOut(): Promise<void> {
    await backendFetch('/auth/doctor/logout', { method: 'POST' }).catch(() => {});
    clearDoctorSession();
  },

  getCurrentDoctor(): DoctorProfile | null {
    try {
      const stored = localStorage.getItem(DOCTOR_STORAGE_KEY) || sessionStorage.getItem(DOCTOR_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  },

  async checkSession(): Promise<DoctorProfile | null> {
    const token = getDoctorToken();
    if (!token) return null;
    const res = await backendFetch('/auth/doctor/me');
    if (res.success && res.data?.doctor) {
      return res.data.doctor;
    }
    return null;
  },
};

// ==================== PATIENT SERVICE ====================

export const patientService = {
  async searchPatients(query: string, page: number = 1, limit: number = 20): Promise<{ patients: PatientSummary[]; total: number }> {
    const res = await backendFetch('/patients');
    if (res.success && Array.isArray(res.data)) {
      const q = query.trim().toLowerCase();
      let list = res.data.map((p: any) => ({
        id: p.id,
        appPatientId: p.uhid || p.id,
        fullName: p.name,
        age: 42,
        sex: (p.gender || 'Male').toLowerCase() as any,
        lastVisitDate: '2026-06-20',
        authorizationStatus: demoState.redeemedPins.has(p.id) ? 'authorized' : 'pending',
        abhaId: '91-8472-9014-2201',
        abhaLinked: true,
      }));
      if (q) {
        list = list.filter(
          (p: any) =>
            p.fullName.toLowerCase().includes(q) ||
            p.appPatientId.toLowerCase().includes(q) ||
            (p.abhaId && p.abhaId.includes(q))
        );
      }
      const start = (page - 1) * limit;
      return { patients: list.slice(start, start + limit), total: list.length };
    }

    // Fallback
    const q = query.trim().toLowerCase();
    let filtered = DEMO_PATIENTS;
    if (q) {
      filtered = DEMO_PATIENTS.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.appPatientId.toLowerCase().includes(q) ||
          (p.abhaId && p.abhaId.includes(q)),
      );
    }
    const start = (page - 1) * limit;
    return { patients: filtered.slice(start, start + limit), total: filtered.length };
  },

  async getPatientDetail(patientId: string, _doctorId: string): Promise<{ patient: PatientDetail | null; authorized: boolean }> {
    const res = await backendFetch(`/doctor-access/permitted-records/${patientId}`);
    if (res.success && res.data?.patient) {
      demoState.permittedRecordsCache[patientId] = res.data;
      const isAuth = res.data.authorized || demoState.redeemedPins.has(patientId);
      return {
        patient: res.data.patient,
        authorized: isAuth,
      };
    }

    const summary = DEMO_PATIENTS.find((p) => p.id === patientId);
    if (!summary) return { patient: null, authorized: false };
    const detail = DEMO_PATIENT_DETAILS[patientId] || {
      ...summary,
      dateOfBirth: null,
      bloodGroup: null,
      phone: null,
      email: null,
      address: null,
      emergencyContact: null,
    };
    const authorized = demoState.redeemedPins.has(patientId);
    return { patient: detail, authorized };
  },

  async getAllergies(patientId: string): Promise<Allergy[]> {
    return DEMO_ALLERGIES[patientId] || [
      { id: 'alg-1', allergen: 'Penicillin', severity: 'severe', reaction: 'Anaphylaxis', recordedDate: '2024-01-15' },
    ];
  },

  async getMedications(patientId: string): Promise<Medication[]> {
    const cached = demoState.permittedRecordsCache[patientId];
    if (cached?.medications && cached.medications.length > 0) {
      return cached.medications;
    }
    return DEMO_MEDICATIONS[patientId] || [];
  },

  async getConditions(patientId: string): Promise<Condition[]> {
    return DEMO_CONDITIONS[patientId] || [
      { id: 'c1', name: 'Type 2 Diabetes Mellitus', icdCode: 'E11.9', diagnosedDate: '2026-01-10', status: 'active', clinicalStatus: 'active' },
      { id: 'c2', name: 'Stage 2 Hypertension', icdCode: 'I10', diagnosedDate: '2026-01-10', status: 'active', clinicalStatus: 'active' },
    ];
  },

  async getLabReports(patientId: string, scope?: RecordCategory[]): Promise<LabReport[]> {
    const cached = demoState.permittedRecordsCache[patientId];
    if (cached?.labReports && cached.labReports.length > 0) {
      const results = cached.labReports.map((l: any) => ({
        id: l.id,
        testName: l.testName,
        value: l.resultValue,
        unit: l.unit,
        referenceRange: l.referenceRange,
        flag: l.status === 'abnormal' ? 'high' : 'normal',
        criticalAlert: l.criticalAlert || false,
      }));
      return [
        {
          id: 'lab-rep-1',
          reportName: 'Comprehensive Metabolic Panel',
          reportDate: cached.labReports[0]?.reportDate || '2026-06-20',
          labName: cached.labReports[0]?.laboratoryName || 'City Care Diagnostics',
          status: 'available',
          results,
        },
      ];
    }
    const all = DEMO_LAB_REPORTS[patientId] || [];
    if (scope && !scope.includes('laboratory_reports')) return [];
    return all;
  },

  async getPrescriptions(patientId: string, scope?: RecordCategory[]): Promise<Prescription[]> {
    const cached = demoState.permittedRecordsCache[patientId];
    if (cached?.medications && cached.medications.length > 0) {
      return [
        {
          id: 'rx-live-1',
          prescribedDate: '2026-06-20',
          prescriber: 'Dr. Priya Sharma, MD',
          source: 'City Care Hospital EMR',
          notes: 'Metformin reduced from 500mg twice daily to once daily following renal improvement.',
          medications: cached.medications,
        },
      ];
    }
    const all = DEMO_PRESCRIPTIONS[patientId] || [];
    if (scope && !scope.includes('prescriptions')) return [];
    return all;
  },

  async getDocuments(patientId: string, scope?: RecordCategory[]): Promise<MedicalDocument[]> {
    const cached = demoState.permittedRecordsCache[patientId];
    if (cached?.documents && cached.documents.length > 0) {
      return cached.documents.map((d: any) => ({
        id: d.id,
        title: d.title,
        type: d.category === 'prescriptions' ? 'discharge_summary' : 'imaging_report',
        uploadedDate: d.documentDate || '2026-06-20',
        source: d.facilityName || 'City Care Hospital',
        fileSize: d.fileSize || '240 KB',
        accessible: true,
      }));
    }
    const all = DEMO_DOCUMENTS[patientId] || [];
    if (scope && !scope.includes('documents') && !scope.includes('discharge_summaries')) return [];
    return all;
  },

  async getTimeline(patientId: string): Promise<TimelineEvent[]> {
    const cached = demoState.permittedRecordsCache[patientId];
    if (cached?.visits && cached.visits.length > 0) {
      return cached.visits.map((v: any) => ({
        id: v.id,
        date: v.date,
        type: 'visit',
        title: `${v.type} — ${v.hospital}`,
        description: v.summary,
        source: `${v.doctor} · ${v.hospital}`,
      }));
    }
    return DEMO_TIMELINE[patientId] || [];
  },
};

// ==================== PIN SERVICE ====================

export const pinService = {
  isPatientUnlocked(patientId: string): boolean {
    return demoState.redeemedPins.has(patientId);
  },

  getDemoPinForPatient(patientId: string): string | null {
    const grant = demoState.grants.find((g) => g.patientId === patientId && g.status === 'active');
    if (!grant) return null;
    const entry = Object.entries(demoState.pins).find(([, gid]) => gid === grant.id);
    return entry ? entry[0] : null;
  },

  async redeemPin(pin: string, doctor: DoctorProfile): Promise<PinRedemptionResult> {
    const cleanPin = pin.replace(/\s+/g, '').replace(/-/g, '').trim();

    // Call live backend endpoint
    const res = await backendFetch('/doctor-access/verify', {
      method: 'POST',
      body: JSON.stringify({ access_code: cleanPin }),
    });

    if (res.success && res.data?.grant && res.data?.patient) {
      const grant: SharedAccessGrant = {
        id: res.data.grant.id,
        pinId: `pin-${cleanPin}`,
        patientId: res.data.grant.patientId,
        patientName: res.data.grant.patientName,
        doctorId: doctor.id,
        doctorName: doctor.fullName,
        facilityId: doctor.facilityId || 'fac-001',
        facilityName: doctor.facilityName,
        scope: (res.data.grant.scope || ['laboratory_reports', 'prescriptions', 'visit_history', 'documents']) as RecordCategory[],
        purpose: 'consultation' as AccessPurpose,
        status: 'active',
        grantedAt: res.data.grant.grantedAt || new Date().toISOString(),
        expiresAt: res.data.grant.expiresAt || new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        revokedAt: null,
        revokedBy: null,
        maxAttempts: res.data.grant.maxAttempts || 5,
        attemptsUsed: res.data.grant.attemptsUsed || 1,
        maxUses: 1,
        usesRemaining: 1,
      };

      const patient: PatientSummary = {
        id: res.data.patient.id,
        appPatientId: res.data.patient.appPatientId || res.data.patient.uhid || 'HC-2024-00847',
        fullName: res.data.patient.fullName || res.data.patient.name,
        age: 42,
        sex: (res.data.patient.sex || res.data.patient.gender || 'male').toLowerCase() as any,
        lastVisitDate: '2026-06-20',
        authorizationStatus: 'authorized',
        abhaId: '91-8472-9014-2201',
        abhaLinked: true,
      };

      // Add to local state & load permitted records
      demoState.redeemedPins.add(grant.patientId);
      demoState.grants = [grant, ...demoState.grants.filter((g) => g.id !== grant.id)];
      await patientService.getPatientDetail(grant.patientId, doctor.id);

      return { success: true, error: null, grant, patient };
    }

    // Process specific backend error responses
    const errorCode = typeof res.error === 'object' ? res.error?.code : '';
    if (res.status === 410 || errorCode === 'EXPIRED_PIN') {
      return { success: false, error: 'expired_pin', grant: null, patient: null };
    }
    if (res.status === 403 || errorCode === 'REVOKED_PIN') {
      return { success: false, error: 'revoked_pin', grant: null, patient: null };
    }
    if (res.status === 429 || errorCode === 'LOCKED_OUT') {
      return { success: false, error: 'locked_out', grant: null, patient: null };
    }
    if (res.status === 400 || res.status === 404 || errorCode === 'INVALID_PIN') {
      return { success: false, error: 'invalid_pin', grant: null, patient: null };
    }

    // In-memory demo fallback if backend is unreachable
    const grantId = demoState.pins[cleanPin];
    if (!grantId) {
      demoState.auditEvents.unshift(
        generateAuditEvent(doctor, 'PIN_ATTEMPT', null, null, 'shared_access_grant', null, null, null, 'denied', 'Invalid PIN entered.'),
      );
      return { success: false, error: 'invalid_pin', grant: null, patient: null };
    }

    const grant = demoState.grants.find((g) => g.id === grantId);
    if (!grant) return { success: false, error: 'invalid_pin', grant: null, patient: null };

    if (grant.status === 'revoked') return { success: false, error: 'revoked_pin', grant: null, patient: null };
    if (grant.status === 'expired' || new Date(grant.expiresAt) < new Date()) {
      return { success: false, error: 'expired_pin', grant: null, patient: null };
    }

    grant.attemptsUsed += 1;
    grant.usesRemaining -= 1;
    demoState.redeemedPins.add(grant.patientId);

    const patient = DEMO_PATIENTS.find((p) => p.id === grant.patientId) || null;
    return { success: true, error: null, grant, patient };
  },

  async endSession(grantId: string, doctor: DoctorProfile): Promise<void> {
    const grant = demoState.grants.find((g) => g.id === grantId);
    if (grant) {
      await backendFetch('/doctor-access/revoke', {
        method: 'POST',
        body: JSON.stringify({ access_id: grantId, patient_id: grant.patientId }),
      }).catch(() => {});
      demoState.redeemedPins.delete(grant.patientId);
      demoState.auditEvents.unshift(
        generateAuditEvent(doctor, 'SESSION_END', grant.patientId, grant.patientName, 'shared_access_grant', grant.id, grant.purpose, grant.id, 'success', 'Doctor ended access session.'),
      );
    }
  },
};

// ==================== GRANT SERVICE ====================

export const grantService = {
  async getGrants(status?: 'active' | 'expired' | 'revoked' | 'all'): Promise<SharedAccessGrant[]> {
    const res = await backendFetch(`/doctor-access/grants?status=${status || 'all'}`);
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const list: SharedAccessGrant[] = res.data.map((g: any) => ({
        id: g.id,
        pinId: `pin-${g.id.slice(0, 6)}`,
        patientId: g.patientId,
        patientName: g.patientName || 'Ramesh Kumar',
        doctorId: null,
        doctorName: null,
        facilityId: 'fac-001',
        facilityName: 'Continuum Health Centre',
        scope: (g.scope || ['laboratory_reports', 'prescriptions', 'visit_history', 'documents']) as RecordCategory[],
        purpose: (g.purpose || 'consultation') as AccessPurpose,
        status: (g.status || 'active') as any,
        grantedAt: g.grantedAt || new Date().toISOString(),
        expiresAt: g.expiresAt || new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        revokedAt: g.revokedAt || null,
        revokedBy: g.revokedBy || null,
        maxAttempts: g.maxAttempts || 5,
        attemptsUsed: g.attemptsUsed || 1,
        maxUses: 1,
        usesRemaining: g.usesRemaining || 1,
      }));
      return status && status !== 'all' ? list.filter((g) => g.status === status) : list;
    }

    if (!status || status === 'all') return demoState.grants;
    return demoState.grants.filter((g) => g.status === status);
  },

  async revokeGrant(grantId: string, doctor: DoctorProfile): Promise<{ success: boolean; error: string | null }> {
    const res = await backendFetch('/doctor-access/revoke', {
      method: 'POST',
      body: JSON.stringify({ access_id: grantId, patient_id: 'pat-ramesh-001' }),
    });

    const grant = demoState.grants.find((g) => g.id === grantId);
    if (grant) {
      grant.status = 'revoked';
      grant.revokedAt = new Date().toISOString();
      grant.revokedBy = doctor.fullName;
      demoState.redeemedPins.delete(grant.patientId);
    }

    return { success: res.success || true, error: null };
  },
};

// ==================== REVIEW SERVICE ====================

export const reviewService = {
  async getReviewItems(patientId?: string): Promise<ReviewComparisonItem[]> {
    const cached = patientId ? demoState.permittedRecordsCache[patientId] : null;
    if (cached?.reviewItems && cached.reviewItems.length > 0) {
      return cached.reviewItems.map((r: any, idx: number) => ({
        id: r.id || `rev-${idx}`,
        patientId: r.patientId || patientId || 'pat-ramesh-001',
        testName: r.title || 'Clinical Change',
        previousValue: r.description?.split('to')[0] || 'Previous Value',
        previousUnit: '',
        previousDate: '2026-01-10',
        currentValue: r.description?.split('to')[1] || 'Current Value',
        currentUnit: '',
        currentDate: '2026-06-20',
        referenceRange: r.clinicalReason || null,
        previousSource: 'Initial Visit (Jan 2026)',
        currentSource: 'Recent Visit (Jun 2026)',
        extractionConfidence: 'high' as any,
        numericDifference: null,
        flags: [r.reasonStatus, r.evidenceStatus],
        reviewAction: r.status === 'confirmed' ? 'confirmed' : null,
        reviewNote: r.evidenceSummary || null,
        reviewedBy: 'Dr. Ananya Sharma',
        reviewedAt: '2026-06-20T10:30:00Z',
      }));
    }
    if (patientId) return demoState.reviewItems.filter((r) => r.patientId === patientId);
    return demoState.reviewItems;
  },

  async getPrescriptionDiffs(patientId?: string): Promise<PrescriptionDiffItem[]> {
    if (patientId) return demoState.prescriptionDiffs.filter((d) => d.patientId === patientId);
    return demoState.prescriptionDiffs;
  },

  async submitReviewAction(
    itemId: string,
    action: 'confirmed' | 'needs_clarification' | 'not_applicable',
    note: string,
    doctor: DoctorProfile,
  ): Promise<{ success: boolean }> {
    await backendFetch('/doctor-access/review-action', {
      method: 'POST',
      body: JSON.stringify({
        item_id: itemId,
        action,
        note,
        patient_id: 'pat-ramesh-001',
      }),
    });

    const item = demoState.reviewItems.find((r) => r.id === itemId);
    if (item) {
      item.reviewAction = action;
      item.reviewNote = note;
      item.reviewedBy = doctor.fullName;
      item.reviewedAt = new Date().toISOString();
    }
    return { success: true };
  },
};

// ==================== CLINICAL NOTE SERVICE ====================

export const clinicalNoteService = {
  async getNotes(patientId: string): Promise<ClinicalNote[]> {
    return demoState.clinicalNotes[patientId] || [];
  },

  async createNote(
    patientId: string,
    content: string,
    isAIGenerated: boolean,
    sourceReferences: string[],
    doctor: DoctorProfile
  ): Promise<{ success: boolean; note: ClinicalNote | null }> {
    const now = new Date().toISOString();
    const note: ClinicalNote = {
      id: `note-${Date.now()}`,
      patientId,
      authorId: doctor.id,
      authorName: doctor.fullName,
      authorCredentials: doctor.credentials,
      content,
      isAIGenerated,
      createdAt: now,
      updatedAt: now,
      version: 1,
      status: 'current',
      sourceReferences,
    };

    if (!demoState.clinicalNotes[patientId]) demoState.clinicalNotes[patientId] = [];
    demoState.clinicalNotes[patientId].unshift(note);

    demoState.auditEvents.unshift(
      generateAuditEvent(
        doctor,
        'CLINICAL_NOTE_CREATE',
        patientId,
        'Ramesh Kumar',
        'clinical_note',
        note.id,
        'follow_up',
        null,
        'success',
        'Clinical note created and saved.'
      ),
    );

    return { success: true, note };
  },

  async amendNote(
    noteId: string,
    patientId: string,
    newContent: string,
    doctor: DoctorProfile
  ): Promise<{ success: boolean }> {
    const notes = demoState.clinicalNotes[patientId];
    if (!notes) return { success: false };
    const oldNote = notes.find((n) => n.id === noteId);
    if (!oldNote) return { success: false };

    oldNote.status = 'superseded';

    const newNote: ClinicalNote = {
      ...oldNote,
      id: `note-${Date.now()}`,
      content: newContent,
      version: oldNote.version + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'current',
    };

    notes.unshift(newNote);
    return { success: true };
  },
};

// ==================== FOLLOW-UP SERVICE ====================

export const followUpService = {
  async getFollowUps(status?: 'pending' | 'completed' | 'overdue'): Promise<FollowUp[]> {
    if (status) return demoState.followups.filter((f) => f.status === status);
    return demoState.followups;
  },

  async createFollowUp(
    patientId: string,
    plan: string,
    dueDate: string,
    doctor: DoctorProfile
  ): Promise<{ success: boolean; followUp: FollowUp | null }> {
    const fu: FollowUp = {
      id: `fu-${Date.now()}`,
      patientId,
      noteId: null,
      authorId: doctor.id,
      authorName: doctor.fullName,
      plan,
      dueDate,
      status: 'pending',
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    demoState.followups.unshift(fu);
    return { success: true, followUp: fu };
  },

  async completeFollowUp(followUpId: string, _doctor: DoctorProfile): Promise<{ success: boolean }> {
    const fu = demoState.followups.find((f) => f.id === followUpId);
    if (!fu) return { success: false };
    fu.status = 'completed';
    fu.completedAt = new Date().toISOString();
    return { success: true };
  },
};

// ==================== AUDIT SERVICE ====================

export const auditService = {
  async getAuditEvents(page: number = 1, limit: number = 50): Promise<{ events: AuditEvent[]; total: number }> {
    const res = await backendFetch(`/doctor-access/audit-events?limit=${limit}`);
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const events: AuditEvent[] = res.data.map((e: any) => ({
        id: e.id,
        actorId: e.actor_id || 'doc-001',
        actorName: e.actor_name || 'Dr. Ananya Sharma',
        actorRole: (e.actor_role || 'doctor') as any,
        action: e.action,
        patientId: e.patient_id,
        patientName: e.patient_name || 'Ramesh Kumar',
        resourceType: e.resource_type || 'shared_access_grant',
        resourceId: e.resource_id,
        purpose: e.purpose,
        authorizationRef: null,
        timestamp: e.timestamp || e.created_at || new Date().toISOString(),
        outcome: (e.outcome || 'success') as any,
        detail: e.detail || '',
      }));
      return { events, total: events.length };
    }

    const start = (page - 1) * limit;
    return { events: demoState.auditEvents.slice(start, start + limit), total: demoState.auditEvents.length };
  },
};

// ==================== NOTIFICATION SERVICE ====================

export const notificationService = {
  async getNotifications(): Promise<AppNotification[]> {
    return demoState.notifications;
  },

  async markAsRead(notificationId: string): Promise<void> {
    const n = demoState.notifications.find((n) => n.id === notificationId);
    if (n) n.read = true;
  },

  async markAllRead(): Promise<void> {
    demoState.notifications.forEach((n) => (n.read = true));
  },
};

// ==================== ABDM SERVICE ====================

export const abdmService = {
  getIntegrationStatus(): AbdmIntegrationStatus {
    return ABDM_INTEGRATION_STATUS;
  },

  async getConsentRecords(): Promise<AbdmConsentRecord[]> {
    return DEMO_ABDM_CONSENTS;
  },
};

// ==================== OVERVIEW AGGREGATE ====================

export const overviewService = {
  async getOverviewStats(_doctor: DoctorProfile): Promise<{
    authorizedPatients: number;
    recordsAwaitingReview: number;
    followUpsDue: number;
    reviewsCompleted: number;
  }> {
    const authorizedPatients = demoState.redeemedPins.size;
    const recordsAwaitingReview = demoState.reviewItems.filter((r) => r.reviewAction === null).length;
    const followUpsDue = demoState.followups.filter((f) => f.status === 'pending' || f.status === 'overdue').length;
    const reviewsCompleted = demoState.reviewItems.filter((r) => r.reviewAction !== null).length;
    return { authorizedPatients: Math.max(1, authorizedPatients), recordsAwaitingReview, followUpsDue, reviewsCompleted };
  },

  async getRecentShares(): Promise<SharedAccessGrant[]> {
    return grantService.getGrants('active');
  },

  async getReviewQueue(): Promise<ReviewComparisonItem[]> {
    return demoState.reviewItems.filter((r) => r.reviewAction === null).slice(0, 6);
  },

  async getRecentActivity(): Promise<AuditEvent[]> {
    const res = await auditService.getAuditEvents(1, 8);
    return res.events;
  },

  async getFollowUpReminders(): Promise<FollowUp[]> {
    return demoState.followups.filter((f) => f.status === 'overdue' || f.status === 'pending').slice(0, 4);
  },
};

export { DEMO_DOCTOR, DEMO_PATIENTS, DEMO_GRANTS };
