
do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'is_admin() not found';
  end if;

  if to_regprocedure('public.is_staff()') is null then
    raise exception 'is_staff() not found';
  end if;

  if to_regclass('public.items') is null then
    raise exception 'items table not found';
  end if;
end
$$;

-- إعدادات الموقع
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read
on public.site_settings
for select to anon, authenticated
using (key = 'dl_verify');

drop policy if exists site_settings_admin_ins on public.site_settings;
create policy site_settings_admin_ins
on public.site_settings
for insert to authenticated
with check (public.is_admin());

drop policy if exists site_settings_admin_upd on public.site_settings;
create policy site_settings_admin_upd
on public.site_settings
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists site_settings_admin_del on public.site_settings;
create policy site_settings_admin_del
on public.site_settings
for delete to authenticated
using (public.is_admin());

revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

insert into public.site_settings (key, value)
values (
  'dl_verify',
  '{"mode":"countdown","seconds":3,"sitekey":"","skip_premium":true,"protect":false}'::jsonb
)
on conflict (key) do nothing;


-- جدول الروابط المحمية
create table if not exists public.game_links (
  item_id bigint primary key,
  links jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.game_links enable row level security;

-- ضمان أن links دائماً كائن JSON
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.game_links'::regclass
      and conname = 'game_links_links_object_check'
  ) then
    alter table public.game_links
    add constraint game_links_links_object_check
    check (jsonb_typeof(links) = 'object');
  end if;
end
$$;

drop policy if exists game_links_staff_sel on public.game_links;
create policy game_links_staff_sel
on public.game_links
for select to authenticated
using (public.is_admin() or public.is_staff());

drop policy if exists game_links_staff_ins on public.game_links;
create policy game_links_staff_ins
on public.game_links
for insert to authenticated
with check (public.is_admin() or public.is_staff());

drop policy if exists game_links_staff_upd on public.game_links;
create policy game_links_staff_upd
on public.game_links
for update to authenticated
using (public.is_admin() or public.is_staff())
with check (public.is_admin() or public.is_staff());

drop policy if exists game_links_admin_del on public.game_links;
create policy game_links_admin_del
on public.game_links
for delete to authenticated
using (public.is_admin());

revoke all on public.game_links from anon, authenticated;

grant select, insert, update, delete
on public.game_links to authenticated;

grant select, insert, update, delete
on public.game_links to service_role;


-- حفظ بيانات اللعبة وروابطها المحمية
create or replace function public.save_game(
  p_id bigint,
  p_data jsonb,
  p_links jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id bigint := p_id;
begin
  if not (public.is_admin() or public.is_staff()) then
    raise exception 'perm';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'bad data';
  end if;

  if p_links is not null
     and jsonb_typeof(p_links) <> 'object' then
    raise exception 'bad links';
  end if;

  if coalesce(v_id, 0) = 0 then
    insert into public.items (data)
    values (p_data)
    returning id into v_id;
  else
    update public.items
    set data = p_data
    where id = v_id;

    if not found then
      raise exception 'not found';
    end if;
  end if;

  if p_links is not null then
    if p_links = '{}'::jsonb then
      delete from public.game_links
      where item_id = v_id;
    else
      insert into public.game_links (
        item_id,
        links,
        updated_at
      )
      values (
        v_id,
        p_links,
        now()
      )
      on conflict (item_id)
      do update set
        links = excluded.links,
        updated_at = now();
    end if;
  end if;

  return v_id;
end
$$;

revoke all
on function public.save_game(bigint, jsonb, jsonb)
from public, anon;

grant execute
on function public.save_game(bigint, jsonb, jsonb)
to authenticated;
