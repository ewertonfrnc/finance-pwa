begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select ok(
  to_regclass('public.starting_positions') is not null,
  'starting_positions should exist'
);

select ok(
  to_regclass('public.transactions') is not null,
  'transactions should exist'
);

select ok(
  to_regtype('public.transaction_kind') is not null,
  'transaction_kind should exist'
);

select is(
  (
    select enum_range(null::public.transaction_kind)::text
  ),
  '{income,expense}',
  'transaction_kind should contain only income and expense'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.starting_positions'::regclass
  ),
  'starting_positions should have RLS enabled'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.transactions'::regclass
  ),
  'transactions should have RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_proc
    where oid = 'public.initialize_starting_position(bigint,date)'::regprocedure
      and not prosecdef
  ),
  'initialize_starting_position should use security invoker'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'test-owner@finance-pwa.local', '{}'),
  ('10000000-0000-4000-8000-000000000002', 'test-other@finance-pwa.local', '{}'),
  ('10000000-0000-4000-8000-000000000003', 'test-target@finance-pwa.local', '{}');

insert into public.starting_positions (user_id, balance_cents, effective_on)
values ('10000000-0000-4000-8000-000000000002', -2500, '2026-08-20');

insert into public.transactions (
  user_id,
  kind,
  amount_cents,
  description,
  transaction_date
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'income',
    10000,
    'Owner income',
    '2026-08-22'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'expense',
    5000,
    'Other expense',
    '2026-08-23'
  );

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '10000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.initialize_starting_position(125000, date '2026-08-25')
  $$,
  'an authenticated user should initialize their starting position'
);

select is(
  (
    select balance_cents
    from public.starting_positions
    where user_id = auth.uid()
  ),
  125000::bigint,
  'the owner should read their starting balance'
);

select is(
  (
    select effective_on
    from public.starting_positions
    where user_id = auth.uid()
  ),
  date '2026-08-25',
  'the owner should read their effective date'
);

select lives_ok(
  $$
    select public.initialize_starting_position(125000, date '2026-08-25')
  $$,
  'retrying the same initialization should be idempotent'
);

select is(
  (
    select count(*)
    from public.starting_positions
    where user_id = auth.uid()
  ),
  1::bigint,
  'an idempotent retry should not duplicate the position'
);

select throws_ok(
  $$
    select public.initialize_starting_position(125001, date '2026-08-25')
  $$,
  '23505',
  'starting_position_already_exists',
  'changing an initialized position should fail'
);

select is(
  (
    select count(*)
    from public.starting_positions
  ),
  1::bigint,
  'the owner should not read another user position'
);

select is(
  (
    select count(*)
    from public.transactions
  ),
  1::bigint,
  'the owner should read only their transactions'
);

select throws_ok(
  $$
    insert into public.starting_positions (user_id, balance_cents, effective_on)
    values ('10000000-0000-4000-8000-000000000003', 1000, date '2026-08-25')
  $$,
  '42501',
  'new row violates row-level security policy for table "starting_positions"',
  'the owner should not create another user position'
);

select throws_ok(
  $$
    insert into public.transactions (kind, amount_cents, transaction_date)
    values ('expense', 1000, date '2026-08-25')
  $$,
  '42501',
  'permission denied for table transactions',
  'transaction writes should remain closed until the transaction feature'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role anon;

select throws_ok(
  $$ select * from public.starting_positions $$,
  '42501',
  'permission denied for table starting_positions',
  'anonymous users should not read starting positions'
);

select throws_ok(
  $$
    select public.initialize_starting_position(1000, date '2026-08-25')
  $$,
  '42501',
  'permission denied for function initialize_starting_position',
  'anonymous users should not initialize a starting position'
);

reset role;

select * from finish();
rollback;
