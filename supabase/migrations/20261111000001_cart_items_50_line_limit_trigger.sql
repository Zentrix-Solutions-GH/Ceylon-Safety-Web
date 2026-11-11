-- Enforce 50-line cart limit at the database level.
-- Application code performs the same check, but a concurrent insert can bypass
-- it. This trigger is the safety net that guarantees the constraint holds.

create or replace function enforce_cart_line_limit()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
begin
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

create trigger cart_items_50_line_limit
  before insert on cart_items
  for each row
  execute function enforce_cart_line_limit();
