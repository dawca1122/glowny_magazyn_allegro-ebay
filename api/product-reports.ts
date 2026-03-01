// Vercel Serverless Function: Raporty produktów z eBay i Allegro
import { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

// Wczytaj credentials z environment variables
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

const SHEET_ID = '1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18'; // dzidek4
const PRODUCTS_SHEET_NAME = 'Produkty_Raporty';

interface ProductReport {
  productId: string;
  productName: string;
  platform: 'ebay' | 'allegro';
  period: string; // YYYY-MM-DD, YYYY-MM, YYYY-Q1, YYYY
  reportType: 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  // Sprzedaż
  unitsSold: number;
  revenue: number;

  // Koszty
  productCost: number;      // Koszt zakupu produktu
  shippingCost: number;     // Koszty wysyłki
  platformFees: number;     // Prowizje platformy
  adsCost: number;          // Koszty reklam
  returnsCost: number;      // Zwroty/refundy
  taxes: number;            // Podatki/VAT
  otherCosts: number;       // Inne koszty

  // Zyski
  grossProfit: number;      // revenue - productCost
  netProfit: number;        // revenue - wszystkie koszty

  // Metadane
  currency: string;
  generatedAt: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { period, reportType, platform } = req.query;

    console.log('📊 Pobieranie raportu produktów:', {
      period,
      reportType,
      platform
    });

    // Jeśli nie ma danych w Google Sheets, zwróć mock danych
    const reports = await getProductReportsFromSheets(
      period as string,
      reportType as string,
      platform as string
    );

    // Jeśli brak danych, zwróć puste (nie mock!)
    if (reports.length === 0) {
      return res.status(200).json({
        success: true,
        period,
        reportType,
        platform: platform || 'all',
        products: [],
        total: { revenue: 0, cost: 0, profit: 0, units: 0, margin: 0 },
        note: 'Brak danych - połącz z Dzidek API dla prawdziwych danych z eBay/Allegro'
      });
    }

    // Zwróć rzeczywiste dane
    return res.status(200).json({
      success: true,
      period,
      reportType,
      platform: platform || 'all',
      products: reports,
      total: calculateTotals(reports),
      note: 'Dane z Google Sheets'
    });

  } catch (error: any) {
    console.error('❌ Błąd pobierania raportów produktów:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || 'Brak szczegółów'
    });
  }
}

async function getProductReportsFromSheets(period: string, reportType: string, platform: string): Promise<ProductReport[]> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });

    /** Bezpieczne parsowanie komórek Google Sheets (zawsze string lub undefined) */
    const parseSheetNum = (val: any): number => {
      if (val === undefined || val === null || val === '') return 0;
      const n = parseFloat(String(val).replace(',', '.'));
      return isNaN(n) || !isFinite(n) ? 0 : n;
    };

    // Pobierz dane z arkusza
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${PRODUCTS_SHEET_NAME}!A:Z`
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return []; // Tylko nagłówki

    // Konwertuj wiersze na obiekty ProductReport
    const reports: ProductReport[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 15) continue;

      const report: ProductReport = {
        productId: row[0] || '',
        productName: row[1] || '',
        platform: (row[2] as 'ebay' | 'allegro') || 'ebay',
        period: row[3] || period,
        reportType: (row[4] as any) || reportType,
        unitsSold: parseSheetNum(row[5]),
        revenue: parseSheetNum(row[6]),
        productCost: parseSheetNum(row[7]),
        shippingCost: parseSheetNum(row[8]),
        platformFees: parseSheetNum(row[9]),
        adsCost: parseSheetNum(row[10]),
        returnsCost: parseSheetNum(row[11]),
        taxes: parseSheetNum(row[12]),
        otherCosts: parseSheetNum(row[13]),
        grossProfit: parseSheetNum(row[14]),
        netProfit: parseSheetNum(row[15]),
        currency: row[16] || 'EUR',
        generatedAt: row[17] || new Date().toISOString()
      };

      // Filtruj po platformie jeśli podana
      if (platform && platform !== 'all' && report.platform !== platform) {
        continue;
      }

      // Filtruj po okresie jeśli podany
      if (period && report.period !== period) {
        continue;
      }

      // Filtruj po typie raportu jeśli podany
      if (reportType && report.reportType !== reportType) {
        continue;
      }

      reports.push(report);
    }

    return reports;

  } catch (error: any) {
    console.warn('⚠️ Nie można pobrać danych z Google Sheets:', error?.message || String(error));
    return [];
  }
}

function calculateTotals(reports: ProductReport[]) {
  const totals = {
    unitsSold: 0,
    revenue: 0,
    productCost: 0,
    shippingCost: 0,
    platformFees: 0,
    adsCost: 0,
    returnsCost: 0,
    taxes: 0,
    otherCosts: 0,
    grossProfit: 0,
    netProfit: 0
  };

  reports.forEach(report => {
    totals.unitsSold += report.unitsSold;
    totals.revenue += report.revenue;
    totals.productCost += report.productCost;
    totals.shippingCost += report.shippingCost;
    totals.platformFees += report.platformFees;
    totals.adsCost += report.adsCost;
    totals.returnsCost += report.returnsCost;
    totals.taxes += report.taxes;
    totals.otherCosts += report.otherCosts;
    totals.grossProfit += report.grossProfit;
    totals.netProfit += report.netProfit;
  });

  return totals;
}