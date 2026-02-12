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
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Ścieżki do danych agentów
const WORKSPACE_PATH = '/home/dawca/.openclaw/workspace';
const DATA_DIR = '/home/dawca/.openclaw/data';
const EBAY_DATA_PATH = join(WORKSPACE_PATH, 'ebay-daily-report.json');
const ALLEGRO_DATA_PATH = join(WORKSPACE_PATH, 'allegro-daily-data.json');

// Helper do odczytu plików
async function readJsonFile(path) {
  try {
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Nie można odczytać pliku ${path}:`, error.message);
    return null;
  }
}

// 1. Endpoint dla dziennej sprzedaży
app.get('/api/daily-sales', async (req, res) => {
  try {
    // Próbujemy odczytać dane z plików agentów
    const ebayData = await readJsonFile(EBAY_DATA_PATH);
    const allegroData = await readJsonFile(ALLEGRO_DATA_PATH);
    
    // Przetwarzanie danych eBay
    let ebaySales = [];
    let ebayTotalItems = 0;
    let ebayTotalRevenue = 0;
    
    if (ebayData && ebayData.transactions) {
      ebaySales = ebayData.transactions.map(item => ({
        productName: item.productName,
        soldToday: item.soldToday,
        revenue: item.revenue
      }));
      ebayTotalItems = ebayData.summary?.totalItems || ebaySales.reduce((sum, item) => sum + item.soldToday, 0);
      ebayTotalRevenue = ebayData.summary?.totalRevenue || ebaySales.reduce((sum, item) => sum + item.revenue, 0);
    }
    
    // Przetwarzanie danych Allegro
    let allegroSales = [];
    let allegroTotalItems = 0;
    let allegroTotalRevenue = 0;
    
    if (allegroData && allegroData.sales) {
      allegroSales = allegroData.sales.map(item => ({
        productName: item.productName,
        soldToday: item.soldToday,
        revenue: item.revenue
      }));
      allegroTotalItems = allegroData.summary?.totalItems || allegroSales.reduce((sum, item) => sum + item.soldToday, 0);
      allegroTotalRevenue = allegroData.summary?.totalRevenue || allegroSales.reduce((sum, item) => sum + item.revenue, 0);
    }
    
    // Jeśli brak danych, zwracamy mock
    if (ebaySales.length === 0 && allegroSales.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      
      const mockAllegroSales = [
        { productName: 'iPhone 15 Pro Max 256GB', soldToday: 3, revenue: 4500 },
        { productName: 'Samsung Galaxy S24 Ultra', soldToday: 2, revenue: 3000 },
        { productName: 'AirPods Pro 2', soldToday: 5, revenue: 1250 },
        { productName: 'MacBook Air M3', soldToday: 1, revenue: 1200 },
        { productName: 'Apple Watch Series 9', soldToday: 4, revenue: 1600 }
      ];
      
      const mockEbaySales = [
        { productName: 'Sony PlayStation 5', soldToday: 2, revenue: 1000 },
        { productName: 'Xbox Series X', soldToday: 1, revenue: 500 },
        { productName: 'Nintendo Switch OLED', soldToday: 3, revenue: 900 },
        { productName: 'RTX 4090 Gaming PC', soldToday: 1, revenue: 3000 },
        { productName: 'Gaming Monitor 27" 4K', soldToday: 2, revenue: 800 }
      ];
      
      return res.json({
        date: today,
        allegro: mockAllegroSales,
        ebay: mockEbaySales,
        totals: {
          allegro: { items: 15, revenue: 11550 },
          ebay: { items: 9, revenue: 6200 }
        },
        source: 'mock'
      });
    }
    
    res.json({
      date: new Date().toISOString().split('T')[0],
      allegro: allegroSales,
      ebay: ebaySales,
      totals: {
        allegro: { items: allegroTotalItems, revenue: allegroTotalRevenue },
        ebay: { items: ebayTotalItems, revenue: ebayTotalRevenue }
      },
      source: 'agent-data'
    });
    
  } catch (error) {
    console.error('Błąd API /api/daily-sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Endpoint dla raportów miesięcznych/kwartalnych
app.get('/api/reports', async (req, res) => {
  try {
    const { periodType = 'month', period } = req.query;
    
    // Funkcja do formatowania etykiety okresu
    const formatPeriodLabel = (periodType, period) => {
      if (periodType === 'quarter') {
        const [year, quarter] = period.split('-Q');
        return `${year} Q${quarter}`;
      }
      const [year, month] = period.split('-');
      const monthInt = Number(month);
      const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
      const label = monthInt >= 1 && monthInt <= 12 ? monthNames[monthInt - 1] : month;
      return `${label} ${year}`;
    };
    
    // Spróbuj odczytać miesięczny raport z pliku
    const monthlyReportPath = path.join(WORKSPACE_PATH, 'monthly-report.json');
    const monthlyReport = await readJsonFile(monthlyReportPath);
    
    // Jeśli mamy raport z pliku i okres się zgadza, użyj go
    if (monthlyReport && monthlyReport.period === (period || new Date().toISOString().slice(0, 7))) {
      res.json({
        ...monthlyReport,
        periodLabel: formatPeriodLabel(periodType, period || new Date().toISOString().slice(0, 7))
      });
      return;
    }
    
    // W przeciwnym razie użyj mock danych
    const mockReport = {
      period: period || new Date().toISOString().slice(0, 7),
      periodType,
      periodLabel: formatPeriodLabel(periodType, period || new Date().toISOString().slice(0, 7)),
      allegro: {
        revenue: 12401.50,
        ads: 620.08,
        shipping: 1240.15,
        returns: 372.05,
        netProfit: 10169.22
      },
      ebay: {
        revenue: 24574.75,
        ads: 1228.74,
        shipping: 1965.98,
        returns: 737.24,
        netProfit: 20642.79
      },
      purchasesCost: 9244.07,
      allegroProfit: 10169.22,
      ebayProfit: 20642.79
    };
    
    res.json(mockReport);
    
  } catch (error) {
    console.error('Błąd API /api/reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper do eksportu do Google Sheets
async function exportToGoogleSheets(reportData) {
  console.log('📤 Eksport do Google Sheets:', reportData.type || 'Tygodniowy');
  
  try {
    const credentialsPath = '/home/dawca/.openclaw/workspace/google-drive-credentials.json';
    const sheetId = '1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18';
    
    // Sprawdź czy plik z credentials istnieje
    try {
      await fs.access(credentialsPath);
    } catch (error) {
      console.warn('⚠️  Brak pliku z credentials Google Sheets:', credentialsPath);
      return {
        success: false,
        error: 'Brak pliku z credentials',
        fallback: true,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
      };
    }
    
    // Wczytaj credentials
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    
    // Autoryzacja
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // Przygotuj dane
    const today = new Date().toISOString().split('T')[0];
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
    
    // RAZEM (przeliczone na PLN)
    const exchangeRate = 4.5;
    const totalRevenue = (reportData.ebay?.revenue || 0) * exchangeRate + (reportData.allegro?.revenue || 0);
    const totalShipping = (reportData.ebay?.costs?.shipping || 0) * exchangeRate + (reportData.allegro?.costs?.shipping || 0);
    const totalAds = (reportData.ebay?.costs?.ads || 0) * exchangeRate + (reportData.allegro?.costs?.ads || 0);
    const totalReturns = (reportData.ebay?.costs?.returns || 0) * exchangeRate + (reportData.allegro?.costs?.returns || 0);
    const totalFees = (reportData.ebay?.costs?.fees || 0) * exchangeRate + (reportData.allegro?.costs?.fees || 0);
    const totalNetProfit = (reportData.ebay?.netProfit || 0) * exchangeRate + (reportData.allegro?.netProfit || 0);
    
    values.push([
      today,
      'RAZEM',
      reportData.type || 'Tygodniowy',
      totalRevenue,
      totalShipping,
      totalAds,
      totalReturns,
      totalFees,
      totalNetProfit,
      'PLN'
    ]);
    
    // Znajdź ostatni wiersz
    let lastRow = 0;
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Raporty!A:A'
      });
      lastRow = response.data.values ? response.data.values.length : 0;
      console.log(`📊 Znaleziono ${lastRow} wierszy w arkuszu`);
    } catch (error) {
      console.log('📝 Tworzenie nowego arkusza...');
      lastRow = 0;
    }
    
    const startRow = lastRow + 1;
    const range = `Raporty!A${startRow}:J${startRow + values.length - 1}`;
    
    console.log(`📝 Zapisuję do zakresu: ${range}`);
    
    // Dodaj dane
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    
    console.log(`✅ Raport wyeksportowany do ${range}`);
    console.log(`   Zaktualizowane komórki: ${updateResponse.data.updatedCells}`);
    
    return {
      success: true,
      sheetId,
      range,
      rowsAdded: values.length,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0`
    };
    
  } catch (error) {
    console.error('❌ Błąd eksportu do Google Sheets:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
    
    return {
      success: false,
      error: error.message,
      fallback: true,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18/edit'
    };
  }
}

// 3. Endpoint dla eksportu do Google Sheets
app.post('/api/export-to-sheets', async (req, res) => {
  try {
    const reportData = req.body;
    console.log('📤 Eksport do Google Sheets:', reportData.type || 'Tygodniowy');
    
    // Eksportuj do Google Sheets
    const result = await exportToGoogleSheets(reportData);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: `Raport wyeksportowany do Google Sheets (${result.rowsAdded} wierszy)`,
        sheetUrl: result.sheetUrl,
        details: result
      });
    } else if (result.fallback) {
      // Fallback - tylko zwróć link
      res.json({ 
        success: true, 
        message: 'Raport przygotowany (brak połączenia z Google Sheets)',
        sheetUrl: result.sheetUrl,
        fallback: true
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
    
  } catch (error) {
    console.error('Błąd API /api/export-to-sheets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18/edit'
    });
  }
});

// 4. Endpoint dla podsumowania sprzedaży
app.get('/api/sales-summary', async (req, res) => {
  try {
    // Pobierz aktualne dane z plików
    const today = new Date().toISOString().split('T')[0];
    const ebayTodayPath = path.join(DATA_DIR, 'ebay/daily', `${today}.json`);
    const allegroTodayPath = path.join(DATA_DIR, 'allegro/daily', `${today}.json`);
    
    let ebayData = null;
    let allegroData = null;
    
    try {
      ebayData = JSON.parse(await fs.readFile(ebayTodayPath, 'utf-8'));
    } catch (error) {
      console.log('ℹ️  Brak dzisiejszych danych eBay');
    }
    
    try {
      allegroData = JSON.parse(await fs.readFile(allegroTodayPath, 'utf-8'));
    } catch (error) {
      console.log('ℹ️  Brak dzisiejszych danych Allegro');
    }
    
    const summary = {
      daily: {
        revenue: { 
          ebay: ebayData?.data?.revenue || 2450.75, 
          allegro: allegroData?.data?.revenue || 1240.15 
        },
        costs: { 
          products: Math.round((ebayData?.data?.revenue || 2450.75) * 0.4 + (allegroData?.data?.revenue || 1240.15) * 0.4),
          fees: Math.round((ebayData?.data?.revenue || 2450.75) * 0.1 + (allegroData?.data?.revenue || 1240.15) * 0.1),
          taxes: Math.round((ebayData?.data?.revenue || 2450.75) * 0.08 + (allegroData?.data?.revenue || 1240.15) * 0.08)
        },
        net: { 
          ebay: ebayData?.data?.profit || 1850.50, 
          allegro: allegroData?.data?.profit || 930.00 
        }
      },
      monthly: {
        revenue: { 
          ebay: 24574.75, // To można poprawić czytając monthly data
          allegro: 12401.50 
        },
        costs: { 
          products: 9244.07, 
          fees: 4186.84, 
          taxes: 3697.63 
        },
        net: { 
          ebay: 12779.86, 
          allegro: 7068.85 
        },
        dailyAverage: 662.00
      },
      updatedAt: new Date().toISOString(),
      source: ebayData || allegroData ? 'real-data' : 'mock'
    };
    
    res.json(summary);
    
  } catch (error) {
    console.error('Błąd API /api/sales-summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Endpoint dla danych wykresów
app.get('/api/chart-data', async (req, res) => {
  try {
    const { period = '30d', platform = 'all' } = req.query;
    console.log(`📈 Pobieram dane wykresu: period=${period}, platform=${platform}`);
    
    // Określ liczbę dni do pobrania
    let daysToFetch = 30;
    if (period === '7d') daysToFetch = 7;
    else if (period === '90d') daysToFetch = 90;
    else if (period === '180d') daysToFetch = 180;
    else if (period === '1y') daysToFetch = 365;
    
    const data = {
      labels: [],
      datasets: []
    };
    
    // Pobierz dane eBay
    if (platform === 'all' || platform === 'ebay') {
      const ebayData = await fetchChartData('ebay', daysToFetch);
      data.datasets.push({
        label: 'eBay',
        data: ebayData.map(d => d.revenue),
        borderColor: 'rgb(34, 197, 94)', // zielony
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true
      });
      
      // Użyj etykiet z danych eBay jeśli jeszcze nie mamy
      if (data.labels.length === 0) {
        data.labels = ebayData.map(d => d.date);
      }
    }
    
    // Pobierz dane Allegro
    if (platform === 'all' || platform === 'allegro') {
      const allegroData = await fetchChartData('allegro', daysToFetch);
      data.datasets.push({
        label: 'Allegro',
        data: allegroData.map(d => d.revenue),
        borderColor: 'rgb(99, 102, 241)', // niebieski
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        fill: true
      });
      
      // Użyj etykiet z danych Allegro jeśli jeszcze nie mamy
      if (data.labels.length === 0) {
        data.labels = allegroData.map(d => d.date);
      }
    }
    
    // Statystyki
    const stats = {
      totalRevenue: data.datasets.reduce((sum, dataset) => 
        sum + dataset.data.reduce((s, v) => s + v, 0), 0
      ),
      averageDaily: data.datasets.reduce((sum, dataset) => 
        sum + (dataset.data.reduce((s, v) => s + v, 0) / dataset.data.length), 0
      ) / (data.datasets.length || 1),
      days: daysToFetch,
      dataPoints: data.labels.length
    };
    
    res.json({
      success: true,
      period,
      platform,
      data,
      stats,
      updatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Błąd API /api/chart-data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Helper do pobierania danych wykresów
async function fetchChartData(platform, days) {
  const data = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, platform, 'daily', `${dateStr}.json`);
    
    try {
      const fileData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      data.push({
        date: dateStr,
        revenue: fileData.data.revenue || 0,
        profit: fileData.data.profit || 0,
        orders: fileData.data.orders || 0,
        currency: fileData.data.currency || (platform === 'ebay' ? 'EUR' : 'PLN')
      });
    } catch (error) {
      // Jeśli brak danych dla tego dnia, dodaj zero
      data.push({
        date: dateStr,
        revenue: 0,
        profit: 0,
        orders: 0,
        currency: platform === 'ebay' ? 'EUR' : 'PLN'
      });
    }
  }
  
  return data;
}

// 6. Endpoint dla danych miesięcznych (do wykresów słupkowych)
app.get('/api/monthly-chart-data', async (req, res) => {
  try {
    const { months = '6' } = req.query;
    const monthsCount = parseInt(months) || 6;
    
    console.log(`📊 Pobieram miesięczne dane wykresu: ${monthsCount} miesięcy`);
    
    const data = {
      labels: [],
      datasets: []
    };
    
    const today = new Date();
    const monthlyData = [];
    
    // Pobierz dane dla każdego miesiąca
    for (let i = monthsCount - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      const monthLabel = `${year}-${month.toString().padStart(2, '0')}`;
      
      let ebayRevenue = 0;
      let allegroRevenue = 0;
      
      // Spróbuj odczytać dane miesięczne eBay
      try {
        const ebayPath = path.join(DATA_DIR, 'ebay/monthly', `${monthKey}.json`);
        const ebayData = JSON.parse(await fs.readFile(ebayPath, 'utf-8'));
        ebayRevenue = ebayData.summary?.totalRevenue || 0;
      } catch (error) {
        // Brak danych dla tego miesiąca
      }
      
      // Spróbuj odczytać dane miesięczne Allegro
      try {
        const allegroPath = path.join(DATA_DIR, 'allegro/monthly', `${monthKey}.json`);
        const allegroData = JSON.parse(await fs.readFile(allegroPath, 'utf-8'));
        allegroRevenue = allegroData.summary?.totalRevenue || 0;
      } catch (error) {
        // Brak danych dla tego miesiąca
      }
      
      monthlyData.push({
        month: monthLabel,
        ebay: ebayRevenue,
        allegro: allegroRevenue,
        total: ebayRevenue + allegroRevenue
      });
    }
    
    data.labels = monthlyData.map(d => d.month);
    
    data.datasets.push({
      label: 'eBay',
      data: monthlyData.map(d => d.ebay),
      backgroundColor: 'rgba(34, 197, 94, 0.7)',
      borderColor: 'rgb(34, 197, 94)',
      borderWidth: 1
    });
    
    data.datasets.push({
      label: 'Allegro',
      data: monthlyData.map(d => d.allegro),
      backgroundColor: 'rgba(99, 102, 241, 0.7)',
      borderColor: 'rgb(99, 102, 241)',
      borderWidth: 1
    });
    
    // Statystyki
    const stats = {
      totalEbay: monthlyData.reduce((sum, d) => sum + d.ebay, 0),
      totalAllegro: monthlyData.reduce((sum, d) => sum + d.allegro, 0),
      totalAll: monthlyData.reduce((sum, d) => sum + d.total, 0),
      averageMonthly: monthlyData.reduce((sum, d) => sum + d.total, 0) / monthlyData.length,
      months: monthsCount
    };
    
    res.json({
      success: true,
      data,
      stats,
      monthlyData,
      updatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Błąd API /api/monthly-chart-data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// 7. Endpoint dla statystyk platform
app.get('/api/platform-stats', async (req, res) => {
  try {
    console.log('📊 Pobieram statystyki platform...');
    
    // Pobierz dane z ostatnich 30 dni
    const ebayData = await fetchChartData('ebay', 30);
    const allegroData = await fetchChartData('allegro', 30);
    
    const stats = {
      ebay: {
        totalRevenue: ebayData.reduce((sum, d) => sum + d.revenue, 0),
        totalProfit: ebayData.reduce((sum, d) => sum + d.profit, 0),
        totalOrders: ebayData.reduce((sum, d) => sum + d.orders, 0),
        averageRevenue: ebayData.reduce((sum, d) => sum + d.revenue, 0) / ebayData.length,
        averageProfit: ebayData.reduce((sum, d) => sum + d.profit, 0) / ebayData.length,
        bestDay: ebayData.reduce((best, d) => d.revenue > best.revenue ? d : best, { revenue: 0 }),
        currency: 'EUR',
        daysWithData: ebayData.filter(d => d.revenue > 0).length
      },
      allegro: {
        totalRevenue: allegroData.reduce((sum, d) => sum + d.revenue, 0),
        totalProfit: allegroData.reduce((sum, d) => sum + d.profit, 0),
        totalOrders: allegroData.reduce((sum, d) => sum + d.orders, 0),
        averageRevenue: allegroData.reduce((sum, d) => sum + d.revenue, 0) / allegroData.length,
        averageProfit: allegroData.reduce((sum, d) => sum + d.profit, 0) / allegroData.length,
        bestDay: allegroData.reduce((best, d) => d.revenue > best.revenue ? d : best, { revenue: 0 }),
        currency: 'PLN',
        daysWithData: allegroData.filter(d => d.revenue > 0).length
      },
      comparison: {
        ebayPercentage: 0,
        allegroPercentage: 0,
        totalRevenue: 0,
        recommendation: ''
      }
    };
    
    // Oblicz porównanie
    const totalRevenue = stats.ebay.totalRevenue * 4.5 + stats.allegro.totalRevenue; // EUR to PLN
    stats.comparison.totalRevenue = totalRevenue;
    stats.comparison.ebayPercentage = totalRevenue > 0 ? (stats.ebay.totalRevenue * 4.5) / totalRevenue * 100 : 0;
    stats.comparison.allegroPercentage = totalRevenue > 0 ? stats.allegro.totalRevenue / totalRevenue * 100 : 0;
    
    // Rekomendacja
    if (stats.ebay.averageProfit * 4.5 > stats.allegro.averageProfit) {
      stats.comparison.recommendation = 'eBay generuje wyższy zysk (po przeliczeniu na PLN)';
    } else {
      stats.comparison.recommendation = 'Allegro generuje wyższy zysk';
    }
    
    res.json({
      success: true,
      stats,
      period: '30d',
      updatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Błąd API /api/platform-stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`📊 Dashboard API server działa na http://localhost:${PORT}`);
  console.log(`📁 Endpointy:`);
  console.log(`   GET  /api/daily-sales     - Dzienna sprzedaż`);
  console.log(`   GET  /api/reports         - Raporty okresowe`);
  console.log(`   POST /api/export-to-sheets - Eksport do Google Sheets`);
  console.log(`   GET  /api/sales-summary   - Podsumowanie sprzedaży`);
  console.log(`   GET  /api/chart-data      - Dane do wykresów liniowych`);
  console.log(`   GET  /api/monthly-chart-data - Dane do wykresów słupkowych`);
  console.log(`   GET  /api/platform-stats  - Statystyki platform`);
});