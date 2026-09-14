begin;
-- These new names avoid altering any legacy application tables.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check (length(full_name) <= 120),
 school_name text not null default '' check (length(school_name) <= 200),
 teacher_id text not null default '' check (length(teacher_id) <= 80),
 phone text not null default '' check (length(phone) <= 40),
 avatar_path text,
 role text not null default 'teacher' check (role in ('teacher', 'instructor')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid()) is not null and id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid()) is not null and id = (select auth.uid()) and role = 'teacher');
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid()) is not null and id = (select auth.uid())) with check ((select auth.uid()) is not null and id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using ((select auth.uid()) is not null and id = (select auth.uid()));
revoke all on public.profiles from anon, authenticated;
grant select, delete on public.profiles to authenticated;
grant insert (id, full_name, school_name, teacher_id, phone, avatar_path) on public.profiles to authenticated;
grant update (full_name, school_name, teacher_id, phone, avatar_path) on public.profiles to authenticated;
create function public.checkmate_profile_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id, full_name)
 values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
 on conflict (id) do nothing;
 return new;
end $$;
revoke all on function public.checkmate_profile_created() from public, anon, authenticated;
create trigger checkmate_auth_profile after insert on auth.users for each row execute function public.checkmate_profile_created();
insert into public.profiles(id, full_name)
 select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 120) from auth.users on conflict (id) do nothing;
create function public.checkmate_profile_updated() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger checkmate_profile_timestamp before update on public.profiles for each row execute function public.checkmate_profile_updated();

do $$
declare t text;
begin
 foreach t in array array['checkmate_exams','checkmate_answer_keys','checkmate_classes','checkmate_rosters','checkmate_scans','checkmate_preferences','checkmate_templates'] loop
  execute format('create table public.%I (
    id uuid primary key,
    owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    local_id text not null check (length(local_id) <= 200),
    data jsonb not null,
    version bigint not null default 1 check (version > 0),
    mutation_id uuid not null,
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    unique(owner_id, local_id)
  )', t);
  execute format('alter table public.%I enable row level security', t);
  execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) is not null and owner_id = (select auth.uid()))', t);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) is not null and owner_id = (select auth.uid()))', t);
  execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) is not null and owner_id = (select auth.uid())) with check ((select auth.uid()) is not null and owner_id = (select auth.uid()))', t);
  execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) is not null and owner_id = (select auth.uid()))', t);
  execute format('revoke all on public.%I from anon, authenticated', t);
  execute format('grant select, insert, update, delete on public.%I to authenticated', t);
 end loop;
end $$;

-- Invoker rights retain RLS. Identity is taken only from the authenticated JWT.
create function public.checkmate_write(p_table text, p_id uuid, p_local_id text, p_data jsonb,
 p_version bigint, p_mutation uuid, p_deleted boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing jsonb; result jsonb; uid uuid := auth.uid();
begin
 if uid is null then raise insufficient_privilege; end if;
 if not p_table = any(array['checkmate_exams','checkmate_answer_keys','checkmate_classes','checkmate_rosters','checkmate_scans','checkmate_preferences','checkmate_templates'])
 then raise invalid_parameter_value; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text || p_table || p_local_id, 0));
 execute format('select to_jsonb(t) from public.%I t where owner_id = $1 and local_id = $2 for update', p_table) into existing using uid, p_local_id;
 if existing is not null then
  if existing->>'mutation_id' = p_mutation::text then return jsonb_build_object('ok', true, 'row', existing); end if;
  if (existing->>'version')::bigint <> p_version or existing->>'id' <> p_id::text then
   return jsonb_build_object('ok', false, 'row', existing);
  end if;
  execute format('update public.%I set data=$1, version=version+1, mutation_id=$2, updated_at=now(), deleted_at=case when $3 then now() else null end where owner_id=$4 and id=$5 returning to_jsonb(%I.*)', p_table, p_table)
   into result using p_data, p_mutation, p_deleted, uid, p_id;
 else
  if p_version <> 0 then raise invalid_parameter_value; end if;
  execute format('insert into public.%I(id, owner_id, local_id, data, mutation_id, deleted_at) values ($1,$2,$3,$4,$5,case when $6 then now() else null end) returning to_jsonb(%I.*)', p_table, p_table)
   into result using p_id, uid, p_local_id, p_data, p_mutation, p_deleted;
 end if;
 return jsonb_build_object('ok', true, 'row', result);
end $$;
revoke all on function public.checkmate_write(text,uuid,text,jsonb,bigint,uuid,boolean) from public, anon;
grant execute on function public.checkmate_write(text,uuid,text,jsonb,bigint,uuid,boolean) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('checkmate-avatars', 'checkmate-avatars', false, 2097152, array['image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png'];
create policy checkmate_avatar_select on storage.objects for select to authenticated using (auth.uid() is not null and bucket_id = 'checkmate-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy checkmate_avatar_insert on storage.objects for insert to authenticated with check (auth.uid() is not null and bucket_id = 'checkmate-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy checkmate_avatar_update on storage.objects for update to authenticated using (auth.uid() is not null and bucket_id = 'checkmate-avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (auth.uid() is not null and bucket_id = 'checkmate-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy checkmate_avatar_delete on storage.objects for delete to authenticated using (auth.uid() is not null and bucket_id = 'checkmate-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
commit;
