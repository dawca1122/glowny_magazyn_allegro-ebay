-- Allegro listing feature: cache, token storage, and logging
create extension if not exists "pgcrypto";

create table if not exists public.integrations_allegro_tokens (
  id uuid primary key default gen_random_uuid(),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.allegro_product_cache (
  product_id text primary key,
  ean text,
  payload jsonb not null,
  main_image_url text,
  title text,
  score integer,
  fetched_at timestamptz not null default now()
);
create index if not exists idx_allegro_product_cache_ean on public.allegro_product_cache (ean);
create index if not exists idx_allegro_product_cache_fetched_at on public.allegro_product_cache (fetched_at desc);

create table if not exists public.allegro_listings_log (
  id uuid primary key default gen_random_uuid(),
  warehouse_item_id text,
  ean text,
  product_id text,
  allegro_offer_id text,
  quantity_listed int not null default 0,
  status text not null check (status in ('CREATED','FAILED')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_allegro_listings_log_created_at on public.allegro_listings_log (created_at desc);
create index if not exists idx_allegro_listings_log_product_id on public.allegro_listings_log (product_id);

-- Enable RLS with permissive policies (adjust in production)
alter table public.integrations_allegro_tokens enable row level security;
alter table public.allegro_product_cache enable row level security;
alter table public.allegro_listings_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='integrations_allegro_tokens' and policyname='integrations_allegro_tokens_allow_all') then
    create policy integrations_allegro_tokens_allow_all on public.integrations_allegro_tokens for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='allegro_product_cache' and policyname='allegro_product_cache_allow_all') then
    create policy allegro_product_cache_allow_all on public.allegro_product_cache for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='allegro_listings_log' and policyname='allegro_listings_log_allow_all') then
    create policy allegro_listings_log_allow_all on public.allegro_listings_log for all using (true) with check (true);
  end if;
end
$$;
