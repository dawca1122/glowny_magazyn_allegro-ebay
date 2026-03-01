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

  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const rows = await fetchSheetData(SHEET_ID, 'Magazyn!A:Z');

    if (rows.length < 2) {
      return res.status(200).json({
        date: todayStr,
        allegro: [],
        ebay: [],
        totals: { allegro: { items: 0, revenue: 0 }, ebay: { items: 0, revenue: 0 } },
        source: 'sheets-empty',
        timestamp: new Date().toISOString()
      });
    }

    const headers = rows[0].map((h: string) => h?.toLowerCase().trim() || '');
    const colIndex = {
      sku: headers.findIndex((h: string) => h.includes('sku')),
      name: headers.findIndex((h: string) => h.includes('nazwa') || h.includes('name')),
      stock: headers.findIndex((h: string) => h.includes('stan') || h.includes('stock')),
      cost: headers.findIndex((h: string) => h.includes('koszt') || h.includes('cost')),
      allegro_price: headers.findIndex((h: string) => h.includes('allegro') && h.includes('cen')),
      ebay_price: headers.findIndex((h: string) => h.includes('ebay') && h.includes('cen'))
    };

    const allegroSales: any[] = [];
    const ebaySales: any[] = [];

    // Mock logic for "realne towary" - in a real scenario we'd query a "Sales" sheet
    // For now, we'll return all products as if they were potentially sold today or just list them
    // The dashboard expects at least the list of products
    rows.slice(1).forEach((row: any, i: number) => {
      const sku = row[colIndex.sku] || `PROD-${i}`;
      const name = row[colIndex.name] || sku;
      const stock = parseSheetNum(row[colIndex.stock]);
      const cost = parseSheetNum(row[colIndex.cost]);
      const aPrice = parseSheetNum(row[colIndex.allegro_price]);
      const ePrice = parseSheetNum(row[colIndex.ebay_price]);

      if (aPrice > 0) {
        allegroSales.push({ productName: name, sku, soldToday: 0, revenue: aPrice, cost, total_stock: stock });
      }
      if (ePrice > 0) {
        ebaySales.push({ productName: name, sku, soldToday: 0, revenue: ePrice, cost, total_stock: stock });
      }
    });

    return res.status(200).json({
      date: todayStr,
      allegro: allegroSales,
      ebay: ebaySales,
      totals: {
        allegro: { items: allegroSales.length, revenue: allegroSales.reduce((s, x) => s + x.revenue, 0), currency: 'PLN' },
        ebay: { items: ebaySales.length, revenue: ebaySales.reduce((s, x) => s + x.revenue, 0), currency: 'EUR' }
      },
      source: 'google-sheets-direct',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[daily-sales] Error:', error);
    return res.status(200).json({
      date: todayStr,
      allegro: [],
      ebay: [],
      error: error.message,
      source: 'error-fallback',
      timestamp: new Date().toISOString()
    });
  }
}

