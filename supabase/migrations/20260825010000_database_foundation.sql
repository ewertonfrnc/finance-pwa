begin;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

create type public.transaction_kind as enum ('income', 'expense');

create table public.starting_positions (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  balance_cents bigint not null,
  effective_on date not null,
  created_at timestamptz not null default now(),
  constraint starting_positions_balance_cents_range
    check (balance_cents between -9007199254740991 and 9007199254740991),
  constraint starting_positions_effective_on_range
    check (effective_on between date '0001-01-01' and date '9999-12-31')
);

comment on table public.starting_positions is
  'One opening financial position per authenticated user.';
comment on column public.starting_positions.balance_cents is
  'Signed opening balance in integer centavos.';
comment on column public.starting_positions.effective_on is
  'Calendar date whose opening balance is represented by balance_cents.';

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.transaction_kind not null,
  amount_cents bigint not null,
  description text,
  transaction_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_amount_cents_range
    check (amount_cents between 1 and 9007199254740991),
  constraint transactions_description_length
    check (description is null or char_length(description) between 1 and 120),
  constraint transactions_description_trimmed
    check (description is null or description = btrim(description)),
  constraint transactions_transaction_date_range
    check (transaction_date between date '0001-01-01' and date '9999-12-31')
);

comment on table public.transactions is
  'User-owned one-time income and expense transactions.';
comment on column public.transactions.amount_cents is
  'Positive transaction magnitude in integer centavos; kind determines direction.';
comment on column public.transactions.transaction_date is
  'Calendar date without timezone conversion.';

create index transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc, created_at desc);

alter table public.starting_positions enable row level security;
alter table public.transactions enable row level security;

revoke all on table public.starting_positions from anon, authenticated;
revoke all on table public.transactions from anon, authenticated;

grant select, insert on table public.starting_positions to authenticated;
grant select on table public.transactions to authenticated;

grant select, insert, update, delete
  on table public.starting_positions, public.transactions
  to service_role;

create policy starting_positions_select_own
  on public.starting_positions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy starting_positions_insert_own
  on public.starting_positions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy transactions_select_own
  on public.transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.initialize_starting_position(
  p_balance_cents bigint,
  p_effective_on date
)
returns public.starting_positions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  position public.starting_positions;
begin
  if current_user_id is null then
    raise sqlstate '42501' using message = 'authentication_required';
  end if;

  if p_balance_cents is null
    or p_balance_cents < -9007199254740991
    or p_balance_cents > 9007199254740991 then
    raise sqlstate '22023' using message = 'balance_cents_out_of_range';
  end if;

  if p_effective_on is null
    or p_effective_on < date '0001-01-01'
    or p_effective_on > date '9999-12-31' then
    raise sqlstate '22023' using message = 'effective_on_out_of_range';
  end if;

  insert into public.starting_positions (user_id, balance_cents, effective_on)
  values (current_user_id, p_balance_cents, p_effective_on)
  on conflict (user_id) do nothing
  returning * into position;

  if position.user_id is not null then
    return position;
  end if;

  select *
  into position
  from public.starting_positions
  where user_id = current_user_id;

  if position.balance_cents = p_balance_cents
    and position.effective_on = p_effective_on then
    return position;
  end if;

  raise sqlstate '23505' using message = 'starting_position_already_exists';
end;
$$;

revoke execute
  on function public.initialize_starting_position(bigint, date)
  from public, anon;

grant execute
  on function public.initialize_starting_position(bigint, date)
  to authenticated, service_role;

commit;
