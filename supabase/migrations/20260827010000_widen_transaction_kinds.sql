begin;

alter type public.transaction_kind add value 'daily';
alter type public.transaction_kind add value 'savings';

comment on table public.transactions is
  'User-owned one-time income, expense, daily, and savings transactions.';

commit;
