// Google Sheets Exporter dla raportów eBay+Allegro
const { google } = require('googleapis');
const fs = require('fs');

class GoogleSheetsExporter {
  constructor() {
    this.credentialsPath = '/home/dawca/.openclaw/workspace/google-drive-credentials.json';
    this.sheetId = '1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18'; // dzidek4
    this.sheetName = 'Raporty';
    this.auth = null;
    this.sheets = null;
  }
  
  async initialize() {
    try {
      const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
      
      this.auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      
      const authClient = await this.auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: authClient });
      
      console.log('✅ Google Sheets Exporter zainicjalizowany');
      return true;
    } catch (error) {
      console.error('❌ Błąd inicjalizacji Google Sheets:', error.message);
      return false;
    }
  }
  
  async exportReport(reportData) {
    if (!this.sheets) {
      await this.initialize();
    }
    
    try {
      console.log(`📤 Eksportuję raport do Google Sheets...`);
      
      // Przygotuj dane
      const values = this.prepareData(reportData);
      
      // Pobierz ostatni wiersz
      const lastRow = await this.getLastRow();
      const startRow = lastRow + 1;
      const range = `${this.sheetName}!A${startRow}:J${startRow + values.length - 1}`;
      
      // Dodaj dane
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });
      
      console.log(`✅ Raport wyeksportowany do ${range}`);
      
      // Dodaj formatowanie dla nowych wierszy
      await this.applyFormatting(startRow, startRow + values.length - 1, reportData);
      
      return {
        success: true,
        sheetId: this.sheetId,
        range: range,
        rowsAdded: values.length
      };
      
    } catch (error) {
      console.error('❌ Błąd eksportu do Google Sheets:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  prepareData(report) {
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
    const exchangeRate = 4.5; // EUR to PLN
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
  
  async getLastRow() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: `${this.sheetName}!A:A`
      });
      
      const values = response.data.values || [];
      return values.length; // Nagłówek + dane
    } catch (error) {
      // Jeśli arkusz nie istnieje, zwróć 0
      return 0;
    }
  }
  
  async applyFormatting(startRow, endRow, report) {
    try {
      // Pobierz ID arkusza
      const sheetInfo = await this.sheets.spreadsheets.get({
        spreadsheetId: this.sheetId
      });
      
      const targetSheet = sheetInfo.data.sheets.find(s => s.properties.title === this.sheetName);
      if (!targetSheet) return;
      
      const requests = [];
      
      // Kolorowanie wierszy w zależności od platformy
      requests.push({
        repeatCell: {
          range: {
            sheetId: targetSheet.properties.sheetId,
            startRowIndex: startRow - 1,
            endRowIndex: startRow, // eBay - zielony
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 }
            }
          },
          fields: 'userEnteredFormat.backgroundColor'
        }
      });
      
      requests.push({
        repeatCell: {
          range: {
            sheetId: targetSheet.properties.sheetId,
            startRowIndex: startRow, // Allegro - niebieski
            endRowIndex: startRow + 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.85, green: 0.90, blue: 0.95 }
            }
          },
          fields: 'userEnteredFormat.backgroundColor'
        }
      });
      
      requests.push({
        repeatCell: {
          range: {
            sheetId: targetSheet.properties.sheetId,
            startRowIndex: startRow + 1, // RAZEM - szary
            endRowIndex: startRow + 2,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
              textFormat: { bold: true }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)'
        }
      });
      
      // Formatowanie walut
      requests.push({
        repeatCell: {
          range: {
            sheetId: targetSheet.properties.sheetId,
            startRowIndex: startRow - 1,
            endRowIndex: endRow,
            startColumnIndex: 3, // Kolumna D (Przychód)
            endColumnIndex: 9   // Kolumna J (przed Walutą)
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'NUMBER',
                pattern: '#,##0.00'
              }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      });
      
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.sheetId,
        resource: { requests }
      });
      
      console.log(`✅ Formatowanie zastosowane dla wierszy ${startRow}-${endRow}`);
      
    } catch (error) {
      console.warn('⚠️  Błąd formatowania (nieważne):', error.message);
    }
  }
  
  async getSheetUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit`;
  }
}

// Przykład użycia
async function testExporter() {
  const exporter = new GoogleSheetsExporter();
  await exporter.initialize();
  
  const testReport = {
    type: 'Tygodniowy',
    ebay: {
      revenue: 2450.75,
      costs: {
        shipping: 245.08,
        ads: 318.60,
        returns: 122.54,
        fees: 367.79
      },
      netProfit: 1850.50
    },
    allegro: {
      revenue: 1240.15,
      costs: {
        shipping: 124.02,
        ads: 99.21,
        returns: 62.01,
        fees: 124.02
      },
      netProfit: 930.00
    }
  };
  
  const result = await exporter.exportReport(testReport);
  console.log('📊 Wynik eksportu:', result);
  
  const sheetUrl = await exporter.getSheetUrl();
  console.log(`🔗 Link do Sheet: ${sheetUrl}`);
}

// Eksportuj moduł
module.exports = GoogleSheetsExporter;

// Uruchom test jeśli wywołany bezpośrednio
if (require.main === module) {
  testExporter().then(() => {
    console.log('✅ Test eksportera zakończony');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Test nie powiódł się:', error);
    process.exit(1);
  });
}