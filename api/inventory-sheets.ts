/**
 * Inventory from Google Sheets API
 * GET /api/inventory-sheets - Pobiera produkty z Google Sheets
 * DELETE /api/inventory-sheets?cleanup=monthly - Kasuje historię starszą niż miesiąc
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

export const runtime = 'nodejs';

// Credentials z env
const credentials = {
  type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
  universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
};

const SHEET_ID = '1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18';
// Arkusze do sprawdzenia (w kolejności priorytetu)
const INVENTORY_SHEETS = ['Magazyn', 'Produkty', 'Inventory', 'Products', 'Stan'];

interface InventoryItem {
  sku: string;
  name: string;
  ean?: string;
  total_stock: number;
  allegro_price: number;
  ebay_price: number;
  allegro_stock?: number;
  ebay_stock?: number;
  item_cost: number;
  allegro_title?: string;
  ebay_title?: string;
  created_at: string;
}

async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function findInventorySheet(sheets: any): Promise<string | null> {
  try {
    // Pobierz listę arkuszy
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets.properties.title'
    });
    
    const sheetNames = response.data.sheets?.map((s: any) => s.properties.title) || [];
    console.log('[inventory-sheets] Dostępne arkusze:', sheetNames);
    
    // Znajdź pasujący arkusz
    for (const name of INVENTORY_SHEETS) {
      if (sheetNames.includes(name)) {
        console.log('[inventory-sheets] Znaleziono arkusz:', name);
        return name;
      }
    }
    
    // Sprawdź też częściowe dopasowania
    for (const sheetName of sheetNames) {
      const lower = sheetName.toLowerCase();
      if (lower.includes('magazyn') || lower.includes('produkt') || lower.includes('inventory') || lower.includes('stock')) {
        console.log('[inventory-sheets] Znaleziono arkusz (partial):', sheetName);
        return sheetName;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[inventory-sheets] Błąd pobierania listy arkuszy:', error);
    return null;
  }
}

async function fetchInventoryFromSheets(sheets: any, sheetName: string): Promise<InventoryItem[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A:Z` // Pobierz wszystkie kolumny
    });
    
    const rows = response.data.values || [];
    if (rows.length < 2) {
      console.log('[inventory-sheets] Brak danych w arkuszu', sheetName);
      return [];
    }
    
    // Pierwsza linia = nagłówki
    const headers = rows[0].map((h: string) => h?.toLowerCase().trim() || '');
    console.log('[inventory-sheets] Nagłówki:', headers.slice(0, 10));
    
    // Mapowanie kolumn
    const colIndex = {
      sku: headers.findIndex((h: string) => h.includes('sku') || h === 'id' || h === 'kod'),
      name: headers.findIndex((h: string) => h.includes('nazwa') || h.includes('name') || h.includes('tytuł') || h.includes('title')),
      ean: headers.findIndex((h: string) => h.includes('ean') || h.includes('barcode') || h.includes('gtin')),
      stock: headers.findIndex((h: string) => h.includes('stan') || h.includes('stock') || h.includes('ilość') || h.includes('qty')),
      price: headers.findIndex((h: string) => h.includes('cena') || h.includes('price')),
      allegro_price: headers.findIndex((h: string) => h.includes('allegro') && h.includes('cen')),
      ebay_price: headers.findIndex((h: string) => h.includes('ebay') && h.includes('cen')),
      cost: headers.findIndex((h: string) => h.includes('koszt') || h.includes('cost') || h.includes('zakup'))
    };
    
    console.log('[inventory-sheets] Mapowanie kolumn:', colIndex);
    
    // Parsuj wiersze
    const items: InventoryItem[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const sku = row[colIndex.sku] || row[0] || `PROD-${i}`;
      const name = row[colIndex.name] || row[1] || sku;
      
      if (!sku || sku.trim() === '') continue;
      
      const parseNum = (val: any) => {
        if (!val) return 0;
        const num = parseFloat(String(val).replace(/[^\d.,\-]/g, '').replace(',', '.'));
        return isNaN(num) ? 0 : num;
      };
      
      items.push({
        sku: String(sku).trim(),
        name: String(name).trim(),
        ean: colIndex.ean >= 0 ? row[colIndex.ean] : undefined,
        total_stock: parseNum(row[colIndex.stock >= 0 ? colIndex.stock : 2]),
        allegro_price: parseNum(row[colIndex.allegro_price >= 0 ? colIndex.allegro_price : colIndex.price]),
        ebay_price: parseNum(row[colIndex.ebay_price >= 0 ? colIndex.ebay_price : colIndex.price]),
        allegro_stock: parseNum(row[colIndex.stock >= 0 ? colIndex.stock : 2]),
        ebay_stock: 0,
        item_cost: parseNum(row[colIndex.cost >= 0 ? colIndex.cost : 3]),
        created_at: new Date().toISOString()
      });
    }
    
    console.log('[inventory-sheets] Załadowano produktów:', items.length);
    return items;
    
  } catch (error) {
    console.error('[inventory-sheets] Błąd pobierania danych:', error);
    return [];
  }
}

async function cleanupOldHistoryFromSheets(sheets: any): Promise<{ deleted: number; message: string }> {
  try {
    // Znajdź arkusz z historią (np. "Historia" lub "Log")
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets.properties'
    });
    
    const sheetsList = response.data.sheets || [];
    let historySheetId: number | null = null;
    let historySheetName: string | null = null;
    
    for (const sheet of sheetsList) {
      const title = sheet.properties?.title?.toLowerCase() || '';
      if (title.includes('historia') || title.includes('history') || title.includes('log')) {
        historySheetId = sheet.properties.sheetId;
        historySheetName = sheet.properties.title;
        break;
      }
    }
    
    if (!historySheetName) {
      return { deleted: 0, message: 'Brak arkusza historii do wyczyszczenia' };
    }
    
    // Pobierz dane z historii
    const historyData = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${historySheetName}!A:A`
    });
    
    const rows = historyData.data.values || [];
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    // Znajdź wiersze starsze niż miesiąc
    const rowsToDelete: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const dateStr = rows[i]?.[0];
      if (dateStr) {
        const rowDate = new Date(dateStr);
        if (rowDate < oneMonthAgo) {
          rowsToDelete.push(i);
        }
      }
    }
    
    if (rowsToDelete.length === 0) {
      return { deleted: 0, message: 'Brak starych wpisów do usunięcia' };
    }
    
    // Usuń wiersze (od końca żeby nie zmieniać indeksów)
    const requests = rowsToDelete.reverse().map(rowIndex => ({
      deleteDimension: {
        range: {
          sheetId: historySheetId,
          dimension: 'ROWS',
          startIndex: rowIndex,
          endIndex: rowIndex + 1
        }
      }
    }));
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: { requests }
    });
    
    return { 
      deleted: rowsToDelete.length, 
      message: `Usunięto ${rowsToDelete.length} wpisów starszych niż miesiąc` 
    };
    
  } catch (error: any) {
    console.error('[inventory-sheets] Błąd czyszczenia historii:', error);
    return { deleted: 0, message: `Błąd: ${error.message}` };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets = await getGoogleSheetsClient();
    
    // DELETE - czyszczenie historii
    if (req.method === 'DELETE') {
      const result = await cleanupOldHistoryFromSheets(sheets);
      return res.status(200).json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    }
    
    // GET - pobieranie produktów
    if (req.method === 'GET') {
      const sheetName = await findInventorySheet(sheets);
      
      if (!sheetName) {
        return res.status(200).json({
          success: false,
          items: [],
          message: 'Nie znaleziono arkusza z produktami. Utwórz arkusz "Magazyn" lub "Produkty".',
          availableSheets: 'Sprawdź logi serwera',
          timestamp: new Date().toISOString()
        });
      }
      
      const items = await fetchInventoryFromSheets(sheets, sheetName);
      
      return res.status(200).json({
        success: true,
        items,
        count: items.length,
        source: `Google Sheets: ${sheetName}`,
        sheetId: SHEET_ID,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error: any) {
    console.error('[inventory-sheets] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      items: [],
      timestamp: new Date().toISOString()
    });
  }
}
