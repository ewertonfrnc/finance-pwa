begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

select ok(
  to_regclass('public.daily_spending_settings') is not null,
  'daily_spending_settings should exist'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.daily_spending_settings'::regclass
  ),
  'daily_spending_settings should have RLS enabled'
);

select ok(
  (
    select prosecdef
      and proconfig @> array['search_path=""']
    from pg_proc
    where oid = 'public.set_daily_spending(bigint,smallint,timestamptz)'::regprocedure
  ),
  'set_daily_spending should use security definer with an empty search path'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('40000000-0000-4000-8000-000000000001', 'daily-owner@finance-pwa.local', '{}'),
  ('40000000-0000-4000-8000-000000000002', 'daily-other@finance-pwa.local', '{}'),
  ('40000000-0000-4000-8000-000000000003', 'daily-zero@finance-pwa.local', '{}');

insert into public.daily_spending_settings (
  user_id,
  monthly_amount_cents,
  days_per_month
)
values ('40000000-0000-4000-8000-000000000002', 60000, 30);

create temporary table daily_spending_test_state (
  label text primary key,
  value timestamptz not null
);

grant select, insert on table daily_spending_test_state to authenticated;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '40000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select is(
  (
    public.set_daily_spending(100000, 30::smallint, null)
  ).daily_amount_cents,
  3333::bigint,
  'a category-mode create should floor-divide the monthly total by the divisor'
);

select results_eq(
  $$
    select monthly_amount_cents, days_per_month, daily_amount_cents
    from public.daily_spending_settings
    where user_id = auth.uid()
  $$,
  $$ values (100000::bigint, 30::smallint, 3333::bigint) $$,
  'create should persist the normalized monthly amount and divisor'
);

select lives_ok(
  $$ select public.set_daily_spending(100000, 30::smallint, null) $$,
  'an identical create retry with a null version should be idempotent'
);

select is(
  (
    select count(*)
    from public.daily_spending_settings
    where user_id = auth.uid()
  ),
  1::bigint,
  'an idempotent retry should not duplicate the setting'
);

select throws_ok(
  $$ select public.set_daily_spending(200000, 30::smallint, null) $$,
  'PT409',
  'daily_spending_conflict',
  'a conflicting create with a null version should not overwrite an existing row'
);

select is(
  (
    select monthly_amount_cents
    from public.daily_spending_settings
    where user_id = auth.uid()
  ),
  100000::bigint,
  'a conflicting create attempt should leave the saved amount unchanged'
);

select results_eq(
  $$
    select user_id
    from public.daily_spending_settings
  $$,
  $$ values ('40000000-0000-4000-8000-000000000001'::uuid) $$,
  'the owner should read only their own setting row'
);

insert into daily_spending_test_state (label, value)
select 'before_edit', updated_at
from public.daily_spending_settings
where user_id = auth.uid();

select is(
  (
    public.set_daily_spending(
      90000,
      30::smallint,
      (select value from daily_spending_test_state where label = 'before_edit')
    )
  ).daily_amount_cents,
  3000::bigint,
  'a direct-mode edit should exactly divide the normalized monthly amount by the divisor'
);

select is(
  (
    select monthly_amount_cents
    from public.daily_spending_settings
    where user_id = auth.uid()
  ),
  90000::bigint,
  'a valid edit should persist the new monthly amount'
);

select cmp_ok(
  (
    select updated_at
    from public.daily_spending_settings
    where user_id = auth.uid()
  ),
  '>',
  (select value from daily_spending_test_state where label = 'before_edit'),
  'a valid edit should return a strictly newer version'
);

select throws_ok(
  $$
    select public.set_daily_spending(
      70000,
      30::smallint,
      (select value from daily_spending_test_state where label = 'before_edit')
    )
  $$,
  'PT409',
  'daily_spending_conflict',
  'a stale edit should be rejected'
);

select is(
  (
    select monthly_amount_cents
    from public.daily_spending_settings
    where user_id = auth.uid()
  ),
  90000::bigint,
  'a stale edit attempt should leave the saved amount unchanged'
);

select throws_ok(
  $$ select public.set_daily_spending(null, 30::smallint, null) $$,
  '22023',
  'monthly_amount_cents_out_of_range',
  'set_daily_spending should require a monthly amount'
);

select throws_ok(
  $$ select public.set_daily_spending(-1, 30::smallint, null) $$,
  '22023',
  'monthly_amount_cents_out_of_range',
  'set_daily_spending should reject a negative monthly amount'
);

select throws_ok(
  $$ select public.set_daily_spending(9007199254740992, 30::smallint, null) $$,
  '22023',
  'monthly_amount_cents_out_of_range',
  'set_daily_spending should reject a monthly amount above the safe integer limit'
);

select throws_ok(
  $$ select public.set_daily_spending(90000, null, null) $$,
  '22023',
  'days_per_month_out_of_range',
  'set_daily_spending should require a divisor'
);

select throws_ok(
  $$ select public.set_daily_spending(90000, 27::smallint, null) $$,
  '22023',
  'days_per_month_out_of_range',
  'set_daily_spending should reject a divisor below 28'
);

select throws_ok(
  $$ select public.set_daily_spending(90000, 32::smallint, null) $$,
  '22023',
  'days_per_month_out_of_range',
  'set_daily_spending should reject a divisor above 31'
);

select throws_ok(
  $$
    insert into public.daily_spending_settings (
      user_id,
      monthly_amount_cents,
      days_per_month
    )
    values (auth.uid(), 1000, 30)
  $$,
  '42501',
  'permission denied for table daily_spending_settings',
  'authenticated users should not insert settings directly'
);

select throws_ok(
  $$
    update public.daily_spending_settings
    set monthly_amount_cents = 1000
    where user_id = auth.uid()
  $$,
  '42501',
  'permission denied for table daily_spending_settings',
  'authenticated users should not update settings directly'
);

select throws_ok(
  $$
    delete from public.daily_spending_settings
    where user_id = auth.uid()
  $$,
  '42501',
  'permission denied for table daily_spending_settings',
  'authenticated users should not delete settings directly'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '40000000-0000-4000-8000-000000000003',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select is(
  (
    public.set_daily_spending(0, 31::smallint, null)
  ).daily_amount_cents,
  0::bigint,
  'a zero create should be valid and derive a zero daily amount'
);

select results_eq(
  $$
    select monthly_amount_cents, days_per_month, daily_amount_cents
    from public.daily_spending_settings
    where user_id = auth.uid()
  $$,
  $$ values (0::bigint, 31::smallint, 0::bigint) $$,
  'an explicit zero setting should persist as a row rather than as no row'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;

select throws_ok(
  $$ select public.set_daily_spending(90000, 30::smallint, null) $$,
  '42501',
  'authentication_required',
  'set_daily_spending should require an authenticated identity'
);

reset role;
set local role anon;

select throws_ok(
  $$ select * from public.daily_spending_settings $$,
  '42501',
  'permission denied for table daily_spending_settings',
  'anonymous users should not read settings'
);

select throws_ok(
  $$ select public.set_daily_spending(90000, 30::smallint, null) $$,
  '42501',
  'permission denied for function set_daily_spending',
  'anonymous users should not execute set_daily_spending'
);

reset role;

select * from finish();
rollback;
