begin;

create table public.daily_spending_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  monthly_amount_cents bigint not null,
  days_per_month smallint not null,
  daily_amount_cents bigint not null
    generated always as (monthly_amount_cents / days_per_month::bigint) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_spending_settings_monthly_amount_cents_range
    check (monthly_amount_cents between 0 and 9007199254740991),
  constraint daily_spending_settings_days_per_month_range
    check (days_per_month between 28 and 31)
);

comment on table public.daily_spending_settings is
  'One mutable routine-spending target per authenticated user.';
comment on column public.daily_spending_settings.monthly_amount_cents is
  'Non-negative monthly routine-spending total in integer centavos.';
comment on column public.daily_spending_settings.days_per_month is
  'Divisor chosen by the user, from 28 through 31.';
comment on column public.daily_spending_settings.daily_amount_cents is
  'Server-derived integer division of monthly_amount_cents by days_per_month.';
comment on column public.daily_spending_settings.updated_at is
  'Concurrency version required by set_daily_spending for every change.';

alter table public.daily_spending_settings enable row level security;

revoke all on table public.daily_spending_settings from anon, authenticated;

grant select on table public.daily_spending_settings to authenticated;

grant select, insert, update, delete
  on table public.daily_spending_settings
  to service_role;

create policy daily_spending_settings_select_own
  on public.daily_spending_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_daily_spending(
  p_monthly_amount_cents bigint,
  p_days_per_month smallint,
  p_expected_updated_at timestamptz
)
returns public.daily_spending_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_setting public.daily_spending_settings;
  persisted_setting public.daily_spending_settings;
begin
  if current_user_id is null then
    raise sqlstate '42501' using message = 'authentication_required';
  end if;

  if p_monthly_amount_cents is null
    or p_monthly_amount_cents < 0
    or p_monthly_amount_cents > 9007199254740991 then
    raise sqlstate '22023' using message = 'monthly_amount_cents_out_of_range';
  end if;

  if p_days_per_month is null
    or p_days_per_month < 28
    or p_days_per_month > 31 then
    raise sqlstate '22023' using message = 'days_per_month_out_of_range';
  end if;

  select *
  into existing_setting
  from public.daily_spending_settings
  where user_id = current_user_id
  for update;

  if existing_setting.user_id is null then
    if p_expected_updated_at is not null then
      -- There is nothing to compare a version against; the caller believes it
      -- is editing a row that no longer exists.
      raise sqlstate 'PT409' using message = 'daily_spending_conflict';
    end if;

    -- A missing row cannot be locked, so a concurrent session may insert
    -- between the lock attempt above and this statement. Absorbing the unique
    -- violation keeps that race on the documented conflict contract instead of
    -- surfacing a raw 23505 to the browser.
    insert into public.daily_spending_settings (
      user_id,
      monthly_amount_cents,
      days_per_month
    )
    values (current_user_id, p_monthly_amount_cents, p_days_per_month)
    on conflict (user_id) do nothing
    returning * into persisted_setting;

    if persisted_setting.user_id is not null then
      return persisted_setting;
    end if;

    select *
    into existing_setting
    from public.daily_spending_settings
    where user_id = current_user_id;
  end if;

  if p_expected_updated_at is null then
    if existing_setting.monthly_amount_cents = p_monthly_amount_cents
      and existing_setting.days_per_month = p_days_per_month then
      return existing_setting;
    end if;

    -- A row already exists with different values than this create attempt;
    -- do not silently overwrite a row created by another tab or device.
    raise sqlstate 'PT409' using message = 'daily_spending_conflict';
  end if;

  if existing_setting.updated_at is distinct from p_expected_updated_at then
    raise sqlstate 'PT409' using message = 'daily_spending_conflict';
  end if;

  update public.daily_spending_settings
  set
    monthly_amount_cents = p_monthly_amount_cents,
    days_per_month = p_days_per_month,
    updated_at = greatest(
      pg_catalog.clock_timestamp(),
      existing_setting.updated_at + interval '1 microsecond'
    )
  where user_id = current_user_id
  returning * into persisted_setting;

  return persisted_setting;
end;
$$;

revoke execute
  on function public.set_daily_spending(bigint, smallint, timestamptz)
  from public, anon, authenticated;

grant execute
  on function public.set_daily_spending(bigint, smallint, timestamptz)
  to authenticated, service_role;

commit;
