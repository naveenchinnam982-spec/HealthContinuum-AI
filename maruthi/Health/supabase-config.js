/* HealthContinuum AI — Supabase browser client.
 * Only the public anon/publishable key belongs in frontend code.
 * Never put service_role or secret keys here.
 */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://yksxrdcbdpepkqsdjjap.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrc3hyZGNiZHBlcGtxc2RqamFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NTA1MDMsImV4cCI6MjEwNzMyNjUwM30.qhDVEgC_TlEeHuGdo9T51Dyq52CiS2cfy1DmvAmNiVU';
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[Supabase] SDK failed to load.');
    window.HC_SUPABASE = null;
    return;
  }
  window.HC_SUPABASE = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
