import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheetsClient, fetchSheetData, parseSheetNum, sanitizeSheetId } from './_lib/google-sheets.js';

export const runtime = 'nodejs';

const raw_SHEET_ID = process.env.SPREADSHEEET_ID_INVENTORY || process.env.SPREADSHEET_ID_INVENTORY || '1VkBXhxcPi4DtaMFvhCf32xbPy6p9JrarR6w_FmHTahM';
const SHEET_ID = sanitizeSheetId(raw_SHEET_ID);
const INVENTORY_SHEETS = ['Magazyn', 'Produkty', 'Inventory', 'Products', 'Stan'];

async function findInventorySheet(sheets: any): Promise<string | null> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets.properties.title'
    });
    const sheetNames = response.data.sheets?.map((s: any) => s.properties.title) || [];
    for (const name of INVENTORY_SHEETS) {
      if (sheetNames.includes(name)) return name;
    }
    return sheetNames[0] || null;
  } catch (error) {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets = await getGoogleSheetsClient();
    const sheetName = await findInventorySheet(sheets);

    if (!sheetName) throw new Error('No inventory sheet found');

    const rows = await fetchSheetData(SHEET_ID, `${sheetName}!A:Z`);

    if (rows.length < 2) return res.status(200).json({ success: true, items: [], count: 0 });

    const headers = rows[0].map((h: string) => h?.toLowerCase().trim() || '');
    const colIndex = {
      sku: headers.findIndex((h: string) => h.includes('sku')),
      name: headers.findIndex((h: string) => h.includes('nazwa') || h.includes('name')),
      stock: headers.findIndex((h: string) => h.includes('stan') || h.includes('stock')),
      price: headers.findIndex((h: string) => h.includes('cena') || h.includes('price')),
      allegro_price: headers.findIndex((h: string) => h.includes('allegro') && h.includes('cen')),
      ebay_price: headers.findIndex((h: string) => h.includes('ebay') && h.includes('cen')),
      cost: headers.findIndex((h: string) => h.includes('koszt') || h.includes('cost'))
    };

    const items = rows.slice(1).map((row: any, i: number) => ({
      sku: row[colIndex.sku] || `PROD-${i}`,
      name: row[colIndex.name] || row[colIndex.sku] || 'Unnamed Product',
      total_stock: parseSheetNum(row[colIndex.stock]),
      allegro_price: parseSheetNum(row[colIndex.allegro_price] || row[colIndex.price]),
      ebay_price: parseSheetNum(row[colIndex.ebay_price] || row[colIndex.price]),
      item_cost: parseSheetNum(row[colIndex.cost]),
      created_at: new Date().toISOString()
    })).filter((it: any) => it.sku);

    return res.status(200).json({
      success: true,
      items,
      count: items.length,
      source: `Google Sheets: ${sheetName}`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[inventory-sheets] Error:', error);
    return res.status(200).json({
      success: false,
      error: error.message,
      items: [],
      timestamp: new Date().toISOString()
    });
  }
}

