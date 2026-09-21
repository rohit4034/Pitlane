create table if not exists public.market_listings (
 id uuid primary key default gen_random_uuid(),
 stock_number text not null unique,
 make text not null, model text not null, body_type text not null,
 model_year integer not null check(model_year between 1980 and 2100),
 mileage_km integer not null check(mileage_km>=0),
 asking_price_aed numeric not null check(asking_price_aed>0),
 status text not null check(status='advertised'),
 source text not null, source_url text not null,
 source_observed_at timestamptz not null,
 location text not null, regional_specs text not null,
 body_type_source text not null,
 updated_at timestamptz not null default now()
);
alter table public.market_listings enable row level security;
revoke all on public.market_listings from public,anon,authenticated;
grant select,insert,update on public.market_listings to service_role;
notify pgrst, 'reload schema';
