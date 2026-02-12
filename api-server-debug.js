import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3002; // Inny port żeby nie kolidować

app.use(cors());
app.use(express.json());

// Helper do eksportu do Google Sheets - WERSJA DEBUG
async function exportToGoogleSheetsDebug(reportData) {
  console.log('🔍 DEBUG: Rozpoczynam exportToGoogleSheets');
  
  try {
    const credentialsPath = '/home/dawca/.openclaw/workspace/google-drive-credentials.json';
    const sheetId = '1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18';
    
    console.log('🔍 DEBUG: Sprawdzam credentials:', credentialsPath);
    
    // Sprawdź czy plik z credentials istnieje
    try {
      await fs.access(credentialsPath);
      console.log('✅ DEBUG: Plik credentials istnieje');
    } catch (error) {
      console.warn('⚠️  DEBUG: Brak pliku z credentials:', error.message);
      return {
        success: false,
        error: 'Brak pliku z credentials',
        fallback: true
      };
    }
    
    // Wczytaj credentials
    console.log('🔍 DEBUG: Wczytuję credentials...');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    console.log('✅ DEBUG: Credentials wczytane, project:', credentials.project_id);
    
    // Autoryzacja
    console.log('🔍 DEBUG: Inicjuję autoryzację Google...');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    console.log('🔍 DEBUG: Pobieram auth client...');
    const authClient = await auth.getClient();
    console.log('✅ DEBUG: Auth client uzyskany');
    
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log('✅ DEBUG: Sheets API zainicjowane');
    
    // Przygotuj dane
    const today = new Date().toISOString().split('T')[0];
    console.log('🔍 DEBUG: Przygotowuję dane dla daty:', today);
    
    const values = [];
    
    // eBay
    values.push([
      today,
      'eBay',
      reportData.type || 'Tygodniowy',
      reportData.ebay?.revenue || 0,
      reportData.ebay?.costs?.shipping || 0,
      reportData.ebay?.costs?.ads || 0,
      reportData.ebay?.costs?.returns || 0,
      reportData.ebay?.costs?.fees || 0,
      reportData.ebay?.netProfit || 0,
      'EUR'
    ]);
    
    // Allegro
    values.push([
      today,
      'Allegro',
      reportData.type || 'Tygodniowy',
      reportData.allegro?.revenue || 0,
      reportData.allegro?.costs?.shipping || 0,
      reportData.allegro?.costs?.ads || 0,
      reportData.allegro?.costs?.returns || 0,
      reportData.allegro?.costs?.fees || 0,
      reportData.allegro?.netProfit || 0,
      'PLN'
    ]);
    
    console.log('✅ DEBUG: Dane przygotowane, wierszy:', values.length);
    
    // Znajdź ostatni wiersz
    console.log('🔍 DEBUG: Szukam ostatniego wiersza...');
    let lastRow = 0;
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Raporty!A:A'
      });
      lastRow = response.data.values ? response.data.values.length : 0;
      console.log('✅ DEBUG: Ostatni wiersz:', lastRow);
    } catch (error) {
      console.log('📝 DEBUG: Tworzenie nowego arkusza...', error.message);
      lastRow = 0;
    }
    
    const startRow = lastRow + 1;
    const range = `Raporty!A${startRow}:J${startRow + values.length - 1}`;
    console.log('🔍 DEBUG: Zakres do zapisu:', range);
    
    // Dodaj dane
    console.log('🔍 DEBUG: Wysyłam dane do Google Sheets...');
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    
    console.log('✅ DEBUG: Dane wysłane!');
    console.log('  Zaktualizowane komórki:', updateResponse.data.updatedCells);
    console.log('  Zakres:', updateResponse.data.updatedRange);
    
    return {
      success: true,
      sheetId,
      range,
      rowsAdded: values.length,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0`,
      debug: {
        lastRow,
        startRow,
        valuesCount: values.length
      }
    };
    
  } catch (error) {
    console.error('❌ DEBUG: Błąd eksportu do Google Sheets:');
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
    
    if (error.response) {
      console.error('  Response status:', error.response.status);
      console.error('  Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    return {
      success: false,
      error: error.message,
      fallback: true,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18/edit'
    };
  }
}

// Endpoint debug
app.post('/api/debug-export', async (req, res) => {
  try {
    const reportData = req.body;
    console.log('🔍 DEBUG Endpoint: Otrzymano dane:', reportData.type || 'Tygodniowy');
    
    const result = await exportToGoogleSheetsDebug(reportData);
    
    res.json({ 
      success: result.success, 
      message: result.success ? 'Raport wyeksportowany' : 'Błąd eksportu',
      result: result
    });
    
  } catch (error) {
    console.error('❌ DEBUG Endpoint błąd:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🔍 Debug API server działa na http://localhost:${PORT}`);
  console.log(`📁 Endpoint: POST /api/debug-export`);
});