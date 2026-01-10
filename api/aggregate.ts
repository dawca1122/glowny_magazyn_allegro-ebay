import { VercelRequest, VercelResponse } from '@vercel/node';
import { refreshToken, fetchCheckoutForms } from './lib/allegro';
import { supabaseService } from './lib/supabase';

const parseAmount = (v: any): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
};

const todayRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59));
  return { fromIso: start.toISOString(), toIso: end.toISOString(), dateKey: start.toISOString().slice(0, 10) };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseService) {
    return res.status(500).json({ error: 'Supabase not configured (SUPABASE_URL/SUPABASE_SERVICE_KEY)' });
  }

  try {
    const range = todayRange();
    const token = await refreshToken();
    const orders = await fetchCheckoutForms(token.access_token, range.fromIso, range.toIso);

    // Aggregate per SKU
    const perSku: Record<string, { sold_qty: number; gross: number; shipping_cost: number; ads_cost: number; fee_cost: number }> = {};
    let channelRevenue = 0;
    let channelShipping = 0;
    let channelReturns = 0; // not implemented
    let channelFees = 0; // not implemented
    let channelAds = 0; // not implemented

    for (const order of orders) {
      const items = order.lineItems || [];
      const totalQty = items.reduce((acc, li) => acc + (li.quantity || 0), 0);
      const shippingAmount = parseAmount(order.delivery?.cost?.amount);
      channelShipping += shippingAmount;
      const perItemShipping = totalQty > 0 ? shippingAmount / totalQty : 0;

      for (const li of items) {
        const sku = li.offer?.external?.id || li.offer?.id || 'UNKNOWN';
        const qty = li.quantity || 0;
        const unitPrice = parseAmount(li.price?.amount);
        const gross = unitPrice * qty;
        channelRevenue += gross;
        if (!perSku[sku]) {
          perSku[sku] = { sold_qty: 0, gross: 0, shipping_cost: 0, ads_cost: 0, fee_cost: 0 };
        }
        perSku[sku].sold_qty += qty;
        perSku[sku].gross += gross;
        perSku[sku].shipping_cost += perItemShipping * qty;
      }
    }

    // Upsert sales_summary
    const rows = Object.entries(perSku).map(([sku, vals]) => ({
      sku,
      sold_qty: vals.sold_qty,
      gross: vals.gross,
      shipping_cost: vals.shipping_cost,
      ads_cost: vals.ads_cost,
      fee_cost: vals.fee_cost,
      updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error } = await supabaseService
        .from('sales_summary')
        .upsert(rows, { onConflict: 'sku' });
      if (error) throw error;
    }

    const netProfit = channelRevenue - channelShipping - channelFees - channelAds - channelReturns;

    const { error: channelError } = await supabaseService
      .from('channel_reports')
      .upsert({
        channel: 'allegro',
        report_date: range.dateKey,
        revenue: channelRevenue,
        ads_cost: channelAds,
        shipping_cost: channelShipping,
        returns_cost: channelReturns,
        fee_cost: channelFees,
        purchases_cost: 0,
        net_profit: netProfit,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'channel,report_date' });
    if (channelError) throw channelError;

    return res.status(200).json({ ok: true, orders: orders.length, skus: rows.length });
  } catch (err: any) {
    console.error('[aggregate] error', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
