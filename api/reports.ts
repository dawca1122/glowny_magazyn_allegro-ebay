import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseService } from './lib/supabase.js';
import { ReportPeriodType, PeriodReport, ChannelReport } from '../glowny_magazyn__allegro-ebay-main/types.js';

const parsePeriod = (periodType: ReportPeriodType, period: string): { from: string; to: string } => {
  if (periodType === 'quarter') {
    const [yearStr, q] = period.split('-Q');
    const year = Number(yearStr);
    const qNum = Number(q);
    const startMonth = (qNum - 1) * 3;
    const from = new Date(Date.UTC(year, startMonth, 1));
    const to = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59));
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
};

const sumChannel = (rows: any[], channel: 'allegro' | 'ebay'): ChannelReport => {
  const filtered = rows.filter(r => r.channel === channel);
  const agg = filtered.reduce(
    (acc, r) => {
      acc.revenue += r.revenue || 0;
      acc.ads += r.ads_cost || 0;
      acc.shipping += r.shipping_cost || 0;
      acc.returns += r.returns_cost || 0;
      acc.netProfit += r.net_profit || 0;
      return acc;
    },
    { revenue: 0, ads: 0, shipping: 0, returns: 0, netProfit: 0 }
  );
  return agg;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const periodType = (req.query.periodType as ReportPeriodType) || 'month';
  const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);

  if (!supabaseService) {
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasKey = !!process.env.SUPABASE_SERVICE_KEY;
    console.error('[reports] Supabase not configured', { hasUrl, hasKey });
    return res.status(500).json({ error: 'Supabase not configured', hasSupabaseUrl: hasUrl, hasSupabaseServiceKey: hasKey });
  }

  try {
    const { from, to } = parsePeriod(periodType, period);
    const { data, error } = await supabaseService
      .from('channel_reports')
      .select('*')
      .gte('report_date', from)
      .lte('report_date', to);

    if (error) throw error;
    const rows = data || [];
    const allegro = sumChannel(rows, 'allegro');
    const ebay = sumChannel(rows, 'ebay');
    const purchasesCost = rows.reduce((acc, r) => acc + (r.purchases_cost || 0), 0);

    const response: PeriodReport = {
      period,
      periodType,
      periodLabel: period,
      allegro,
      ebay,
      purchasesCost,
      allegroProfit: allegro.netProfit,
      ebayProfit: ebay.netProfit,
    };

    return res.status(200).json(response);
  } catch (err: any) {
    console.error('[reports] error', err, {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    });
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
