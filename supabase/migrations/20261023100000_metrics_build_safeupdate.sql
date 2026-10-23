-- The staff dashboard's Run now failed on 23 Oct 2026 with "DELETE requires a WHERE clause": Supabase loads the
-- safeupdate guard for every API session (authenticator: session_preload_libraries = supautils, safeupdate), and
-- staff.metrics_build empties its two temporary tables with a bare DELETE. Local Postgres and CI have no safeupdate,
-- so every test passed. This rewrites only those two statements, in the function exactly as it is live, so nothing
-- else in the contract-v3 body changes. CREATE OR REPLACE keeps the owner and the grants.
do $mig$
declare
  d text := pg_get_functiondef('staff.metrics_build(uuid,integer)'::regprocedure);
  n text;
begin
  n := replace(d, 'delete from pg_temp.elig_users;', 'delete from pg_temp.elig_users where true;');
  n := replace(n, 'delete from pg_temp.elig_rows;', 'delete from pg_temp.elig_rows where true;');
  if n = d or position('elig_users where true' in n) = 0 or position('elig_rows where true' in n) = 0 then
    raise exception 'metrics_build: the two bare deletes were not found; nothing changed';
  end if;
  if n ~* 'delete\s+from\s+[a-z_.]+\s*;' then raise exception 'metrics_build: a bare delete is still there'; end if;
  execute n;
end
$mig$;
