-- release_coupon_use(order_id)
-- No-op stub in Release 1. Release 2 will add coupon-restoration logic here.
create or replace function public.release_coupon_use(p_order_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- intentional no-op; coupon system not yet implemented (Release 2)
  null;
end;
$$;

-- Only the service role may call this function.
revoke execute on function public.release_coupon_use(uuid) from public, anon, authenticated;
grant  execute on function public.release_coupon_use(uuid) to service_role;

-- Rewrite expire_pending_orders() to call release_coupon_use per cancelled row.
-- Replaces the CTE bulk-update from 20261117000001 with a row-level loop so
-- the coupon hook fires once per order (no-op today; real logic added in Release 2).
create or replace function public.expire_pending_orders()
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_id    uuid;
  v_count int := 0;
begin
  for v_id in
    select id
    from   orders
    where  status         = 'pending'
      and  payment_method = 'card'
      and  expires_at     is not null
      and  expires_at     < now()
    for update skip locked
  loop
    update orders
    set
      status        = 'cancelled',
      cancel_reason = 'expired',
      updated_at    = now()
    where id = v_id;

    perform public.release_coupon_use(v_id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- GRANT/REVOKE already set by the first migration; function signature unchanged.
-- Re-applying to be explicit.
revoke execute on function public.expire_pending_orders() from public, anon, authenticated;
grant  execute on function public.expire_pending_orders() to service_role;
