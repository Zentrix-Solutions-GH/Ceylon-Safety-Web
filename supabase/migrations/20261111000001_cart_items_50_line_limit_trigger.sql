-- Enforce 50-line cart limit at the database level.
-- Application code performs the same check, but a concurrent insert can bypass
-- it. This trigger is the safety net that guarantees the constraint holds.
--
-- Row-level locking: pg_advisory_xact_lock serialises concurrent inserts
-- for the same user, preventing two transactions from both counting 49 rows
-- before either commits and both inserting (the classic TOCTOU race).

create or replace function enforce_cart_line_limit()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
begin
  -- Acquire a per-user advisory lock for the duration of this transaction.
  -- Two concurrent inserts for the same user will queue here rather than
  -- both reading count=49 and both passing the guard.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));

  select count(*) into current_count
  from cart_items
  where user_id = new.user_id;

  if current_count >= 50 then
    raise exception 'cart_full: maximum 50 items allowed per cart'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Idempotent: drop before recreating so the migration is safe on re-run.
drop trigger if exists cart_items_50_line_limit on cart_items;

create trigger cart_items_50_line_limit
  before insert on cart_items
  for each row
  execute function enforce_cart_line_limit();
