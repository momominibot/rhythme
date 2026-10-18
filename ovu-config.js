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
    oauth: { google: false, apple: false }
  };
})(window);
