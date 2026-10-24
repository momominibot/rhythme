-- Staff dashboard run failed on 23 Oct 2026 with "DELETE requires a WHERE clause": staff.metrics_build empties its two
-- temp tables with a bare DELETE, which the database's safe-update guard refuses. Same function, the two statements
-- given "where true". Checked against the live body first, so a changed function stops here instead of being replaced.
do $$
declare d text := pg_get_functiondef('staff.metrics_build(uuid,integer)'::regprocedure);
begin
  if position('delete from pg_temp.elig_users;' in d) = 0 or position('delete from pg_temp.elig_rows;' in d) = 0 then
    raise exception 'staff.metrics_build is not the expected body; review before applying';
  end if;
  execute replace(replace(d, 'delete from pg_temp.elig_users;', 'delete from pg_temp.elig_users where true;'),
                  'delete from pg_temp.elig_rows;', 'delete from pg_temp.elig_rows where true;');
end $$;
