/**
 * Daily Sales API endpoint
 * GET /api/daily-sales
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
    const today = new Date().toISOString().split('T')[0];

    // Mock data - w produkcji pobierz z Dzidka lub Supabase
    const dailySales = {
      date: today,
      allegro: [
        { productName: 'PROFESJONALNA Frezarka NEONAIL 12W Ręczna Mini Manicure', soldToday: 1, revenue: 159.99 },
        { productName: 'NEONAIL Nail Cleaner do naturalnej płytki paznokcia', soldToday: 1, revenue: 26.49 },
        { productName: 'NeoNail Hard Top 7,2 ml – wykończenie hybrydy', soldToday: 1, revenue: 47.82 },
        { productName: 'Blaszka NeoNail Plate For Stamps 12 srebrna', soldToday: 1, revenue: 50.36 },
        { productName: 'Cudy GS1024 Switch LAN 24x Gigabit Metalowy', soldToday: 1, revenue: 190.96 }
      ],
      ebay: [
        { productName: 'OOONO CO-Driver NO1 Blitzwarnung Echtzeit', soldToday: 1, revenue: 45.50 },
        { productName: 'ACE A Digitales Alkoholtester mit Sensor', soldToday: 1, revenue: 32.99 },
        { productName: 'Telekom Sinus PA 207 Telefonset AB DECT', soldToday: 1, revenue: 56.98 }
      ],
      totals: {
        allegro: { items: 5, revenue: 475.62, currency: 'PLN' },
        ebay: { items: 3, revenue: 135.47, currency: 'EUR' }
      },
      source: 'api',
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(dailySales);
  } catch (error: any) {
    console.error('[daily-sales] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
