/**
 * Platform Stats API endpoint
 * GET /api/platform-stats
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
    // Mock platform statistics
    const stats = {
      success: true,
      platforms: {
        ebay: {
          name: 'eBay',
          currency: 'EUR',
          totalRevenue: 24574.75,
          totalOrders: 156,
          avgOrderValue: 157.53,
          topProducts: [
            { name: 'OOONO CO-Driver NO1', sold: 23, revenue: 1046.50 },
            { name: 'ACE A Digitales Alkoholtester', sold: 18, revenue: 593.82 },
            { name: 'Telekom Sinus PA 207', sold: 15, revenue: 854.70 }
          ],
          conversionRate: 3.2,
          returnRate: 2.1
        },
        allegro: {
          name: 'Allegro',
          currency: 'PLN',
          totalRevenue: 12401.50,
          totalOrders: 89,
          avgOrderValue: 139.34,
          topProducts: [
            { name: 'PROFESJONALNA Frezarka NEONAIL 12W', sold: 12, revenue: 1919.88 },
            { name: 'NeoNail Hard Top 7,2 ml', sold: 9, revenue: 430.38 },
            { name: 'Cudy GS1024 Switch LAN', sold: 7, revenue: 1336.72 }
          ],
          conversionRate: 4.1,
          returnRate: 1.8
        }
      },
      comparison: {
        revenueShare: { ebay: 66.5, allegro: 33.5 },
        ordersShare: { ebay: 63.7, allegro: 36.3 },
        growthMoM: { ebay: 12.3, allegro: 8.7 }
      },
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(stats);
  } catch (error: any) {
    console.error('[platform-stats] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
