// Vercel Serverless Function: Eksport raportów do Google Sheets
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
const SHEET_NAME = 'Raporty';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const reportData = req.body;
    
    console.log('📤 Eksport raportu do Google Sheets:', {
      type: reportData.type,
      period: reportData.period
    });
    
    // Autoryzuj z Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // Przygotuj dane
    const values = prepareData(reportData);
    
    // Pobierz ostatni wiersz
    const lastRow = await getLastRow(sheets);
    const startRow = lastRow + 1;
    const range = `${SHEET_NAME}!A${startRow}:J${startRow + values.length - 1}`;
    
    // Dodaj dane
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    
    console.log(`✅ Raport wyeksportowany do ${range}`);
    
    // Zwróć sukces
    res.status(200).json({
      success: true,
      message: 'Raport wyeksportowany do Google Sheets',
      sheetId: SHEET_ID,
      range,
      rowsAdded: values.length,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`
    });
    
  } catch (error) {
    console.error('❌ Błąd eksportu do Google Sheets:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || 'Brak szczegółów'
    });
  }
}

function prepareData(report) {
  const today = new Date().toISOString().split('T')[0];
  const rows = [];
  
  // eBay
  rows.push([
    today,
    'eBay',
    report.type || 'Tygodniowy',
    report.ebay?.revenue || 0,
    report.ebay?.costs?.shipping || 0,
    report.ebay?.costs?.ads || 0,
    report.ebay?.costs?.returns || 0,
    report.ebay?.costs?.fees || 0,
    report.ebay?.netProfit || 0,
    'EUR'
  ]);
  
  // Allegro
  rows.push([
    today,
    'Allegro',
    report.type || 'Tygodniowy',
    report.allegro?.revenue || 0,
    report.allegro?.costs?.shipping || 0,
    report.allegro?.costs?.ads || 0,
    report.allegro?.costs?.returns || 0,
    report.allegro?.costs?.fees || 0,
    report.allegro?.netProfit || 0,
    'PLN'
  ]);
  
  // RAZEM (przeliczone na PLN)
  const exchangeRate = 4.5;
  const totalRevenue = (report.ebay?.revenue || 0) * exchangeRate + (report.allegro?.revenue || 0);
  const totalShipping = (report.ebay?.costs?.shipping || 0) * exchangeRate + (report.allegro?.costs?.shipping || 0);
  const totalAds = (report.ebay?.costs?.ads || 0) * exchangeRate + (report.allegro?.costs?.ads || 0);
  const totalReturns = (report.ebay?.costs?.returns || 0) * exchangeRate + (report.allegro?.costs?.returns || 0);
  const totalFees = (report.ebay?.costs?.fees || 0) * exchangeRate + (report.allegro?.costs?.fees || 0);
  const totalNetProfit = (report.ebay?.netProfit || 0) * exchangeRate + (report.allegro?.netProfit || 0);
  
  rows.push([
    today,
    'RAZEM',
    report.type || 'Tygodniowy',
    totalRevenue,
    totalShipping,
    totalAds,
    totalReturns,
    totalFees,
    totalNetProfit,
    'PLN'
  ]);
  
  return rows;
}

async function getLastRow(sheets) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:A`
    });
    
    const values = response.data.values || [];
    return values.length;
  } catch (error) {
    // Jeśli arkusz nie istnieje, zwróć 0
    return 0;
  }
}