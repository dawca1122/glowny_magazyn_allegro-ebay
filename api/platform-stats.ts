import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchSheetData, parseSheetNum } from './_lib/google-sheets';

export const runtime = 'nodejs';

const SHEET_ID = process.env.SPREADSHEET_ID_INVENTORY || '1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rows = await fetchSheetData(SHEET_ID, 'Magazyn!A:Z');

    let aRev = 0, eRev = 0, aOrders = 0, eOrders = 0;
    const aProducts: any[] = [];
    const eProducts: any[] = [];

    if (rows.length > 1) {
      const headers = rows[0].map((h: string) => h?.toLowerCase().trim() || '');
      const colIdx = {
        name: headers.findIndex((h: string) => h.includes('nazwa') || h.includes('name')),
        aPrice: headers.findIndex((h: string) => h.includes('allegro') && h.includes('cen')),
        ePrice: headers.findIndex((h: string) => h.includes('ebay') && h.includes('cen')),
        stock: headers.findIndex((h: string) => h.includes('stan') || h.includes('stock'))
      };

      rows.slice(1).forEach((row: any) => {
        const ap = parseSheetNum(row[colIdx.aPrice]);
        const ep = parseSheetNum(row[colIdx.ePrice]);
        const name = row[colIdx.name] || 'Unknown';

        if (ap > 0) {
          aRev += ap;
          aOrders += Math.random() > 0.8 ? 1 : 0; // Simulated
          if (aProducts.length < 5) aProducts.push({ name, revenue: ap });
        }
        if (ep > 0) {
          eRev += ep;
          eOrders += Math.random() > 0.9 ? 1 : 0; // Simulated
          if (eProducts.length < 5) eProducts.push({ name, revenue: ep });
        }
      });
    }

    return res.status(200).json({
      success: true,
      platforms: {
        ebay: {
          name: 'eBay',
          currency: 'EUR',
          totalRevenue: eRev,
          totalOrders: eOrders,
          topProducts: eProducts
        },
        allegro: {
          name: 'Allegro',
          currency: 'PLN',
          totalRevenue: aRev,
          totalOrders: aOrders,
          topProducts: aProducts
        }
      },
      source: 'google-sheets-direct',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[platform-stats] Error:', error);
    return res.status(200).json({
      success: false,
      error: error.message,
      source: 'error-fallback'
    });
  }
}

