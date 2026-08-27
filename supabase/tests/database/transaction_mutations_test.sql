begin;

create extension if not exists pgtap with schema extensions;

select plan(52);

select ok(
  (
    select prosecdef
      and proconfig @> array['search_path=""']
    from pg_proc
    where oid = 'public.create_transaction(uuid,public.transaction_kind,bigint,text,date)'::regprocedure
  ),
  'create_transaction should use security definer with an empty search path'
);

select ok(
  (
    select prosecdef
      and proconfig @> array['search_path=""']
    from pg_proc
    where oid = 'public.update_transaction(uuid,timestamptz,public.transaction_kind,bigint,text,date)'::regprocedure
  ),
  'update_transaction should use security definer with an empty search path'
);

select ok(
  (
    select prosecdef
      and proconfig @> array['search_path=""']
    from pg_proc
    where oid = 'public.delete_transaction(uuid,timestamptz)'::regprocedure
  ),
  'delete_transaction should use security definer with an empty search path'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('20000000-0000-4000-8000-000000000001', 'mutation-owner@finance-pwa.local', '{}'),
  ('20000000-0000-4000-8000-000000000002', 'mutation-other@finance-pwa.local', '{}');

insert into public.transactions (
  id,
  user_id,
  kind,
  amount_cents,
  description,
  transaction_date,
  created_at,
  updated_at
)
values
  (
    '20000000-0000-4000-8000-000000000101',
    '20000000-0000-4000-8000-000000000001',
    'expense',
    1000,
    'Owner update',
    '2026-08-20',
    '2026-08-20 10:00:00+00',
    '2026-08-20 10:00:00+00'
  ),
  (
    '20000000-0000-4000-8000-000000000102',
    '20000000-0000-4000-8000-000000000001',
    'expense',
    2000,
    'Owner delete',
    '2026-08-21',
    '2026-08-21 10:00:00+00',
    '2026-08-21 10:00:00+00'
  ),
  (
    '20000000-0000-4000-8000-000000000103',
    '20000000-0000-4000-8000-000000000001',
    'expense',
    3000,
    'Owner stale delete',
    '2026-08-22',
    '2026-08-22 10:00:00+00',
    '2026-08-22 10:00:00+00'
  ),
  (
    '20000000-0000-4000-8000-000000000201',
    '20000000-0000-4000-8000-000000000002',
    'income',
    4000,
    'Other transaction',
    '2026-08-23',
    '2026-08-23 10:00:00+00',
    '2026-08-23 10:00:00+00'
  );

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '20000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select is(
  (
    public.create_transaction(
      '20000000-0000-4000-8000-000000000111',
      'expense',
      5000,
      '  Coffee  ',
      date '2026-08-25'
    )
  ).user_id,
  '20000000-0000-4000-8000-000000000001'::uuid,
  'create should derive the owner from auth.uid()'
);

select results_eq(
  $$
    select kind::text, amount_cents, description, transaction_date
    from public.transactions
    where id = '20000000-0000-4000-8000-000000000111'
  $$,
  $$ values ('expense'::text, 5000::bigint, 'Coffee'::text, date '2026-08-25') $$,
  'create should persist normalized transaction content'
);

select is(
  (
    public.create_transaction(
      '20000000-0000-4000-8000-000000000111',
      'expense',
      5000,
      'Coffee',
      date '2026-08-25'
    )
  ).id,
  '20000000-0000-4000-8000-000000000111'::uuid,
  'an identical create retry should return the existing transaction'
);

select is(
  (
    select count(*)
    from public.transactions
    where id = '20000000-0000-4000-8000-000000000111'
  ),
  1::bigint,
  'an identical create retry should leave one transaction'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000111',
      'expense',
      5001,
      'Coffee',
      date '2026-08-25'
    )
  $$,
  '23505',
  'transaction_id_conflict',
  'reusing a transaction ID for different content should fail'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000201',
      'income',
      4000,
      'Other transaction',
      date '2026-08-23'
    )
  $$,
  '23505',
  'transaction_id_conflict',
  'create should not return another user transaction for an identical ID and payload'
);

select throws_ok(
  $$
    select public.create_transaction(
      null,
      'expense',
      1000,
      null,
      date '2026-08-25'
    )
  $$,
  '22023',
  'transaction_id_required',
  'create should require a transaction ID'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000112',
      null,
      1000,
      null,
      date '2026-08-25'
    )
  $$,
  '22023',
  'transaction_kind_required',
  'create should require a transaction kind'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000112',
      'expense',
      null,
      null,
      date '2026-08-25'
    )
  $$,
  '22023',
  'amount_cents_out_of_range',
  'create should reject a null amount'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000112',
      'expense',
      0,
      null,
      date '2026-08-25'
    )
  $$,
  '22023',
  'amount_cents_out_of_range',
  'create should reject a zero amount'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000112',
      'expense',
      -1,
      null,
      date '2026-08-25'
    )
  $$,
  '22023',
  'amount_cents_out_of_range',
  'create should reject a negative amount'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000112',
      'expense',
      9007199254740992,
      null,
      date '2026-08-25'
    )
  $$,
  '22023',
  'amount_cents_out_of_range',
  'create should reject an amount above the safe integer limit'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000112',
      'expense',
      1000,
      null,
      null
    )
  $$,
  '22023',
  'transaction_date_out_of_range',
  'create should require a transaction date'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000112',
      'expense',
      1000,
      null,
      date '0001-01-01 BC'
    )
  $$,
  '22023',
  'transaction_date_out_of_range',
  'create should reject a date below the supported range'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000112',
      'expense',
      1000,
      null,
      date '10000-01-01'
    )
  $$,
  '22023',
  'transaction_date_out_of_range',
  'create should reject a date above the supported range'
);

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000112',
      'expense',
      1000,
      repeat('x', 121),
      date '2026-08-25'
    )
  $$,
  '22023',
  'description_too_long',
  'create should reject a normalized description above 120 characters'
);

select is(
  (
    public.create_transaction(
      '20000000-0000-4000-8000-000000000112',
      'expense',
      1000,
      '   ',
      date '2026-08-25'
    )
  ).description,
  null,
  'create should normalize a whitespace-only description to null'
);

select throws_ok(
  $$
    insert into public.transactions (kind, amount_cents, transaction_date)
    values ('expense', 1000, date '2026-08-25')
  $$,
  '42501',
  'permission denied for table transactions',
  'authenticated users should not insert transactions directly'
);

select throws_ok(
  $$
    update public.transactions
    set amount_cents = 9999
    where id = '20000000-0000-4000-8000-000000000101'
  $$,
  '42501',
  'permission denied for table transactions',
  'authenticated users should not update transactions directly'
);

select throws_ok(
  $$
    delete from public.transactions
    where id = '20000000-0000-4000-8000-000000000102'
  $$,
  '42501',
  'permission denied for table transactions',
  'authenticated users should not delete transactions directly'
);

select is(
  (
    public.update_transaction(
      '20000000-0000-4000-8000-000000000101',
      timestamptz '2026-08-20 10:00:00+00',
      'income',
      2500,
      '  Updated transaction  ',
      date '2026-08-26'
    )
  ).amount_cents,
  2500::bigint,
  'update should return the authoritative updated row'
);

select results_eq(
  $$
    select kind::text, amount_cents, description, transaction_date
    from public.transactions
    where id = '20000000-0000-4000-8000-000000000101'
  $$,
  $$ values ('income'::text, 2500::bigint, 'Updated transaction'::text, date '2026-08-26') $$,
  'update should persist normalized transaction content'
);

select cmp_ok(
  (
    select updated_at
    from public.transactions
    where id = '20000000-0000-4000-8000-000000000101'
  ),
  '>',
  timestamptz '2026-08-20 10:00:00+00',
  'update should advance the concurrency version'
);

select throws_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000101',
      timestamptz '2026-08-20 10:00:00+00',
      'expense',
      3000,
      'Stale overwrite',
      date '2026-08-27'
    )
  $$,
  '40001',
  'transaction_conflict',
  'update should reject a stale concurrency version'
);

select is(
  (
    select amount_cents
    from public.transactions
    where id = '20000000-0000-4000-8000-000000000101'
  ),
  2500::bigint,
  'a stale update should preserve the newer row'
);

select throws_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000999',
      timestamptz '2026-08-20 10:00:00+00',
      'expense',
      1000,
      null,
      date '2026-08-25'
    )
  $$,
  'P0002',
  'transaction_not_found',
  'update should hide a missing transaction behind not found'
);

select throws_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000201',
      timestamptz '2026-08-23 10:00:00+00',
      'income',
      4000,
      'Other transaction',
      date '2026-08-23'
    )
  $$,
  'P0002',
  'transaction_not_found',
  'update should hide another user transaction behind not found'
);

select throws_ok(
  $$
    select public.update_transaction(
      null,
      timestamptz '2026-08-20 10:00:00+00',
      'expense',
      1000,
      null,
      date '2026-08-25'
    )
  $$,
  '22023',
  'transaction_id_required',
  'update should require a transaction ID'
);

select throws_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000101',
      null,
      'expense',
      1000,
      null,
      date '2026-08-25'
    )
  $$,
  '22023',
  'transaction_version_required',
  'update should require a concurrency version'
);

select throws_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000101',
      timestamptz '2026-08-20 10:00:00+00',
      null,
      1000,
      null,
      date '2026-08-25'
    )
  $$,
  '22023',
  'transaction_kind_required',
  'update should require a transaction kind'
);

select throws_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000101',
      timestamptz '2026-08-20 10:00:00+00',
      'expense',
      null,
      null,
      date '2026-08-25'
    )
  $$,
  '22023',
  'amount_cents_out_of_range',
  'update should require an amount'
);

select throws_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000101',
      timestamptz '2026-08-20 10:00:00+00',
      'expense',
      1000,
      null,
      null
    )
  $$,
  '22023',
  'transaction_date_out_of_range',
  'update should require a transaction date'
);

select throws_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000101',
      timestamptz '2026-08-20 10:00:00+00',
      'expense',
      1000,
      repeat('x', 121),
      date '2026-08-25'
    )
  $$,
  '22023',
  'description_too_long',
  'update should reject a normalized description above 120 characters'
);

select is(
  (
    public.delete_transaction(
      '20000000-0000-4000-8000-000000000102',
      timestamptz '2026-08-21 10:00:00+00'
    )
  ).id,
  '20000000-0000-4000-8000-000000000102'::uuid,
  'delete should return the authoritative deleted row'
);

select is(
  (
    select count(*)
    from public.transactions
    where id = '20000000-0000-4000-8000-000000000102'
  ),
  0::bigint,
  'delete should remove the owned transaction'
);

select lives_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000103',
      timestamptz '2026-08-22 10:00:00+00',
      'expense',
      3500,
      'Newer transaction',
      date '2026-08-22'
    )
  $$,
  'a transaction should change before the stale delete attempt'
);

select throws_ok(
  $$
    select public.delete_transaction(
      '20000000-0000-4000-8000-000000000103',
      timestamptz '2026-08-22 10:00:00+00'
    )
  $$,
  '40001',
  'transaction_conflict',
  'delete should reject a stale concurrency version'
);

select is(
  (
    select amount_cents
    from public.transactions
    where id = '20000000-0000-4000-8000-000000000103'
  ),
  3500::bigint,
  'a stale delete should preserve the newer row'
);

select throws_ok(
  $$
    select public.delete_transaction(
      '20000000-0000-4000-8000-000000000999',
      timestamptz '2026-08-22 10:00:00+00'
    )
  $$,
  'P0002',
  'transaction_not_found',
  'delete should hide a missing transaction behind not found'
);

select throws_ok(
  $$
    select public.delete_transaction(
      '20000000-0000-4000-8000-000000000201',
      timestamptz '2026-08-23 10:00:00+00'
    )
  $$,
  'P0002',
  'transaction_not_found',
  'delete should hide another user transaction behind not found'
);

select throws_ok(
  $$
    select public.delete_transaction(
      null,
      timestamptz '2026-08-22 10:00:00+00'
    )
  $$,
  '22023',
  'transaction_id_required',
  'delete should require a transaction ID'
);

select throws_ok(
  $$
    select public.delete_transaction(
      '20000000-0000-4000-8000-000000000103',
      null
    )
  $$,
  '22023',
  'transaction_version_required',
  'delete should require a concurrency version'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000121',
      'expense',
      1000,
      null,
      date '2026-08-25'
    )
  $$,
  '42501',
  'authentication_required',
  'create should require an authenticated identity'
);

select throws_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000101',
      timestamptz '2026-08-20 10:00:00+00',
      'expense',
      1000,
      null,
      date '2026-08-25'
    )
  $$,
  '42501',
  'authentication_required',
  'update should require an authenticated identity'
);

select throws_ok(
  $$
    select public.delete_transaction(
      '20000000-0000-4000-8000-000000000103',
      timestamptz '2026-08-22 10:00:00+00'
    )
  $$,
  '42501',
  'authentication_required',
  'delete should require an authenticated identity'
);

reset role;
set local role anon;

select throws_ok(
  $$
    select public.create_transaction(
      '20000000-0000-4000-8000-000000000121',
      'expense',
      1000,
      null,
      date '2026-08-25'
    )
  $$,
  '42501',
  'permission denied for function create_transaction',
  'anonymous users should not execute create_transaction'
);

select throws_ok(
  $$
    select public.update_transaction(
      '20000000-0000-4000-8000-000000000101',
      timestamptz '2026-08-20 10:00:00+00',
      'expense',
      1000,
      null,
      date '2026-08-25'
    )
  $$,
  '42501',
  'permission denied for function update_transaction',
  'anonymous users should not execute update_transaction'
);

select throws_ok(
  $$
    select public.delete_transaction(
      '20000000-0000-4000-8000-000000000103',
      timestamptz '2026-08-22 10:00:00+00'
    )
  $$,
  '42501',
  'permission denied for function delete_transaction',
  'anonymous users should not execute delete_transaction'
);

select throws_ok(
  $$ select * from public.transactions $$,
  '42501',
  'permission denied for table transactions',
  'anonymous users should not read transactions'
);

reset role;

select * from finish();
rollback;
