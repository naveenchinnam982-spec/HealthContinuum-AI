/**
 * HealthContinuum AI — API Client
 * Seamlessly integrates Firebase (Cloud Firestore, Storage, Auth) as primary backend,
 * with FastAPI / local fallback.
 */

'use strict';

const API_BASE = (() => {
  const configured = typeof window !== 'undefined' && typeof window.HC_API_BASE_URL === 'string'
    ? window.HC_API_BASE_URL.trim().replace(/\\/+$/, '')
    : '';
  if (configured) return /\\/api$/i.test(configured) ? configured : `${configured}/api`;
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) {
    return `${window.location.origin}/api`;
  }
  return 'http://127.0.0.1:8000/api';
})();

let CURRENT_PATIENT_ID = (typeof localStorage !== 'undefined' && localStorage.getItem('hc_patient_id')) || 'pat-ramesh-001';

function getActivePatientId() {
  if (typeof window !== 'undefined' && window.PATIENT_ID) return window.PATIENT_ID;
  return CURRENT_PATIENT_ID;
}

function clearActivePatientId() {
  CURRENT_PATIENT_ID = null;
  try { localStorage.removeItem('hc_patient_id'); } catch (e) {}
}

function setActivePatientId(id) {
  if (!id) return;
  CURRENT_PATIENT_ID = id;
  if (typeof window !== 'undefined') window.PATIENT_ID = id;
  try { localStorage.setItem('hc_patient_id', id); } catch (e) {}
}

// ─── Base REST fetch fallback ────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      const preview = (await res.text()).slice(0, 120);
      return { success: false, error: { code: 'NON_JSON_RESPONSE', message: `API returned a non-JSON response (HTTP ${res.status}). Check backend deployment and API URL. ${preview.startsWith('<') ? 'The server returned HTML instead of API data.' : ''}` } };
    }
    const json = await res.json();
    if (!res.ok) console.warn(`[API] ${options.method || 'GET'} ${path} → ${res.status}`, json);
    return json;
  } catch (err) {
    console.debug(`[API] REST endpoint unreachable: ${path}`);
    return { success: false, error: { code: 'NETWORK_ERROR', message: err.message } };
  }
}

function isFirebaseActive() {
  return false; // Patient authentication is migrating to Supabase.
}
function isSupabaseActive() {
  return Boolean(window.HC_SUPABASE);
}
function mapSupabasePatient(user, profile = {}) {
  return {
    id: user.id,
    name: profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Patient',
    email: user.email || '',
    phone: profile.phone || user.user_metadata?.phone || user.phone || '',
    uhid: profile.uhid || '',
    blood_group: profile.blood_group || '',
    dob: profile.date_of_birth || '',
    gender: profile.gender || ''
  };
}
async function getSupabasePatient(user) {
  let profile = null;
  const result = await window.HC_SUPABASE.from('patient_profiles').select('*').eq('id', user.id).maybeSingle();
  if (!result.error) profile = result.data;
  else console.warn('[Supabase] Patient profile lookup failed:', result.error.message);
  return mapSupabasePatient(user, profile || {});
}

// ─── Unified API functions ───────────────────────────────────────────────────
const API = {
  setActivePatientId,
  getActivePatientId,

  /** GET /health / Backend status */
  health: async () => ({
    success: Boolean(isSupabaseActive()),
    data: { status: isSupabaseActive() ? 'auth-connected' : 'unavailable', backend: 'supabase-auth' },
    message: isSupabaseActive() ? 'Supabase Auth client initialized; clinical record APIs are separate.' : 'Supabase client unavailable.'
  }),

  /** Sign in with Supabase Auth. Email is required for Supabase password sign-in. */
  login: async (identifier, password = '', rememberMe = true) => {
    if (!isSupabaseActive()) return { success: false, error: { message: 'Supabase client is unavailable. Refresh the page and try again.' } };
    const email = String(identifier || '').trim().toLowerCase();
    if (!email.includes('@')) return { success: false, error: { message: 'Please enter the email address used when creating your account.' } };
    const { data, error } = await window.HC_SUPABASE.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: { code: error.code || 'AUTH_ERROR', message: error.message } };
    if (!data.user || !data.session) return { success: false, error: { message: 'No active session returned. Check your email confirmation settings.' } };
    const patient = await getSupabasePatient(data.user);
    setActivePatientId(patient.id);
    return { success: true, data: { access_token: data.session.access_token, patient }, message: 'Signed in with Supabase.' };
  },

  /** Register with Supabase Auth. A database trigger creates patient_profiles. */
  register: async (name, email = '', phone = '', password = '') => {
    if (!isSupabaseActive()) return { success: false, error: { message: 'Supabase client is unavailable. Refresh the page and try again.' } };
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail.includes('@')) return { success: false, error: { message: 'Please enter a valid email address.' } };
    if (String(password).length < 8) return { success: false, error: { message: 'Passcode must contain at least 8 characters.' } };
    const { data, error } = await window.HC_SUPABASE.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { full_name: String(name || '').trim(), phone: String(phone || '').trim() } }
    });
    if (error) return { success: false, error: { code: error.code || 'SIGNUP_ERROR', message: error.message } };
    if (!data.user) return { success: false, error: { message: 'Supabase did not return a user. Please try again.' } };
    if (!data.session) return { success: false, error: { message: 'Account created. Check your email for the confirmation link, then sign in.' } };
    const patient = await getSupabasePatient(data.user);
    setActivePatientId(patient.id);
    return { success: true, data: { access_token: data.session.access_token, patient }, message: 'Account created with Supabase.' };
  },

  signOut: async () => {
    if (isSupabaseActive()) {
      const { error } = await window.HC_SUPABASE.auth.signOut();
      if (error) console.warn('[Supabase] Sign-out failed:', error.message);
    }
    clearActivePatientId();
  },

  /** POST /auth/google */
  googleAuth: async (email, name, googleId = null) => {
    const res = await apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ email, name, google_id: googleId }),
    });
    if (res?.success && res.data?.patient?.id) {
      setActivePatientId(res.data.patient.id);
      return res;
    }

    return {
      success: false,
      error: res?.error || { code: 'GOOGLE_AUTH_UNAVAILABLE', message: 'Google sign-in could not be verified. Please try again.' },
      message: res?.message || 'Google sign-in failed. No local-only account was created.',
    };
  },

  /** GET /auth/me */
  getCurrentUser: async (token) => {
    return apiFetch(`/auth/me${token ? `?token=${encodeURIComponent(token)}` : ''}`);
  },

  /** GET /patients/{id} */
  getPatient: async (id = getActivePatientId()) => {
    if (isFirebaseActive() && window.FirebaseService) {
      try {
        const patient = await window.FirebaseService.getPatient(id);
        if (patient) return { success: true, data: patient };
      } catch (e) {
        console.warn('[Firebase] getPatient fallback:', e);
      }
    }
    return apiFetch(`/patients/${id}`);
  },

  /** GET /patients/{id}/summary */
  getHealthSummary: async (id = getActivePatientId()) => {
    return apiFetch(`/patients/${id}/summary`);
  },

  /** GET /patients/{id}/visits */
  getVisits: async (id = getActivePatientId()) => {
    if (isFirebaseActive() && window.FirebaseService) {
      try {
        const visits = await window.FirebaseService.getVisits(id);
        if (visits && visits.length > 0) return { success: true, data: visits };
      } catch (e) {
        console.warn('[Firebase] getVisits fallback:', e);
      }
    }
    return apiFetch(`/patients/${id}/visits`);
  },

  /** POST /patients/{id}/visits */
  createVisit: async (id = getActivePatientId(), payload = {}) => {
    if (isFirebaseActive() && window.FirebaseService) {
      try {
        const visit = await window.FirebaseService.createVisit(id, payload);
        return { success: true, data: visit };
      } catch (e) {
        console.warn('[Firebase] createVisit fallback:', e);
      }
    }
    return apiFetch(`/patients/${id}/visits`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** GET /patients/{id}/documents */
  getDocuments: async (id = getActivePatientId(), type = null) => {
    if (isFirebaseActive() && window.FirebaseService) {
      try {
        const docs = await window.FirebaseService.getDocuments(id, type);
        if (docs && docs.length > 0) return { success: true, data: docs };
      } catch (e) {
        console.warn('[Firebase] getDocuments fallback:', e);
      }
    }
    return apiFetch(`/patients/${id}/documents${type ? `?document_type=${type}` : ''}`);
  },

  /** POST /patients/{id}/documents/upload or /patients/{id}/documents */
  uploadDocument: async (id = getActivePatientId(), payload = {}) => {
    // Check if real File object is provided
    if (payload.file instanceof File || payload.file instanceof Blob) {
      try {
        const formData = new FormData();
        formData.append('file', payload.file, payload.file.name || payload.file_name || 'document.pdf');
        formData.append('patient_id', id);
        if (payload.document_type) formData.append('document_type', payload.document_type);
        if (payload.visit_id) formData.append('visit_id', payload.visit_id);

        const res = await fetch(`${API_BASE}/patients/${id}/documents/upload`, {
          method: 'POST',
          body: formData,
        });
        const json = await res.json();
        if (json && json.success) return json;
      } catch (err) {
        console.warn('[API] Multipart upload failed, falling back to JSON:', err);
      }
    }

    if (isFirebaseActive() && window.FirebaseService) {
      try {
        const doc = await window.FirebaseService.uploadMedicalDocument(id, payload.file || null, payload);
        return { success: true, data: doc };
      } catch (e) {
        console.warn('[Firebase] uploadDocument fallback:', e);
      }
    }

    return apiFetch(`/patients/${id}/documents`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** POST /documents/{id}/review */
  reviewDocument: async (docId, reviewPayload = {}) => {
    return apiFetch(`/documents/${docId}/review`, {
      method: 'POST',
      body: JSON.stringify(reviewPayload),
    });
  },


  /** GET /patients/{id}/medications */
  getMedications: async (id = getActivePatientId(), status = null) => {
    if (isFirebaseActive() && window.FirebaseService) {
      try {
        const meds = await window.FirebaseService.getMedications(id, status);
        if (meds && meds.length > 0) return { success: true, data: meds };
      } catch (e) {
        console.warn('[Firebase] getMedications fallback:', e);
      }
    }
    return apiFetch(`/patients/${id}/medications${status ? `?status=${status}` : ''}`);
  },

  /** GET /patients/{id}/labs */
  getLabs: async (id = getActivePatientId()) => {
    if (isFirebaseActive() && window.FirebaseService) {
      try {
        const labs = await window.FirebaseService.getLabs(id);
        if (labs && labs.length > 0) return { success: true, data: labs };
      } catch (e) {
        console.warn('[Firebase] getLabs fallback:', e);
      }
    }
    return apiFetch(`/patients/${id}/labs`);
  },

  /** GET /patients/{id}/changes */
  getChanges: (id = getActivePatientId(), reviewStatus = null) =>
    apiFetch(`/patients/${id}/changes${reviewStatus ? `?review_status=${reviewStatus}` : ''}`),

  /** GET /changes/{id} */
  getChange: (changeId) => apiFetch(`/changes/${changeId}`),

  /** GET /changes/{id}/evidence */
  getEvidence: (changeId) => apiFetch(`/changes/${changeId}/evidence`),

  /** GET /patients/{id}/decisions */
  getDecisions: (id = getActivePatientId()) => apiFetch(`/patients/${id}/decisions`),

  /** GET /patients/{id}/decision-memory */
  getDecisionMemory: async (id = getActivePatientId()) => {
    if (isFirebaseActive() && window.FirebaseService) {
      try {
        const memory = await window.FirebaseService.getDecisionMemory(id);
        if (memory && memory.length > 0) return { success: true, data: memory };
      } catch (e) {
        console.warn('[Firebase] getDecisionMemory fallback:', e);
      }
    }
    return apiFetch(`/patients/${id}/decision-memory`);
  },

  /** POST /doctor-access/generate */
  generateAccessCode: async (payload = {}) => {
    const curId = getActivePatientId();
    if (isFirebaseActive() && window.FirebaseService) {
      try {
        const grant = await window.FirebaseService.createAccessGrant(curId, payload);
        return { success: true, data: grant };
      } catch (e) {
        console.warn('[Firebase] generateAccessCode fallback:', e);
      }
    }
    return apiFetch('/doctor-access/generate', {
      method: 'POST',
      body: JSON.stringify({ patient_id: curId, ...payload }),
    });
  },

  /** POST /doctor-access/verify */
  verifyAccessCode: async (code) => {
    if (isFirebaseActive() && window.FirebaseService) {
      try {
        const grant = await window.FirebaseService.verifyAccessCode(code);
        if (grant) return { success: true, data: grant };
      } catch (e) {
        console.warn('[Firebase] verifyAccessCode fallback:', e);
      }
    }
    return apiFetch('/doctor-access/verify', {
      method: 'POST',
      body: JSON.stringify({ access_code: code }),
    });
  },

  /** POST /doctor-access/approve */
  approveAccess: (accessId) =>
    apiFetch('/doctor-access/approve', {
      method: 'POST',
      body: JSON.stringify({ access_id: accessId }),
    }),

  /** POST /doctor-access/revoke */
  revokeAccess: (accessId) => {
    const curId = getActivePatientId();
    return apiFetch('/doctor-access/revoke', {
      method: 'POST',
      body: JSON.stringify({ access_id: accessId, patient_id: curId }),
    });
  },

  /** POST /patients/{id}/companion/ask (legacy) */
  askCompanion: (query, id = getActivePatientId()) =>
    apiFetch(`/patients/${id}/companion/ask`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  /** POST /patients/{id}/companion/chat (production conversational companion) */
  chatCompanion: (query, id = getActivePatientId(), conversationId = null, language = 'en') =>
    apiFetch(`/patients/${id}/companion/chat`, {
      method: 'POST',
      body: JSON.stringify({
        query,
        conversation_id: conversationId,
        language: language || 'en',
      }),
    }),

  /** GET /patients/{id}/conversations */
  getConversations: (id = getActivePatientId()) =>
    apiFetch(`/patients/${id}/conversations`),

  /** GET /patients/{id}/conversations/{convId}/messages */
  getConversationMessages: (convId, id = getActivePatientId()) =>
    apiFetch(`/patients/${id}/conversations/${convId}/messages`),

  /** POST /doctor-access/generate (Patient generates 20-minute demonstration PIN) */
  generateDemoPin: async (patientId = getActivePatientId(), scopes = ["medical_history", "medications", "reports", "changes", "documents"], doctorName = null) => {
    return apiFetch('/doctor-access/generate', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: patientId,
        requested_scopes: scopes,
        doctor_name: doctorName,
      }),
    });
  },

  /** POST /doctor-access/revoke (Patient or doctor revokes demonstration PIN) */
  revokeDemoPin: async (accessId, patientId = getActivePatientId()) => {
    return apiFetch('/doctor-access/revoke', {
      method: 'POST',
      body: JSON.stringify({
        access_id: accessId,
        patient_id: patientId,
      }),
    });
  },

  /** GET /doctor-access/{patient_id} (List access records for patient) */
  getPatientAccessGrants: async (patientId = getActivePatientId()) => {
    return apiFetch(`/doctor-access/${patientId}`);
  },
};

// ─── Backend availability & Firebase connection check ─────────────────────────
let backendAvailable = false;

async function checkBackend() {
  const curId = getActivePatientId();
  // Check Firebase first
  if (window.FirebaseConfig && typeof window.FirebaseConfig.initFirebase === 'function') {
    const fb = await window.FirebaseConfig.initFirebase();
    if (fb.isConfigured) {
      backendAvailable = true;
      console.info('[Backend] Firebase (Cloud Firestore & Storage) connected ✓');
      if (window.FirebaseService && typeof window.FirebaseService.seedInitialDataIfEmpty === 'function' && window.STATE) {
        window.FirebaseService.seedInitialDataIfEmpty(curId, window.STATE);
      }
      return true;
    }
  }

  // Check REST API
  const res = await API.health();
  backendAvailable = res?.success === true;
  if (backendAvailable) {
    console.info('[API] Backend REST API connected ✓');
  } else {
    console.info('[API] Using local client cache / mock mode');
  }
  return backendAvailable;
}

// Export globally
window.API = API;
window.PATIENT_ID = CURRENT_PATIENT_ID;
window.checkBackend = checkBackend;
window.isBackendAvailable = () => backendAvailable;
window.isFirebaseActive = isFirebaseActive;
window.isSupabaseActive = isSupabaseActive;
