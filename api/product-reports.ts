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
    
    // Jeśli brak danych, zwróć mock dla demo
    if (reports.length === 0) {
      const mockReports = generateMockProductReports(
        period as string,
        reportType as string,
        platform as string
      );
      
      return res.status(200).json({
        success: true,
        period,
        reportType,
        platform: platform || 'all',
        products: mockReports,
        total: calculateTotals(mockReports),
        note: 'Mock data - podłącz eBay/Allegro API dla rzeczywistych danych'
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
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
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
        unitsSold: Number(row[5]) || 0,
        revenue: Number(row[6]) || 0,
        productCost: Number(row[7]) || 0,
        shippingCost: Number(row[8]) || 0,
        platformFees: Number(row[9]) || 0,
        adsCost: Number(row[10]) || 0,
        returnsCost: Number(row[11]) || 0,
        taxes: Number(row[12]) || 0,
        otherCosts: Number(row[13]) || 0,
        grossProfit: Number(row[14]) || 0,
        netProfit: Number(row[15]) || 0,
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
    
  } catch (error) {
    console.warn('⚠️ Nie można pobrać danych z Google Sheets, używam mock danych:', error.message);
    return [];
  }
}

function generateMockProductReports(period: string, reportType: string, platform: string): ProductReport[] {
  const platforms = platform === 'all' ? ['ebay', 'allegro'] : [platform as 'ebay' | 'allegro'];
  const reports: ProductReport[] = [];
  
  const products = [
    { id: 'IPHONE13', name: 'iPhone 13 128GB', cost: 500, price: 799 },
    { id: 'MBAIR', name: 'MacBook Air M2', cost: 1200, price: 1499 },
    { id: 'AIRPODS', name: 'AirPods Pro 2', cost: 150, price: 249 },
    { id: 'IPAD', name: 'iPad 10th Gen', cost: 400, price: 599 },
    { id: 'WATCH', name: 'Apple Watch SE', cost: 200, price: 299 },
    { id: 'MACMINI', name: 'Mac Mini M2', cost: 600, price: 899 },
    { id: 'IMAC', name: 'iMac 24"', cost: 1300, price: 1799 },
    { id: 'BEATS', name: 'Beats Studio Pro', cost: 180, price: 299 },
  ];
  
  const today = new Date().toISOString();
  
  platforms.forEach(plat => {
    const currency = plat === 'ebay' ? 'EUR' : 'PLN';
    const exchangeRate = plat === 'ebay' ? 1 : 4.5;
    
    products.forEach((product, index) => {
      // Losowa sprzedaż w zależności od typu raportu
      let unitsSold = 0;
      switch(reportType) {
        case 'weekly': unitsSold = Math.floor(Math.random() * 5) + 1; break;
        case 'monthly': unitsSold = Math.floor(Math.random() * 20) + 5; break;
        case 'quarterly': unitsSold = Math.floor(Math.random() * 60) + 15; break;
        case 'yearly': unitsSold = Math.floor(Math.random() * 240) + 60; break;
        default: unitsSold = Math.floor(Math.random() * 10) + 2;
      }
      
      const revenue = unitsSold * product.price * exchangeRate;
      const productCost = unitsSold * product.cost * exchangeRate;
      const shippingCost = revenue * 0.08; // 8% przychodu
      const platformFees = revenue * 0.12; // 12% przychodu
      const adsCost = revenue * 0.05; // 5% przychodu
      const returnsCost = revenue * 0.03; // 3% przychodu
      const taxes = revenue * 0.23; // 23% VAT
      const otherCosts = revenue * 0.02; // 2% inne
      
      const totalCosts = productCost + shippingCost + platformFees + adsCost + returnsCost + taxes + otherCosts;
      const grossProfit = revenue - productCost;
      const netProfit = revenue - totalCosts;
      
      reports.push({
        productId: product.id,
        productName: product.name,
        platform: plat,
        period: period || '2024-01',
        reportType: (reportType as any) || 'monthly',
        unitsSold,
        revenue: Math.round(revenue),
        productCost: Math.round(productCost),
        shippingCost: Math.round(shippingCost),
        platformFees: Math.round(platformFees),
        adsCost: Math.round(adsCost),
        returnsCost: Math.round(returnsCost),
        taxes: Math.round(taxes),
        otherCosts: Math.round(otherCosts),
        grossProfit: Math.round(grossProfit),
        netProfit: Math.round(netProfit),
        currency,
        generatedAt: today
      });
    });
  });
  
  return reports;
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