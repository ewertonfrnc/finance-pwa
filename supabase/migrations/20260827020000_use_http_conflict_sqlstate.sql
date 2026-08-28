begin;

create or replace function public.update_transaction(
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_kind public.transaction_kind,
  p_amount_cents bigint,
  p_description text,
  p_transaction_date date
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_description text := nullif(pg_catalog.btrim(p_description), '');
  current_transaction public.transactions;
  persisted_transaction public.transactions;
begin
  if current_user_id is null then
    raise sqlstate '42501' using message = 'authentication_required';
  end if;

  if p_id is null then
    raise sqlstate '22023' using message = 'transaction_id_required';
  end if;

  if p_expected_updated_at is null then
    raise sqlstate '22023' using message = 'transaction_version_required';
  end if;

  if p_kind is null then
    raise sqlstate '22023' using message = 'transaction_kind_required';
  end if;

  if p_amount_cents is null
    or p_amount_cents < 1
    or p_amount_cents > 9007199254740991 then
    raise sqlstate '22023' using message = 'amount_cents_out_of_range';
  end if;

  if p_transaction_date is null
    or p_transaction_date < date '0001-01-01'
    or p_transaction_date > date '9999-12-31' then
    raise sqlstate '22023' using message = 'transaction_date_out_of_range';
  end if;

  if normalized_description is not null
    and pg_catalog.char_length(normalized_description) > 120 then
    raise sqlstate '22023' using message = 'description_too_long';
  end if;

  select *
  into current_transaction
  from public.transactions
  where id = p_id
    and user_id = current_user_id
  for update;

  if current_transaction.id is null then
    raise sqlstate 'P0002' using message = 'transaction_not_found';
  end if;

  if current_transaction.updated_at is distinct from p_expected_updated_at then
    -- PostgREST 14.17 retries SQLSTATE 40001 (serialization_failure) instead
    -- of returning it, so a stale-version conflict never reaches the browser.
    -- PT409 is PostgREST's documented way for a function to choose its own
    -- HTTP status; it returns 409 once and is not retried.
    raise sqlstate 'PT409' using message = 'transaction_conflict';
  end if;

  update public.transactions
  set
    kind = p_kind,
    amount_cents = p_amount_cents,
    description = normalized_description,
    transaction_date = p_transaction_date,
    updated_at = greatest(
      pg_catalog.clock_timestamp(),
      current_transaction.updated_at + interval '1 microsecond'
    )
  where id = current_transaction.id
  returning * into persisted_transaction;

  return persisted_transaction;
end;
$$;

create or replace function public.delete_transaction(
  p_id uuid,
  p_expected_updated_at timestamptz
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_transaction public.transactions;
  deleted_transaction public.transactions;
begin
  if current_user_id is null then
    raise sqlstate '42501' using message = 'authentication_required';
  end if;

  if p_id is null then
    raise sqlstate '22023' using message = 'transaction_id_required';
  end if;

  if p_expected_updated_at is null then
    raise sqlstate '22023' using message = 'transaction_version_required';
  end if;

  select *
  into current_transaction
  from public.transactions
  where id = p_id
    and user_id = current_user_id
  for update;

  if current_transaction.id is null then
    raise sqlstate 'P0002' using message = 'transaction_not_found';
  end if;

  if current_transaction.updated_at is distinct from p_expected_updated_at then
    -- See the matching comment in update_transaction above.
    raise sqlstate 'PT409' using message = 'transaction_conflict';
  end if;

  delete from public.transactions
  where id = current_transaction.id
  returning * into deleted_transaction;

  return deleted_transaction;
end;
$$;

revoke execute
  on function public.update_transaction(
    uuid,
    timestamptz,
    public.transaction_kind,
    bigint,
    text,
    date
  )
  from public, anon, authenticated;

revoke execute
  on function public.delete_transaction(uuid, timestamptz)
  from public, anon, authenticated;

grant execute
  on function public.update_transaction(
    uuid,
    timestamptz,
    public.transaction_kind,
    bigint,
    text,
    date
  )
  to authenticated, service_role;

grant execute
  on function public.delete_transaction(uuid, timestamptz)
  to authenticated, service_role;

commit;
