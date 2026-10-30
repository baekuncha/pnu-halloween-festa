-- ============================================================
-- PNU Halloween Festa - Growth Hacking Analytics Schema
-- Run this in Supabase SQL Editor (or via Supabase MCP)
-- ============================================================

-- 1) Analytics Events table (funnel steps, button clicks, page views)
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  event_type text not null default 'custom',
  event_name text not null,
  funnel_step int,
  button_id text,
  button_text text,
  page_url text,
  referrer text,
  utm_source text default 'direct',
  utm_medium text,
  utm_campaign text,
  ab_variant text default 'A',
  device_type text default 'desktop',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_session on public.analytics_events (session_id);
create index if not exists idx_events_type on public.analytics_events (event_type);
create index if not exists idx_events_funnel on public.analytics_events (funnel_step);
create index if not exists idx_events_created on public.analytics_events (created_at desc);

-- 2) Orders table (ticket / merch purchases)
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  session_id text not null,
  order_code text not null unique,
  student_id text not null,
  student_name text not null,
  department text,
  phone text,
  package_type text not null,
  package_name text,
  quantity int default 1,
  unit_price int default 0,
  total_price int default 0,
  payment_method text,
  status text default 'completed',
  ab_variant text,
  utm_source text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_created on public.orders (created_at desc);

-- 3) Costume contest votes table
create table if not exists public.costume_votes (
  id bigint generated always as identity primary key,
  session_id text not null,
  candidate_id text not null,
  candidate_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_votes_candidate on public.costume_votes (candidate_id);

-- 4) Growth metrics RPC (single-call aggregation for the dashboard)
create or replace function public.get_growth_metrics()
returns json
language plpgsql
security invoker
as $$
declare
  v_total_sessions int;
  v_funnel json;
  v_buttons json;
  v_utm json;
  v_ab json;
  v_orders json;
begin
  select count(distinct session_id) into v_total_sessions
  from public.analytics_events;

  select json_agg(t order by t.step) into v_funnel
  from (
    select
      step as step,
      case step
        when 1 then '1. 메인 랜딩 (Landing)'
        when 2 then '2. 굿즈/티켓 둘러보기 (Explore)'
        when 3 then '3. 주문서 작성 시작 (Checkout Start)'
        when 4 then '4. 학생 인증 완료 (Verified)'
        when 5 then '5. 구매/예약 완료 (Purchased)'
      end as name,
      count(distinct session_id)::int as session_count
    from public.analytics_events
    where funnel_step between 1 and 5
    group by step
  ) t;

  select json_agg(t order by t.click_count desc) into v_buttons
  from (
    select
      button_id,
      max(button_text) as button_text,
      count(*)::int as click_count
    from public.analytics_events
    where event_type = 'button_click' and button_id is not null
    group by button_id
  ) t;

  select json_agg(t order by t.visitors desc) into v_utm
  from (
    select
      coalesce(utm_source, 'direct') as source,
      count(distinct session_id)::int as visitors,
      count(distinct case when funnel_step = 5 then session_id end)::int as buyers
    from public.analytics_events
    group by coalesce(utm_source, 'direct')
  ) t;

  select json_agg(t order by t.variant) into v_ab
  from (
    select
      coalesce(ab_variant, 'A') as variant,
      count(distinct session_id)::int as visitors,
      count(distinct case when funnel_step = 5 then session_id end)::int as buyers
    from public.analytics_events
    group by coalesce(ab_variant, 'A')
  ) t;

  select json_build_object(
    'total_orders', count(*),
    'total_revenue', coalesce(sum(total_price), 0)::int,
    'avg_order_value', coalesce(round(avg(total_price)), 0)::int
  ) into v_orders
  from public.orders
  where status = 'completed';

  return json_build_object(
    'total_sessions', v_total_sessions,
    'funnel', coalesce(v_funnel, '[]'::json),
    'button_clicks', coalesce(v_buttons, '[]'::json),
    'utm_sources', coalesce(v_utm, '[]'::json),
    'ab_test', coalesce(v_ab, '[]'::json),
    'orders', coalesce(v_orders, '{}'::json)
  );
end;
$$;

-- 5) Row Level Security (public read/insert for demo; tighten for production)
alter table public.analytics_events enable row level security;
alter table public.orders enable row level security;
alter table public.costume_votes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'analytics_events' and policyname = 'allow_anon_insert'
  ) then
    create policy "allow_anon_insert" on public.analytics_events
      for insert to anon with check (true);
    create policy "allow_anon_select" on public.analytics_events
      for select to anon using (true);
    create policy "allow_anon_insert_orders" on public.orders
      for insert to anon with check (true);
    create policy "allow_anon_select_orders" on public.orders
      for select to anon using (true);
    create policy "allow_anon_insert_votes" on public.costume_votes
      for insert to anon with check (true);
    create policy "allow_anon_select_votes" on public.costume_votes
      for select to anon using (true);
  end if;
end $$;

grant execute on function public.get_growth_metrics() to anon;
