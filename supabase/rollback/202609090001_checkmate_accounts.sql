begin;
-- Data-preserving rollback: archive, never DROP the data tables.
-- Do not expose this schema in Supabase API settings.
create schema if not exists checkmate_rollback;
revoke all on schema checkmate_rollback from public, anon, authenticated;
drop trigger if exists checkmate_auth_profile on auth.users;
drop function if exists public.checkmate_profile_created();
drop function if exists public.checkmate_write(text,uuid,text,jsonb,bigint,uuid,boolean);
do $$
declare t text;
begin
 foreach t in array array['profiles','checkmate_exams','checkmate_answer_keys','checkmate_classes','checkmate_rosters','checkmate_scans','checkmate_preferences','checkmate_templates'] loop
  execute format('alter table public.%I set schema checkmate_rollback', t);
 end loop;
end $$;
drop policy if exists checkmate_avatar_select on storage.objects;
drop policy if exists checkmate_avatar_insert on storage.objects;
drop policy if exists checkmate_avatar_update on storage.objects;
drop policy if exists checkmate_avatar_delete on storage.objects;
-- Avatar objects and the private bucket remain intact.
commit;
