create extension if not exists pgcrypto;

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  stock_number text not null unique,
  make text not null check (length(make) between 1 and 80),
  model text not null check (length(model) between 1 and 120),
  body_type text not null check (body_type in ('SUV', 'Sedan', 'Coupe', 'Hatchback', 'Pickup', 'Van')),
  model_year integer not null check (model_year between 1980 and 2100),
  mileage_km integer not null check (mileage_km >= 0),
  asking_price_aed numeric(12,2) not null check (asking_price_aed > 0),
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiry_runs (
  request_id text primary key check (length(request_id) between 1 and 120),
  payload_hash text not null,
  status text not null check (status in ('processing', 'completed', 'failed')),
  claim_token uuid not null,
  lease_expires_at timestamptz not null,
  attempt_count integer not null default 1 check (attempt_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sanitized_error text
);

create table if not exists public.enquiry_reports (
  request_id text primary key references public.enquiry_runs(request_id) on delete cascade,
  normalized_preferences jsonb not null,
  shortlist jsonb not null,
  priority text not null check (priority in ('high', 'medium', 'low')),
  reasons jsonb not null,
  advisor_brief text not null,
  fetched_at timestamptz not null,
  completed_at timestamptz not null default now()
);

create or replace function public.claim_enquiry(
  p_request_id text,
  p_payload_hash text,
  p_lease_seconds integer default 90
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.enquiry_runs;
  report public.enquiry_reports;
  token uuid := gen_random_uuid();
begin
  if p_request_id is null or length(p_request_id) not between 1 and 120 or p_payload_hash is null or p_lease_seconds not between 10 and 300 then raise exception 'invalid claim parameters'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id, 0));
  p_payload_hash := encode(sha256(convert_to(p_payload_hash, 'UTF8')), 'hex');
  select * into existing from public.enquiry_runs where request_id = p_request_id for update;
  if not found then
    insert into public.enquiry_runs(request_id, payload_hash, status, claim_token, lease_expires_at)
    values (p_request_id, p_payload_hash, 'processing', token, now() + make_interval(secs => p_lease_seconds));
    return jsonb_build_object('status', 'claimed', 'claim_token', token);
  end if;

  if existing.payload_hash <> p_payload_hash then
    return jsonb_build_object('status', 'conflict');
  end if;

  if existing.status = 'completed' then
    select * into report from public.enquiry_reports where request_id = p_request_id;
    return jsonb_build_object('status', 'completed', 'report', to_jsonb(report));
  end if;

  if existing.status = 'processing' and existing.lease_expires_at > now() then
    return jsonb_build_object('status', 'processing');
  end if;

  update public.enquiry_runs
  set status = 'processing', claim_token = token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = attempt_count + 1, updated_at = now(), sanitized_error = null
  where request_id = p_request_id;
  return jsonb_build_object('status', 'claimed', 'claim_token', token);
end;
$$;

create or replace function public.finalize_enquiry(
  p_request_id text,
  p_claim_token uuid,
  p_normalized_preferences jsonb,
  p_shortlist jsonb,
  p_priority text,
  p_reasons jsonb,
  p_advisor_brief text,
  p_fetched_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.enquiry_reports;
begin
  perform 1 from public.enquiry_runs where request_id=p_request_id for update;
  if not exists (
    select 1 from public.enquiry_runs
    where request_id = p_request_id and claim_token = p_claim_token
      and status = 'processing' and lease_expires_at > now()
  ) then
    raise exception 'invalid or expired claim';
  end if;

  insert into public.enquiry_reports(request_id, normalized_preferences, shortlist, priority, reasons, advisor_brief, fetched_at)
  values (p_request_id, p_normalized_preferences, p_shortlist, p_priority, p_reasons, p_advisor_brief, p_fetched_at)
  on conflict (request_id) do update set
    normalized_preferences = excluded.normalized_preferences,
    shortlist = excluded.shortlist,
    priority = excluded.priority,
    reasons = excluded.reasons,
    advisor_brief = excluded.advisor_brief,
    fetched_at = excluded.fetched_at,
    completed_at = now();

  update public.enquiry_runs
  set status = 'completed', updated_at = now(), sanitized_error = null
  where request_id = p_request_id and claim_token = p_claim_token;

  select * into saved from public.enquiry_reports where request_id = p_request_id;
  return to_jsonb(saved);
end;
$$;

revoke all on public.enquiry_runs, public.enquiry_reports from anon, authenticated;
revoke all on function public.claim_enquiry(text, text, integer) from public;
revoke all on function public.finalize_enquiry(text, uuid, jsonb, jsonb, text, jsonb, text, timestamptz) from public;

create table if not exists public.workflow_errors (
 id uuid primary key default gen_random_uuid(), recorded_at timestamptz not null default now(),
 workflow text not null, execution_id text, correlation_id text, error text not null
);
alter table public.inventory enable row level security;
alter table public.enquiry_runs enable row level security;
alter table public.enquiry_reports enable row level security;
alter table public.workflow_errors enable row level security;
revoke all on public.inventory,public.enquiry_runs,public.enquiry_reports,public.workflow_errors from public,anon,authenticated;
grant select on public.inventory to service_role;
grant select,insert,update,delete on public.enquiry_runs,public.enquiry_reports,public.workflow_errors to service_role;
grant execute on function public.claim_enquiry(text,text,integer) to service_role;
grant execute on function public.finalize_enquiry(text,uuid,jsonb,jsonb,text,jsonb,text,timestamptz) to service_role;
