-- keep the admin check out of the exposed API schema; policies reference it by OID so they keep working
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.is_admin() set schema private;
grant execute on function private.is_admin() to authenticated;

create or replace function public.admin_daily_sales(p_days int default 30)
returns table (day date, revenue numeric, orders int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select d::date, coalesce(sum(o.total_amount), 0), count(o.id)::int
    from generate_series(current_date - (least(greatest(p_days, 1), 365) - 1), current_date, interval '1 day') d
    left join public.orders o
      on o.created_at::date = d::date
     and o.status in ('paid','processing','printing','shipped','delivered')
    group by d order by d;
end $$;

-- Supabase's own event-trigger helper is not meant to be called over the API
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
