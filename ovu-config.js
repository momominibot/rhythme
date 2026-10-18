/* Ovumind server settings: the one place the Supabase project is named.
 * Moving to another project means changing SUPABASE_REF here, `project_id` in
 * supabase/config.toml, and nothing else in the app. No keys live here: the
 * relay functions read the model key from Vault on the server. */
(function (root) {
  'use strict';
  var SUPABASE_REF = 'zodkohwaznqgrfrcfdkf';
  root.OVU_CONFIG = {
    supabaseRef: SUPABASE_REF,
    functionsBase: 'https://' + SUPABASE_REF + '.supabase.co/functions/v1'
  };
})(window);
