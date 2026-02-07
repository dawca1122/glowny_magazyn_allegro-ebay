-- Migration: eBay Integration & Products Mapping
-- Date: 2026-02-07
-- Purpose: Extend schema for dual-channel (eBay + Allegro) operations

-- =====================================================
-- 1. Products Mapping Table (Central Purchase Costs)
-- =====================================================

create table if not exists public.products_mapping (
  sku text primary key references public.inventory (sku) on delete cascade,
  purchase_price numeric(12,2) not null default 0,
  ebay_image_url text,
  allegro_image_url text,
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_mapping_updated_at 
  on public.products_mapping (updated_at desc);

-- Enable RLS
alter table public.products_mapping enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname='public' 
    and tablename='products_mapping' 
    and policyname='products_mapping_allow_all'
  ) then
    create policy products_mapping_allow_all 
      on public.products_mapping 
      for all 
      using (true) 
      with check (true);
  end if;
end
$$;

-- =====================================================
-- 2. eBay Daily Transactions (Raw Data from Worker)
-- =====================================================

create table if not exists public.ebay_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  order_id text,
  sku text,
  item_title text,
  quantity integer not null default 0,
  total_price numeric(14,2) not null default 0,
  shipping_cost numeric(14,2) not null default 0,
  final_value_fee numeric(14,2) not null default 0,
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create index if not exists idx_ebay_transactions_date 
  on public.ebay_transactions (transaction_date desc);
  
create index if not exists idx_ebay_transactions_sku 
  on public.ebay_transactions (sku);

-- Enable RLS
alter table public.ebay_transactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname='public' 
    and tablename='ebay_transactions' 
    and policyname='ebay_transactions_allow_all'
  ) then
    create policy ebay_transactions_allow_all 
      on public.ebay_transactions 
      for all 
      using (true) 
      with check (true);
  end if;
end
$$;

-- =====================================================
-- 3. Extend channel_reports for eBay
-- =====================================================

-- Verify channel constraint includes 'ebay'
do $$
begin
  -- Remove old constraint if exists
  if exists (
    select 1 from pg_constraint 
    where conname = 'channel_reports_channel_check'
  ) then
    alter table public.channel_reports 
      drop constraint channel_reports_channel_check;
  end if;
  
  -- Add new constraint with both channels
  alter table public.channel_reports 
    add constraint channel_reports_channel_check 
    check (channel in ('allegro', 'ebay'));
end
$$;

-- =====================================================
-- 4. Function: Auto-update products_mapping.updated_at
-- =====================================================

create or replace function public.update_products_mapping_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_mapping_update_timestamp on public.products_mapping;

create trigger products_mapping_update_timestamp
  before update on public.products_mapping
  for each row
  execute function public.update_products_mapping_timestamp();

-- =====================================================
-- 5. View: Daily Summary Per Channel
-- =====================================================

create or replace view public.daily_channel_summary as
select 
  channel,
  report_date,
  revenue,
  ads_cost,
  shipping_cost,
  fee_cost,
  purchases_cost,
  net_profit,
  (revenue - ads_cost - shipping_cost - fee_cost - purchases_cost) as calculated_net_profit
from public.channel_reports
order by report_date desc, channel;

comment on view public.daily_channel_summary is 
  'Simplified view for dashboard: daily metrics per channel (ebay/allegro)';
