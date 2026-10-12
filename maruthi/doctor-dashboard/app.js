(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const API_BASE = (() => {
    let base = typeof window.HC_API_BASE_URL === 'string' ? window.HC_API_BASE_URL.trim() : '';
    base = base.replace(/\/+$/, '');
    if (base.toLowerCase().endsWith('/api')) base = base.slice(0, -4);
    return base;
  })();
  const state = { token: sessionStorage.getItem('hc_doctor_token') || '', doctor: null, grant: null, patient: null, records: null, sessions: 0 };
  const loginView = $('#login-view');
  const workspaceView = $('#workspace-view');
  const showMessage = (element, text, kind = 'info') => {
    element.textContent = text;
    element.className = 'message ' + kind;
    element.hidden = false;
  };
  const hideMessage = (element) => { element.hidden = true; element.textContent = ''; };
  const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase() || 'DR';
  const api = async (path, options = {}) => {
    if (!API_BASE) throw new Error('API base URL is not configured. Set HC_API_BASE_URL in the Netlify site environment variables, then redeploy.');
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(API_BASE + '/api' + path, { ...options, headers });
    } catch {
      throw new Error('Cannot reach the HealthContinuum API. Check the Render service and its CORS settings.');
    }
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : { message: 'The API returned a non-JSON response.' };
    if (!response.ok) {
      if (response.status === 401) {
        signOut(false);
        throw new Error(payload.detail?.message || payload.message || 'Your session expired. Please sign in again.');
      }
      throw new Error(payload.detail?.message || payload.detail || payload.message || ('Request failed (' + response.status + ').'));
    }
    return payload;
  };
  function setBusy(button, busy, label) {
    if (busy) { button.dataset.original = button.innerHTML; button.disabled = true; button.textContent = label || 'Please wait…'; }
    else { button.disabled = false; if (button.dataset.original) button.innerHTML = button.dataset.original; }
  }
  function showWorkspace() {
    loginView.hidden = true; workspaceView.hidden = false;
    const name = state.doctor?.fullName || state.doctor?.full_name || 'Doctor';
    const spec = state.doctor?.specialty || 'Clinical team';
    $('#doctor-name').textContent = name;
    $('#doctor-specialty').textContent = spec;
    $('#doctor-avatar').textContent = initials(name);
    $('#top-avatar').textContent = initials(name);
    $('#page-title').textContent = 'Good to see you, ' + (name.split(' ')[0] || 'Doctor');
    $('#api-status').innerHTML = '<i></i> API connected';
    $('#api-status').style.color = '#16857c';
    renderMetrics();
  }
  function signOut(callApi = true) {
    if (callApi && state.token) fetch(API_BASE + '/api/auth/doctor/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + state.token } }).catch(() => {});
    sessionStorage.removeItem('hc_doctor_token');
    state.token = ''; state.doctor = null; state.grant = null; state.patient = null; state.records = null;
    workspaceView.hidden = true; loginView.hidden = false;
    $('#password').value = '';
    $('#login-form').reset();
    hideMessage($('#login-error'));
    resetPatientViews();
  }
  function renderMetrics() {
    $('#metric-sessions').textContent = String(state.sessions);
    $('#metric-patient').textContent = state.patient?.fullName || 'None';
    $('#metric-docs').textContent = state.records ? String(state.records.documents?.length || 0) : '—';
  }
  function resetPatientViews() {
    $('#patient-empty').hidden = false; $('#patient-record').hidden = true;
    $('#documents-empty').hidden = false; $('#documents-list').hidden = true;
    $('#metric-patient').textContent = 'None'; $('#metric-docs').textContent = '—';
  }
  function activateTab(tab) {
    document.querySelectorAll('.tab-page').forEach(el => el.hidden = el.id !== 'tab-' + tab);
    document.querySelectorAll('.side-link').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    const labels = { overview: 'Overview', records: 'Patient records', documents: 'Documents & OCR' };
    $('#breadcrumb-current').textContent = labels[tab] || 'Overview';
    $('#page-title').textContent = tab === 'overview' ? 'Good to see you, ' + ((state.doctor?.fullName || 'Doctor').split(' ')[0]) : labels[tab];
  }
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function recordRows(items, title, nameKey, detailKey, statusKey) {
    if (!items?.length) return '<div class="record-row"><div class="record-main"><b>No records available</b><small>No ' + escapeHTML(title.toLowerCase()) + ' were returned for this patient.</small></div></div>';
    return items.map(item => '<div class="record-row"><div class="record-main"><b>' + escapeHTML(item[nameKey] || item.title || title) + '</b><small>' + escapeHTML(item[detailKey] || item.documentDate || item.testDate || item.test_date || item.visitDate || item.visit_date || '') + '</small></div><span class="record-chip">' + escapeHTML(item[statusKey] || item.processingStatus || item.processing_status || 'Available') + '</span></div>').join('');
  }
  function renderPatientRecords() {
    const p = state.records?.patient || state.patient || {};
    const visits = state.records?.visits || [];
    const meds = state.records?.medications || [];
    const labs = state.records?.lab_results || state.records?.labResults || [];
    const docs = state.records?.documents || [];
    $('#patient-empty').hidden = true; $('#patient-record').hidden = false;
    $('#patient-record').innerHTML =
      '<div class="patient-summary">' +
      '<div class="data-card"><small>Patient name</small><b>' + escapeHTML(p.fullName || p.name || 'Authorized patient') + '</b></div>' +
      '<div class="data-card"><small>Patient ID / UHID</small><b>' + escapeHTML(p.appPatientId || p.uhid || p.id || '—') + '</b></div>' +
      '<div class="data-card"><small>Access grant</small><b>Active · 20 minutes</b></div></div>' +
      '<div class="data-section"><h3>Visit history · ' + visits.length + '</h3>' + recordRows(visits, 'Visit', 'visitType', 'visitDate', 'status') + '</div>' +
      '<div class="data-section"><h3>Medication history · ' + meds.length + '</h3>' + recordRows(meds, 'Medication', 'name', 'dosage', 'status') + '</div>' +
      '<div class="data-section"><h3>Lab results · ' + labs.length + '</h3>' + recordRows(labs, 'Lab result', 'testName', 'resultValue', 'status') + '</div>';
    $('#documents-empty').hidden = true; $('#documents-list').hidden = false;
    $('#documents-list').innerHTML = '<div class="data-section"><h3>Source documents · ' + docs.length + '</h3>' +
      (docs.length ? docs.map(doc => '<div class="record-row"><div class="record-main"><b>' + escapeHTML(doc.title || doc.fileName || doc.file_name || 'Medical document') + '</b><small>' + escapeHTML(doc.documentDate || doc.uploadedAt || doc.uploaded_at || 'Date unavailable') + ' · ' + escapeHTML(doc.documentType || doc.document_type || doc.category || 'Document') + '</small></div><span class="record-chip">' + escapeHTML(doc.verified ? 'Processed' : doc.processingStatus || doc.processing_status || 'Needs review') + '</span></div>').join('') :
      '<div class="record-row"><div class="record-main"><b>No source documents available</b><small>Nothing has been uploaded to this patient record yet.</small></div></div>') + '</div>';
    renderMetrics();
  }
  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage($('#login-error'));
    const button = $('#login-submit'); setBusy(button, true, 'Verifying credentials…');
    try {
      const payload = await api('/auth/doctor/login', { method: 'POST', body: JSON.stringify({ email: $('#email').value.trim(), password: $('#password').value }) });
      if (!payload.success || !payload.data?.access_token || !payload.data?.doctor) throw new Error(payload.message || 'Sign in failed. No doctor session was returned.');
      state.token = payload.data.access_token; state.doctor = payload.data.doctor;
      sessionStorage.setItem('hc_doctor_token', state.token);
      state.sessions = 0;
      showWorkspace();
    } catch (error) { showMessage($('#login-error'), error.message || 'Sign in failed. Please try again.', 'error'); }
    finally { setBusy(button, false); }
  });
  $('#toggle-password').addEventListener('click', () => {
    const field = $('#password'); const showing = field.type === 'text'; field.type = showing ? 'password' : 'text'; $('#toggle-password').textContent = showing ? 'Show' : 'Hide';
  });
  $('#verify-pin').addEventListener('click', async () => {
    const pin = $('#access-pin').value.trim(); const button = $('#verify-pin'); hideMessage($('#pin-message'));
    if (!/^\d{6}$/.test(pin)) { showMessage($('#pin-message'), 'Enter the six-digit PIN shared by the patient.', 'error'); return; }
    setBusy(button, true, 'Checking PIN…');
    try {
      const verified = await api('/doctor-access/verify', { method: 'POST', body: JSON.stringify({ access_code: pin }) });
      const data = verified.data || {};
      if (!verified.success || !data.patient?.id || !data.grant?.id) throw new Error(verified.message || 'The API did not return an active access grant.');
      state.patient = data.patient; state.grant = data.grant; state.sessions += 1;
      showMessage($('#pin-message'), 'Access verified. Loading only the records permitted by the current grant…', 'success');
      const response = await api('/doctor-access/permitted-records/' + encodeURIComponent(data.patient.id));
      if (!response.success || !response.data) throw new Error(response.message || 'The authorized record could not be loaded.');
      state.records = response.data;
      renderPatientRecords();
      showMessage($('#global-message'), 'Patient access verified. Check the grant expiry before continuing your review.', 'success');
      $('#access-pin').value = '';
      activateTab('records');
    } catch (error) {
      showMessage($('#pin-message'), error.message || 'PIN verification failed.', 'error');
    } finally { setBusy(button, false); }
  });
  document.querySelectorAll('.side-link').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.tab)));
  document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.go)));
  $('#refresh-records').addEventListener('click', async () => {
    if (!state.patient?.id) { activateTab('overview'); return; }
    const button = $('#refresh-records'); setBusy(button, true, 'Refreshing…');
    try {
      const response = await api('/doctor-access/permitted-records/' + encodeURIComponent(state.patient.id));
      if (!response.success || !response.data) throw new Error(response.message || 'Unable to refresh records.');
      state.records = response.data; renderPatientRecords();
      showMessage($('#global-message'), 'Records refreshed from the API.', 'success');
    } catch (error) { showMessage($('#global-message'), error.message || 'Refresh failed.', 'error'); }
    finally { setBusy(button, false); }
  });
  $('#signout').addEventListener('click', () => signOut(true));
  // Restore a previous tab session only after server-side doctor token validation.
  async function restoreSession() {
    if (!state.token) return;
    try {
      const result = await api('/auth/doctor/me');
      if (!result.success || !result.data?.doctor) throw new Error('No valid doctor session.');
      state.doctor = result.data.doctor; showWorkspace();
    } catch { signOut(false); }
  }
  if (!API_BASE) {
    $('#api-status').innerHTML = '<i></i> API URL not configured';
    $('#api-status').style.color = '#b45c4f';
  }
  restoreSession();
})();