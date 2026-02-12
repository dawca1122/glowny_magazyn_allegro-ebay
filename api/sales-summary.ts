/**
 * Sales Summary API endpoint
 * GET /api/sales-summary
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Mock data - w produkcji pobierz z Supabase lub Dzidka
    const salesSummary = {
      daily: {
        revenue: { ebay: 2450.75, allegro: 1240.15 },
        costs: { products: 1476, fees: 369, taxes: 295 },
        net: { ebay: 1850.50, allegro: 930.00 }
      },
      monthly: {
        revenue: { ebay: 24574.75, allegro: 12401.50 },
        costs: { products: 9244.07, fees: 4186.84, taxes: 3697.63 },
        net: { ebay: 12779.86, allegro: 7068.85 },
        dailyAverage: 662.00
      },
      source: 'api',
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(salesSummary);
  } catch (error: any) {
    console.error('[sales-summary] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
