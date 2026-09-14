-- Run only in a separate test project after the migration.
-- No email is sent; synthetic Auth rows are rolled back at the end.
begin;
insert into auth.users(id, email, raw_user_meta_data)
values ('a0000000-0000-4000-8000-000000000001', 'checkmate-rls-a@example.invalid', '{"full_name":"RLS A"}'),
       ('b0000000-0000-4000-8000-000000000002', 'checkmate-rls-b@example.invalid', '{"full_name":"RLS B"}');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
do $$
declare t text; result jsonb;
begin
 foreach t in array array['checkmate_exams','checkmate_answer_keys','checkmate_classes','checkmate_rosters','checkmate_scans','checkmate_preferences','checkmate_templates'] loop
  result := public.checkmate_write(t, '10000000-0000-4000-8000-000000000001', 'rls-test', '{}', 0, '20000000-0000-4000-8000-000000000001', false);
  if not (result->>'ok')::boolean then raise exception 'Owner insert failed'; end if;
  result := public.checkmate_write(t, '10000000-0000-4000-8000-000000000001', 'rls-test', '{}', 0, '20000000-0000-4000-8000-000000000001', false);
  if (result->'row'->>'version')::integer <> 1 then raise exception 'Retry created a duplicate revision'; end if;
  result := public.checkmate_write(t, '10000000-0000-4000-8000-000000000001', 'rls-test', '{"changed":true}', 0, '30000000-0000-4000-8000-000000000001', false);
  if (result->>'ok')::boolean then raise exception 'Stale write was accepted'; end if;
 end loop;
end $$;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
do $$
declare t text; count_rows integer;
begin
 foreach t in array array['checkmate_exams','checkmate_answer_keys','checkmate_classes','checkmate_rosters','checkmate_scans','checkmate_preferences','checkmate_templates'] loop
  execute format('select count(*) from public.%I', t) into count_rows;
  if count_rows <> 0 then raise exception 'Cross-account SELECT leaked data: %', t; end if;
  execute format('update public.%I set data = ''{}'' where local_id = ''rls-test''', t);
  get diagnostics count_rows = row_count;
  if count_rows <> 0 then raise exception 'Cross-account UPDATE allowed: %', t; end if;
  execute format('delete from public.%I where local_id = ''rls-test''', t);
  get diagnostics count_rows = row_count;
  if count_rows <> 0 then raise exception 'Cross-account DELETE allowed: %', t; end if;
  begin
   execute format('insert into public.%I(id,owner_id,local_id,data,mutation_id) values ($1,$2,$3,$4,$5)', t)
    using '40000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'forged', '{}'::jsonb, '50000000-0000-4000-8000-000000000001'::uuid;
   raise exception 'Forged ownership was accepted: %', t;
  exception when insufficient_privilege then null;
  end;
 end loop;
 if (select count(*) from public.profiles) <> 1 then raise exception 'Profile SELECT isolation failed'; end if;
 begin
  update public.profiles set role = 'instructor' where id = auth.uid();
  raise exception 'Client role escalation allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
set local role anon;
do $$
begin
 begin
  perform 1 from public.checkmate_exams;
  raise exception 'Anonymous table access allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
