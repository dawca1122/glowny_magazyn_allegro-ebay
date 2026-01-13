import { createClient } from '@supabase/supabase-js';

const getEnv = (name: string): string => {
  return process.env[name] || '';
};

const SUPABASE_URL = getEnv('SUPABASE_URL');
// Prefer service role key; keep backward-compat with previous SERVICE_KEY naming
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY envs.');
}

export const supabaseService = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export type SalesSummaryRow = {
  sku: string;
  sold_qty: number;
  gross: number;
  shipping_cost: number;
  ads_cost: number;
  fee_cost: number;
  updated_at?: string;
};

export type ChannelReportRow = {
  channel: 'allegro' | 'ebay';
  report_date: string; // YYYY-MM-DD
  revenue: number;
  ads_cost: number;
  shipping_cost: number;
  returns_cost: number;
  fee_cost: number;
  purchases_cost: number;
  net_profit: number;
};
