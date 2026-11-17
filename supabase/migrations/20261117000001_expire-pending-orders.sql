-- expire_pending_orders()
-- Cancels pending CARD orders whose expires_at is in the past.
-- Returns the number of rows updated.
-- Never touches pending_verification orders (expires_at is NULL for bank orders).
-- Called by the expire-pending-orders cron job every 15 minutes.
-- Idempotent: a second call with no expired rows returns 0.
-- Coupon release is a no-op in Release 1; the call is here so Release 2 can add it.

create or replace function public.expire_pending_orders()
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count int;
begin
  with expired as (
    update orders
    set
      status        = 'cancelled',
      cancel_reason = 'expired',
      updated_at    = now()
    where
      status         = 'pending'
      and payment_method = 'card'
      and expires_at is not null
      and expires_at < now()
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

-- Only the service role may call this function.
revoke execute on function public.expire_pending_orders() from public, anon, authenticated;
grant  execute on function public.expire_pending_orders() to service_role;
