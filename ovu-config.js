/* Rhythme server settings: the one place the Supabase project is named.
 * Moving to another project means changing SUPABASE_REF here, `project_id` in
 * supabase/config.toml, and nothing else in the app. The only key here is the
 * publishable (anon) key, which is meant to live in the browser; it grants
 * nothing on its own because every table is behind row level security. The
 * relay functions still read the model key from Vault on the server. */
(function (root) {
  'use strict';
  var SUPABASE_REF = 'zodkohwaznqgrfrcfdkf';
  var BASE = 'https://' + SUPABASE_REF + '.supabase.co';
  root.OVU_CONFIG = {
    supabaseRef: SUPABASE_REF,
    supabaseUrl: BASE,
    /* publishable key, safe in client code; rotate in the Supabase dashboard */
    supabaseKey: 'sb_publishable_tXz42ZR9Sg6ypfnWRfdW5w_YHtc3ZWH',
    functionsBase: BASE + '/functions/v1',
    /* Social sign-in buttons stay hidden until the provider is configured in
     * Supabase (Authentication > Providers) and switched on here. Email works
     * without any of this. See STATUS.md for the exact Google and Apple steps. */
    oauth: { google: false, apple: false },
    /* Luna's AI help is paused (launch sweep, 20 Oct 2026): the AI service's terms (Volcengine Ark platform terms 3.1,
     * Doubao model agreement 1.2) license use only in mainland China, so it stays off until a service licensed for
     * Singapore users is in place. While paused, the three Luna AI choices cannot be turned on and no AI request is made.
     * The browser tests set window.OVU_AI_PAUSE_OVERRIDE = false to keep exercising the AI paths. */
    aiPaused: root.OVU_AI_PAUSE_OVERRIDE === false ? false : true,
    /* Reading Apple Health directly (ovu-healthnative.js) works only inside the iOS app shell, and only once
     * the HealthKit capability is on the App ID and in ios/App/App/App.entitlements. Off until then; with it
     * off, or in any browser, the Connect Apple Health row never shows and nothing native is called.
     * Health Connect on Android is planned, not built (docs/design/2026-10-21-health-connect-native.md). */
    nativeHealth: { apple: root.OVU_NATIVE_HEALTH_OVERRIDE === true }
  };
})(window);
