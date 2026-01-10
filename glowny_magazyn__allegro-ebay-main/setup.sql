-- Schema for inventory app with sales cost breakdown

create table if not exists public.inventory (
  id bigint generated always as identity primary key,
  name text not null,
  sku text not null unique,
  purchase_type text not null check (purchase_type in ('Faktura','Gotowka')),
  document_type text not null check (document_type in ('Typ A','Typ B','Typ C','Typ D','Typ E','Typ F')),
  document_status text not null default 'Oczekuje' check (document_status in ('Oczekuje','Pobrano')),
  item_cost numeric(12,2) not null default 0,
  total_stock integer not null default 0,
  allegro_price numeric(12,2) not null default 0,
  ebay_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_summary (
  sku text primary key references public.inventory (sku) on delete cascade,
  sold_qty integer not null default 0,
  gross numeric(14,2) not null default 0,
  shipping_cost numeric(14,2) not null default 0,
  ads_cost numeric(14,2) not null default 0,
  fee_cost numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_summary_updated_at on public.sales_summary (updated_at desc);

-- Basic row level security policies (adjust for production)
alter table public.inventory enable row level security;
alter table public.sales_summary enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='inventory' and policyname='inventory_allow_all') then
    create policy inventory_allow_all on public.inventory for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sales_summary' and policyname='sales_summary_allow_all') then
    create policy sales_summary_allow_all on public.sales_summary for all using (true) with check (true);
  end if;
end
$$;
