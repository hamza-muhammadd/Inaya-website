-- =====================================================================
-- Inaya Quran Academy, Phase 6: USERS & ACCESS (owner only)
-- Additive. Safe to run twice.
-- The person must ALREADY exist in Supabase Authentication → Users
-- (invite or create them there first). These functions only grant a role.
-- Safeguards: owner-only, cannot change or remove yourself, cannot remove
-- or demote the last owner.
-- =====================================================================
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.list_admins()
returns table(user_id uuid, email text, role text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query select a.user_id, a.email, a.role, a.created_at from public.admin_users a order by a.created_at;
end $$;

create or replace function public.add_admin_by_email(p_email text, p_role text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_role not in ('owner','administrator','assessor','teacher','readonly') then raise exception 'Unknown role'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No Supabase login exists for that email. Create or invite the user in Authentication → Users first.'; end if;
  insert into public.admin_users(user_id, email, role) values (uid, lower(trim(p_email)), p_role)
  on conflict (user_id) do update set role = excluded.role;
end $$;

create or replace function public.set_admin_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own role'; end if;
  if p_role not in ('owner','administrator','assessor','teacher','readonly') then raise exception 'Unknown role'; end if;
  if p_role <> 'owner' and (select role from public.admin_users where user_id = p_user_id) = 'owner'
     and (select count(*) from public.admin_users where role = 'owner') <= 1 then raise exception 'Cannot demote the last owner'; end if;
  update public.admin_users set role = p_role where user_id = p_user_id;
end $$;

create or replace function public.remove_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  if (select role from public.admin_users where user_id = p_user_id) = 'owner'
     and (select count(*) from public.admin_users where role = 'owner') <= 1 then raise exception 'Cannot remove the last owner'; end if;
  delete from public.admin_users where user_id = p_user_id;
end $$;

revoke all on function public.list_admins() from public, anon;
revoke all on function public.add_admin_by_email(text, text) from public, anon;
revoke all on function public.set_admin_role(uuid, text) from public, anon;
revoke all on function public.remove_admin(uuid) from public, anon;
grant execute on function public.list_admins() to authenticated;
grant execute on function public.add_admin_by_email(text, text) to authenticated;
grant execute on function public.set_admin_role(uuid, text) to authenticated;
grant execute on function public.remove_admin(uuid) to authenticated;
