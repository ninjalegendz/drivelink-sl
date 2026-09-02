-- 106 - Privacy-conscious first-party traffic and journey analytics.
-- Raw IP addresses, full user agents, URL query strings and typed form data
-- are intentionally not stored. Browser clients have no direct table access.

create table if not exists public.traffic_sessions (
  id uuid primary key,
  user_id uuid null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  landing_path text not null,
  source_category text not null default 'direct' check (source_category in (
    'direct', 'google', 'facebook', 'instagram', 'tiktok', 'youtube',
    'whatsapp', 'campaign', 'other_referral'
  )),
  source_host text null,
  campaign_source text null,
  campaign_medium text null,
  campaign_name text null,
  device_type text not null default 'desktop' check (device_type in ('mobile', 'tablet', 'desktop')),
  browser_family text not null default 'other' check (browser_family in ('chrome', 'safari', 'firefox', 'edge', 'samsung', 'other')),
  country_code text null,
  page_view_count integer not null default 0 check (page_view_count >= 0)
);

create index if not exists traffic_sessions_last_seen_idx on public.traffic_sessions (last_seen_at desc);
create index if not exists traffic_sessions_first_seen_idx on public.traffic_sessions (first_seen_at desc);
create index if not exists traffic_sessions_source_idx on public.traffic_sessions (source_category, first_seen_at desc);
create index if not exists traffic_sessions_user_idx on public.traffic_sessions (user_id) where user_id is not null;

create table if not exists public.traffic_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.traffic_sessions(id) on delete cascade,
  user_id uuid null,
  event_name text not null check (event_name in (
    'page_view', 'vehicle_view', 'booking_form_view', 'booking_request_started',
    'booking_request_submitted', 'guide_opened', 'search_submitted'
  )),
  path text not null,
  entity_type text null check (entity_type is null or entity_type in ('vehicle', 'rental_page', 'guide', 'search')),
  entity_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists traffic_events_created_idx on public.traffic_events (created_at desc);
create index if not exists traffic_events_session_idx on public.traffic_events (session_id, created_at);
create index if not exists traffic_events_name_idx on public.traffic_events (event_name, created_at desc);
create index if not exists traffic_events_entity_idx on public.traffic_events (entity_type, entity_id, created_at desc)
  where entity_type is not null;

alter table public.traffic_sessions enable row level security;
alter table public.traffic_events enable row level security;

revoke all on public.traffic_sessions from anon, authenticated;
revoke all on public.traffic_events from anon, authenticated;
revoke all on sequence public.traffic_events_id_seq from anon, authenticated;

create or replace function public.record_traffic_event(
  p_session_id uuid,
  p_user_id uuid,
  p_event_name text,
  p_path text,
  p_landing_path text,
  p_source_category text,
  p_source_host text,
  p_campaign_source text,
  p_campaign_medium text,
  p_campaign_name text,
  p_device_type text,
  p_browser_family text,
  p_country_code text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_name not in (
    'heartbeat', 'page_view', 'vehicle_view', 'booking_form_view',
    'booking_request_started', 'booking_request_submitted', 'guide_opened', 'search_submitted'
  ) then
    raise exception 'Unsupported analytics event';
  end if;

  insert into public.traffic_sessions (
    id, user_id, first_seen_at, last_seen_at, landing_path, source_category,
    source_host, campaign_source, campaign_medium, campaign_name,
    device_type, browser_family, country_code, page_view_count
  ) values (
    p_session_id, p_user_id, now(), now(), p_landing_path, p_source_category,
    p_source_host, p_campaign_source, p_campaign_medium, p_campaign_name,
    p_device_type, p_browser_family, p_country_code,
    case when p_event_name = 'page_view' then 1 else 0 end
  )
  on conflict (id) do update set
    user_id = excluded.user_id,
    last_seen_at = now(),
    page_view_count = public.traffic_sessions.page_view_count
      + case when p_event_name = 'page_view' then 1 else 0 end;

  if p_event_name <> 'heartbeat'
    and (select count(*) from public.traffic_events where session_id = p_session_id and created_at >= now() - interval '1 minute') < 30
    and (select count(*) from public.traffic_events where session_id = p_session_id and created_at >= now() - interval '1 hour') < 300
    and not exists (
    select 1 from public.traffic_events
    where session_id = p_session_id
      and event_name = p_event_name
      and path = p_path
      and entity_id is not distinct from p_entity_id
      and created_at >= now() - interval '2 seconds'
  ) then
    insert into public.traffic_events (
      session_id, user_id, event_name, path, entity_type, entity_id, metadata
    ) values (
      p_session_id, p_user_id, p_event_name, p_path, p_entity_type, p_entity_id,
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;
end;
$$;

revoke all on function public.record_traffic_event(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_traffic_event(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb) to service_role;

create or replace function public.traffic_analytics_snapshot(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'active_now', (
      select count(*) from public.traffic_sessions
      where last_seen_at >= now() - interval '5 minutes'
    ),
    'signed_in_now', (
      select count(*) from public.traffic_sessions
      where last_seen_at >= now() - interval '5 minutes' and user_id is not null
    ),
    'visitors', (
      select count(*) from public.traffic_sessions where last_seen_at >= p_since
    ),
    'page_views', (
      select count(*) from public.traffic_events where event_name = 'page_view' and created_at >= p_since
    ),
    'vehicle_views', (
      select count(*) from public.traffic_events where event_name = 'vehicle_view' and created_at >= p_since
    ),
    'booking_starts', (
      select count(*) from public.traffic_events where event_name = 'booking_request_started' and created_at >= p_since
    ),
    'booking_requests', (
      select count(*) from public.traffic_events where event_name = 'booking_request_submitted' and created_at >= p_since
    ),
    'guide_plays', (
      select count(*) from public.traffic_events where event_name = 'guide_opened' and created_at >= p_since
    ),
    'sources', coalesce((
      select jsonb_agg(to_jsonb(source_rows) order by source_rows.visitors desc)
      from (
        select source_category as source, count(*)::integer as visitors
        from public.traffic_sessions
        where first_seen_at >= p_since
        group by source_category
      ) source_rows
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(to_jsonb(device_rows) order by device_rows.visitors desc)
      from (
        select device_type as device, count(*)::integer as visitors
        from public.traffic_sessions
        where first_seen_at >= p_since
        group by device_type
      ) device_rows
    ), '[]'::jsonb),
    'top_paths', coalesce((
      select jsonb_agg(to_jsonb(path_rows) order by path_rows.views desc)
      from (
        select path, count(*)::integer as views,
          count(distinct session_id)::integer as visitors
        from public.traffic_events
        where event_name = 'page_view' and created_at >= p_since
        group by path
        order by count(*) desc
        limit 10
      ) path_rows
    ), '[]'::jsonb),
    'top_vehicles', coalesce((
      select jsonb_agg(to_jsonb(vehicle_rows) order by vehicle_rows.views desc)
      from (
        select entity_id as id, max(metadata ->> 'label') as label,
          count(*)::integer as views, count(distinct session_id)::integer as visitors
        from public.traffic_events
        where event_name = 'vehicle_view' and created_at >= p_since and entity_id is not null
        group by entity_id
        order by count(*) desc
        limit 10
      ) vehicle_rows
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(to_jsonb(daily_rows) order by daily_rows.day)
      from (
        select days.day::text,
          count(events.id) filter (where events.event_name = 'page_view')::integer as views,
          count(distinct events.session_id)::integer as visitors
        from generate_series(
          timezone('Asia/Colombo', p_since)::date,
          timezone('Asia/Colombo', now())::date,
          interval '1 day'
        ) as days(day)
        left join public.traffic_events events
          on timezone('Asia/Colombo', events.created_at)::date = days.day::date
          and events.created_at >= p_since
        group by days.day
      ) daily_rows
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(recent_rows) order by recent_rows.created_at desc)
      from (
        select events.id, left(events.session_id::text, 8) as visitor,
          (events.user_id is not null) as signed_in, events.event_name,
          events.path, events.entity_type, events.entity_id,
          events.metadata ->> 'label' as label,
          sessions.source_category as source, sessions.device_type as device,
          events.created_at
        from public.traffic_events events
        join public.traffic_sessions sessions on sessions.id = events.session_id
        where events.created_at >= greatest(p_since, now() - interval '24 hours')
        order by events.created_at desc
        limit 60
      ) recent_rows
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.traffic_analytics_snapshot(timestamptz) from public, anon, authenticated;
grant execute on function public.traffic_analytics_snapshot(timestamptz) to service_role;

create or replace function public.prune_traffic_analytics()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.traffic_sessions
  where last_seen_at < now() - interval '13 months';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_traffic_analytics() from public, anon, authenticated;
grant execute on function public.prune_traffic_analytics() to service_role;
