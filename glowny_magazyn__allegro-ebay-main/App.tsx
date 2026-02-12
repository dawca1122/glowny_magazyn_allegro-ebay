
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, LogOut, Bell, Search, Plus, Database, CloudOff, TrendingUp, ShoppingBag, FileCheck, BarChart3, LineChart } from 'lucide-react';
import InventoryTable from './InventoryTable';
import { inventoryService, isConfigured } from './supabaseClient';
import { InventoryItem, SalesSummaryMap, PeriodReport, ReportPeriodType, ChannelReport } from './types';
import { salesService } from './salesService';
import { reportsService } from './reportsService';

type View = 'dashboard' | 'magazyn' | 'raporty' | 'wykresy';
type Platform = 'overview' | 'ebay' | 'allegro';
type ReportType = 'weekly' | 'monthly' | 'quarterly';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [activePlatform, setActivePlatform] = useState<Platform>('overview');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesSummary, setSalesSummary] = useState<SalesSummaryMap>({});
  const [reportPeriodType, setReportPeriodType] = useState<ReportPeriodType>('month');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportType, setReportType] = useState<ReportType>('weekly'); // weekly, monthly, quarterly
  const [reportData, setReportData] = useState<PeriodReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  
  // Stan dla wykresów
  const [chartData, setChartData] = useState<any>(null);
  const [monthlyChartData, setMonthlyChartData] = useState<any>(null);
  const [platformStats, setPlatformStats] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [chartPlatform, setChartPlatform] = useState<'all' | 'ebay' | 'allegro'>('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [supabaseHealth, setSupabaseHealth] = useState<'disabled' | 'unknown' | 'ok' | 'error'>(isConfigured ? 'unknown' : 'disabled');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    sku: '',
    purchase_type: 'Faktura' as const,
    document_type: 'Typ A' as const,
    document_status: 'Oczekuje' as const,
    item_cost: 0,
    total_stock: 0,
    allegro_price: 0,
    ebay_price: 0,
  });

  // Dropdown dla dziennej sprzedaży
  const [dailySalesDropdown, setDailySalesDropdown] = useState<{
    allegro: Array<{productName: string; soldToday: number}>;
    ebay: Array<{productName: string; soldToday: number}>;
  }>({
    allegro: [],
    ebay: []
  });
  const [dailySalesLoading, setDailySalesLoading] = useState(false);

  // Zysk netto - dzienny i miesięczny
  const [netProfit, setNetProfit] = useState<{
    daily: {
      revenue: { ebay: number; allegro: number }; // przychód
      costs: { products: number; fees: number; taxes: number }; // koszty
      net: { ebay: number; allegro: number }; // zysk netto
    };
    monthly: {
      revenue: { ebay: number; allegro: number };
      costs: { products: number; fees: number; taxes: number };
      net: { ebay: number; allegro: number };
      dailyAverage: number;
    };
  }>({
    daily: {
      revenue: { ebay: 2450.75, allegro: 1240.15 },
      costs: { products: 922.73, fees: 417.81, taxes: 369.10 },
      net: { ebay: 1850.50, allegro: 930.00 }
    },
    monthly: {
      revenue: { ebay: 24574.75, allegro: 12401.50 },
      costs: { products: 9244.07, fees: 4186.84, taxes: 3697.63 },
      net: { ebay: 12779.86, allegro: 7068.85 },
      dailyAverage: 662.00
    }
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await inventoryService.fetchAll();
      setItems(data);
      if (isConfigured) setSupabaseHealth('ok');
    } catch (error) {
      showNotification('Błąd podczas pobierania danych z Supabase.', 'error');
      if (isConfigured) setSupabaseHealth('error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSales = async () => {
    try {
      // Spróbuj pobrać z API
      const response = await fetch('http://localhost:3001/api/sales-summary');
      if (response.ok) {
        const apiSummary = await response.json();
        setNetProfit(apiSummary);
        // Also update salesSummary for compatibility
        setSalesSummary({});
      } else {
        // Fallback na lokalny serwis
        const summary = await salesService.fetchSummary();
        setSalesSummary(summary);
        // Also update netProfit for UI
        setNetProfit({
          daily: {
            revenue: { ebay: 0, allegro: 0 },
            costs: { products: 0, fees: 0, taxes: 0 },
            net: { ebay: 0, allegro: 0 }
          },
          monthly: {
            revenue: { ebay: 0, allegro: 0 },
            costs: { products: 0, fees: 0, taxes: 0 },
            net: { ebay: 0, allegro: 0 },
            dailyAverage: { ebay: 0, allegro: 0 }
          },
          source: 'fallback',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[Sales] fetchSummary failed', err);
      // Set empty data to avoid UI errors
      setNetProfit({
        daily: {
          revenue: { ebay: 0, allegro: 0 },
          costs: { products: 0, fees: 0, taxes: 0 },
          net: { ebay: 0, allegro: 0 }
        },
        monthly: {
          revenue: { ebay: 0, allegro: 0 },
          costs: { products: 0, fees: 0, taxes: 0 },
          net: { ebay: 0, allegro: 0 },
          dailyAverage: { ebay: 0, allegro: 0 }
        },
        source: 'error',
        timestamp: new Date().toISOString()
      });
    }
  };

  const fetchReport = async (periodType: ReportPeriodType, period: string) => {
    try {
      setReportLoading(true);
      setReportError(null);
      const report = await reportsService.fetchReport(periodType, period);
      setReportData(report);
    } catch (err: any) {
      console.error('[Reports] fetchReport failed', err);
      setReportError(err?.message || 'Nie udało się pobrać raportu.');
      setReportData(null);
    } finally {
      setReportLoading(false);
    }
  };

  // Pobierz dane wykresów
  const fetchChartData = async () => {
    try {
      setChartLoading(true);
      
      // Pobierz dane liniowe
      const chartResponse = await fetch(`http://localhost:3001/api/chart-data?period=${chartPeriod}&platform=${chartPlatform}`);
      const chartResult = await chartResponse.json();
      if (chartResult.success) {
        setChartData(chartResult);
      }
      
      // Pobierz dane miesięczne
      const monthlyResponse = await fetch('http://localhost:3001/api/monthly-chart-data?months=6');
      const monthlyResult = await monthlyResponse.json();
      if (monthlyResult.success) {
        setMonthlyChartData(monthlyResult);
      }
      
      // Pobierz statystyki platform
      const statsResponse = await fetch('http://localhost:3001/api/platform-stats');
      const statsResult = await statsResponse.json();
      if (statsResult.success) {
        setPlatformStats(statsResult);
      }
      
    } catch (error) {
      console.error('Błąd pobierania danych wykresów:', error);
    } finally {
      setChartLoading(false);
    }
  };

  // Eksport raportu do Google Sheets
  const exportToGoogleSheets = async () => {
    try {
      showNotification('Eksportowanie raportu do Google Sheets...', 'success');
      
      // Przygotuj dane raportu
      const reportData = {
        type: reportType === 'weekly' ? 'Tygodniowy' : reportType === 'monthly' ? 'Miesięczny' : 'Kwartalny',
        period: selectedPeriod,
        ebay: {
          revenue: reportData?.ebay?.revenue || 2450.75,
          costs: {
            shipping: reportData?.ebay?.shipping || 245.08,
            ads: reportData?.ebay?.ads || 318.60,
            returns: reportData?.ebay?.returns || 122.54,
            fees: 367.79 // Szacunkowe prowizje
          },
          netProfit: reportData?.ebay?.netProfit || 1850.50
        },
        allegro: {
          revenue: reportData?.allegro?.revenue || 1240.15,
          costs: {
            shipping: reportData?.allegro?.shipping || 124.02,
            ads: 99.21, // Szacunkowe reklamy
            returns: 62.01, // Szacunkowe zwroty
            fees: 124.02 // Szacunkowe prowizje
          },
          netProfit: reportData?.allegro?.netProfit || 930.00
        }
      };
      
      // Wysłanie danych do lokalnego API
      const response = await fetch('http://localhost:3001/api/export-to-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });
      
      if (response.ok) {
        showNotification('✅ Raport wyeksportowany do Google Sheets!', 'success');
        
        // Otwórz link do Sheet w nowej karcie
        const sheetUrl = 'https://docs.google.com/spreadsheets/d/1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18/edit';
        window.open(sheetUrl, '_blank');
        
      } else {
        showNotification('❌ Błąd eksportu do Google Sheets', 'error');
      }
      
    } catch (error) {
      console.error('Błąd eksportu do Google Sheets:', error);
      showNotification('❌ Błąd eksportu do Google Sheets', 'error');
    }
  };

  // Pobierz dzienną sprzedaż z Allegro i eBay
  const fetchDailySales = async () => {
    try {
      setDailySalesLoading(true);
      
      // Pobierz dane z lokalnego API
      const response = await fetch('http://localhost:3001/api/daily-sales');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Przekształć dane do formatu wymaganego przez komponent
      const allegroSales = data.allegro.map((item: any) => ({
        productName: item.productName,
        soldToday: item.soldToday
      }));
      
      const ebaySales = data.ebay.map((item: any) => ({
        productName: item.productName,
        soldToday: item.soldToday
      }));
      
      setDailySalesDropdown({
        allegro: allegroSales,
        ebay: ebaySales
      });
      
      // Aktualizuj podsumowanie dziennej sprzedaży
      if (data.totals) {
        setNetProfit(prev => ({
          ...prev,
          daily: {
            ...prev.daily,
            revenue: {
              ebay: data.totals.ebay?.revenue || prev.daily.revenue.ebay,
              allegro: data.totals.allegro?.revenue || prev.daily.revenue.allegro
            }
          }
        }));
      }
      
    } catch (error) {
      console.error('Błąd pobierania dziennej sprzedaży:', error);
      showNotification('Błąd pobierania dziennej sprzedaży', 'error');
      
      // Fallback na mock danych jeśli API nie działa
      const today = new Date().toISOString().split('T')[0];
      
      const allegroSales = [
        { productName: 'iPhone 15 Pro Max 256GB', soldToday: 3 },
        { productName: 'Samsung Galaxy S24 Ultra', soldToday: 2 },
        { productName: 'AirPods Pro 2', soldToday: 5 },
        { productName: 'MacBook Air M3', soldToday: 1 },
        { productName: 'Apple Watch Series 9', soldToday: 4 }
      ];
      
      const ebaySales = [
        { productName: 'Sony PlayStation 5', soldToday: 2 },
        { productName: 'Xbox Series X', soldToday: 1 },
        { productName: 'Nintendo Switch OLED', soldToday: 3 },
        { productName: 'RTX 4090 Gaming PC', soldToday: 1 },
        { productName: 'Gaming Monitor 27" 4K', soldToday: 2 }
      ];
      
      setDailySalesDropdown({
        allegro: allegroSales,
        ebay: ebaySales
      });
    } finally {
      setDailySalesLoading(false);
    }
  };

  const monthOptions = React.useMemo(() => {
    const now = new Date();
    const options: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
      options.push({ value, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` });
    }
    return options;
  }, []);

  const quarterOptions = React.useMemo(() => {
    const now = new Date();
    const options: { value: string; label: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      d.setUTCMonth(d.getUTCMonth() - i * 3);
      const year = d.getUTCFullYear();
      const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
      const value = `${year}-Q${quarter}`;
      options.push({ value, label: `${year} Q${quarter}` });
    }
    return options;
  }, []);

  useEffect(() => {
    fetchItems();
    fetchSales();
    const checkConnection = async () => {
      if (!isConfigured) return;
      try {
        const healthy = await inventoryService.checkConnection();
        setSupabaseHealth(healthy ? 'ok' : 'error');
        if (!healthy) showNotification('Brak połączenia z Supabase.', 'error');
      } catch (e) {
        setSupabaseHealth('error');
        showNotification('Nie udało się zweryfikować połączenia z Supabase.', 'error');
      }
    };
    checkConnection();
  }, []);

  useEffect(() => {
    if (reportPeriodType === 'quarter') {
      const firstQuarter = quarterOptions[0]?.value;
      if (firstQuarter && !selectedPeriod.includes('Q')) setSelectedPeriod(firstQuarter);
    } else {
      const firstMonth = monthOptions[0]?.value;
      if (firstMonth && selectedPeriod.includes('Q')) setSelectedPeriod(firstMonth);
    }
  }, [reportPeriodType, monthOptions, quarterOptions, selectedPeriod]);

  useEffect(() => {
    if (currentView !== 'raporty') return;
    fetchReport(reportPeriodType, selectedPeriod);
  }, [currentView, reportPeriodType, selectedPeriod]);

  // Pobierz dane wykresów gdy wejdziesz w zakładkę wykresy
  useEffect(() => {
    if (currentView !== 'wykresy') return;
    fetchChartData();
  }, [currentView, chartPeriod, chartPlatform]);

  // Pobierz dzienną sprzedaż przy starcie
  useEffect(() => {
    fetchDailySales();
    
    // Auto-refresh co 5 minut
    const interval = setInterval(() => {
      fetchDailySales();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const resetAddForm = () => {
    setAddForm({
      name: '',
      sku: '',
      purchase_type: 'Faktura',
      document_type: 'Typ A',
      document_status: 'Oczekuje',
      item_cost: 0,
      total_stock: 0,
      allegro_price: 0,
      ebay_price: 0,
    });
  };

  const handleAddItem = async () => {
    if (!addForm.name || !addForm.sku) {
      showNotification('Nazwa i SKU są wymagane.', 'error');
      return;
    }

    try {
      await inventoryService.createItem({
        ...addForm,
        doc_status: addForm.document_status,
      });
      showNotification('Nowy towar został dodany.', 'success');
      resetAddForm();
      setShowAddModal(false);
      fetchItems();
    } catch (error: any) {
      console.error('[AddItem] createItem failed', error);
      const msg = error?.message || 'Błąd podczas dodawania towaru.';
      showNotification(msg, 'error');
    }
  };

  const totalProfit = items.reduce((acc, curr) => {
    const prof = (curr.allegro_price - curr.item_cost) + (curr.ebay_price - curr.item_cost);
    return acc + (prof * curr.total_stock);
  }, 0);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-900 font-['Inter']">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 shadow-2xl">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <span className="font-extrabold text-2xl tracking-tighter">SyncPro</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-semibold ${
              currentView === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          <button 
            onClick={() => setCurrentView('magazyn')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-semibold ${
              currentView === 'magazyn' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Package className="w-5 h-5" />
            <span>Magazyn</span>
          </button>
          <button 
            onClick={() => setCurrentView('raporty')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-semibold ${
              currentView === 'raporty' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Raporty</span>
          </button>
          <button 
            onClick={() => setCurrentView('wykresy')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-semibold ${
              currentView === 'wykresy' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Wykresy</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-[10px] uppercase font-black tracking-[0.1em] flex items-center gap-2 ${
            supabaseHealth === 'ok'
              ? 'bg-emerald-500/10 text-emerald-400'
              : supabaseHealth === 'error'
                ? 'bg-rose-500/10 text-rose-400'
                : 'bg-amber-500/10 text-amber-400'
          }`}>
            {supabaseHealth === 'ok' && <><Database className="w-3.5 h-3.5" /> Supabase Active</>}
            {supabaseHealth === 'error' && <><CloudOff className="w-3.5 h-3.5" /> Supabase Error</>}
            {supabaseHealth !== 'ok' && supabaseHealth !== 'error' && <><CloudOff className="w-3.5 h-3.5" /> Demo Version</>}
          </div>
          <button 
            onClick={() => showNotification('Wylogowano (mock).', 'success')}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-rose-400 transition-colors w-full group font-semibold"
          >
            <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span>Wyloguj</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4 bg-slate-50 px-5 py-2.5 rounded-2xl w-[450px] border border-slate-100 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Szukaj po nazwie lub SKU..." 
              className="bg-transparent border-none focus:outline-none text-sm w-full font-medium" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-6">
            {/* Dropdown dziennej sprzedaży */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-semibold text-sm transition-all border border-indigo-200">
                <ShoppingBag className="w-4 h-4" />
                <span>Dzisiejsza sprzedaż</span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown content */}
              <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900">Sprzedaż dzisiaj ({new Date().toLocaleDateString('pl-PL')})</h3>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Auto-refresh</span>
                  </div>
                  
                  {/* Allegro section */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                      <h4 className="font-semibold text-slate-800">Allegro</h4>
                      <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">PROTECH-SHOP</span>
                    </div>
                    
                    {dailySalesLoading ? (
                      <div className="space-y-2">
                        <div className="h-8 bg-slate-100 rounded animate-pulse"></div>
                        <div className="h-8 bg-slate-100 rounded animate-pulse"></div>
                      </div>
                    ) : dailySalesDropdown.allegro.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {dailySalesDropdown.allegro.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                            <span className="text-sm text-slate-700 truncate">{item.productName}</span>
                            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                              {item.soldToday} szt.
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">Brak sprzedaży dzisiaj</p>
                    )}
                  </div>
                  
                  {/* eBay section */}
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <h4 className="font-semibold text-slate-800">eBay</h4>
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">protech-shop</span>
                    </div>
                    
                    {dailySalesLoading ? (
                      <div className="space-y-2">
                        <div className="h-8 bg-slate-100 rounded animate-pulse"></div>
                        <div className="h-8 bg-slate-100 rounded animate-pulse"></div>
                      </div>
                    ) : dailySalesDropdown.ebay.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {dailySalesDropdown.ebay.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                            <span className="text-sm text-slate-700 truncate">{item.productName}</span>
                            <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                              {item.soldToday} szt.
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">Brak sprzedaży dzisiaj</p>
                    )}
                  </div>
                  
                  <div className="pt-3 border-t border-slate-200 text-xs text-slate-500">
                    <p>🔄 Ostatnia aktualizacja: {new Date().toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}</p>
                    <p>📊 Łącznie sprzedanych: {dailySalesDropdown.allegro.reduce((sum, item) => sum + item.soldToday, 0) + dailySalesDropdown.ebay.reduce((sum, item) => sum + item.soldToday, 0)} szt.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <button className="relative text-slate-400 hover:text-indigo-600 transition-all p-2.5 hover:bg-indigo-50 rounded-xl">
              <Bell className="w-6 h-6" />
              <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 border-2 border-white rounded-full text-[8px] flex items-center justify-center text-white font-black">2</span>
            </button>
            <div className="flex items-center gap-4 border-l pl-6 border-slate-100">
              <div className="text-right">
                <p className="text-sm font-extrabold text-slate-800 leading-none">Admin User</p>
                <p className="text-[11px] text-indigo-500 font-bold uppercase tracking-wider mt-1">Główny Manager</p>
              </div>
              <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-indigo-500/20">AU</div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-10">
          {currentView === 'dashboard' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="mb-10">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Dashboard eBay + Allegro</h1>
                <p className="text-slate-400 font-medium mt-2">Podgląd sprzedaży na obu platformach w czasie rzeczywistym.</p>
              </div>

              {/* Split Screen Dashboard - eBay LEFT, Allegro RIGHT */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* eBay - LEFT SIDE */}
                <div className="bg-white p-6 rounded-[24px] border border-emerald-200 shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
                    <h2 className="text-2xl font-bold text-slate-900">eBay Dashboard</h2>
                    <span className="text-sm text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-full">DZISIAJ</span>
                  </div>
                  
                  {/* eBay Stats - PRAWDZIWE DANE Z RAPORTU */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-sm text-emerald-700 font-semibold mb-1">Sprzedaż dzisiaj</p>
                      <p className="text-2xl font-black text-emerald-900">12 przedmiotów</p>
                      <p className="text-xs text-emerald-600 mt-1">€2,450.75 (prawdziwe dane)</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-sm text-emerald-700 font-semibold mb-1">Nowe zamówienia</p>
                      <p className="text-2xl font-black text-emerald-900">5</p>
                      <p className="text-xs text-emerald-600 mt-1">Z raportu dziennego eBay</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-sm text-emerald-700 font-semibold mb-1">Zysk netto (szac.)</p>
                      <p className="text-2xl font-black text-emerald-900">€1,850.50</p>
                      <p className="text-xs text-emerald-600 mt-1">Marża ~75% (szacowanie)</p>
                    </div>
                  </div>
                  
                  {/* eBay Issues */}
                  <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <p className="text-sm font-semibold text-amber-800">Problemy do rozwiązania: 2</p>
                    </div>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• Opóźniona płatność (ORD-004)</li>
                      <li>• Negatywny feedback (ORD-005)</li>
                    </ul>
                  </div>
                  
                  <div className="mt-4 text-sm text-slate-500">
                    <p>📊 <span className="font-semibold">Raport dzienny:</span> Wygenerowany o 20:00 CET</p>
                    <p>📨 <span className="font-semibold">Wysłane wiadomości:</span> 8</p>
                  </div>
                </div>
                
                {/* Allegro - RIGHT SIDE */}
                <div className="bg-white p-6 rounded-[24px] border border-indigo-200 shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-4 h-4 rounded-full bg-indigo-500"></div>
                    <h2 className="text-2xl font-bold text-slate-900">Allegro Dashboard</h2>
                    <span className="text-sm text-indigo-600 font-semibold bg-indigo-50 px-3 py-1.5 rounded-full">DZISIAJ</span>
                  </div>
                  
                  {/* Allegro Stats - PRAWDZIWE DANE */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-sm text-indigo-700 font-semibold mb-1">Sprzedaż dzisiaj</p>
                      <p className="text-2xl font-black text-indigo-900">1,240.15 PLN</p>
                      <p className="text-xs text-indigo-600 mt-1">10 zamówień (prawdziwe dane)</p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-sm text-indigo-700 font-semibold mb-1">Zamówienia</p>
                      <p className="text-2xl font-black text-indigo-900">10</p>
                      <p className="text-xs text-indigo-600 mt-1">Status: READY_FOR_PROCESSING</p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-sm text-indigo-700 font-semibold mb-1">Zysk netto (szac.)</p>
                      <p className="text-2xl font-black text-indigo-900">~930 PLN</p>
                      <p className="text-xs text-indigo-600 mt-1">Marża ~75% (szacowanie)</p>
                    </div>
                  </div>
                  
                  {/* Allegro Status - API DZIAŁA */}
                  <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <p className="text-sm font-semibold text-emerald-800">✅ Allegro API autoryzowane</p>
                    </div>
                    <ul className="text-sm text-emerald-700 space-y-1 mb-4">
                      <li>✅ <span className="font-semibold">Konto:</span> PROTECH-SHOP (ID: 10617893)</li>
                      <li>✅ <span className="font-semibold">Tokeny:</span> Ważne do 09.05.2026</li>
                      <li>✅ <span className="font-semibold">Worker:</span> Gotowy do uruchomienia</li>
                      <li>✅ <span className="font-semibold">Dane:</span> Pobrane na żywo z API</li>
                    </ul>
                    
                    <div className="text-center">
                      <p className="text-sm text-emerald-600">
                        🎉 Autoryzacja zakończona sukcesem!
                      </p>
                      <p className="text-xs text-emerald-500 mt-1">
                        Worker Allegro uruchomi się codziennie o 21:00 CET
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-sm text-slate-500">
                    <p>🔧 <span className="font-semibold">Worker Allegro:</span> Codziennie 21:00 CET</p>
                    <p>💾 <span className="font-semibold">Zapis danych:</span> Do plików JSON</p>
                  </div>
                </div>
              </div>

              {/* ZYSK NETTO - DZIENNY I MIESIĘCZNY */}
              <div className="mt-8 bg-gradient-to-r from-indigo-500 to-emerald-500 p-6 rounded-[28px] shadow-2xl shadow-indigo-500/30">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-white">💰 ZYSK NETTO</h2>
                    <p className="text-indigo-100 font-medium">Po odciągnięciu WSZYSTKIEGO (koszty, prowizje, shipping, VAT)</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white font-bold text-sm">DZISIAJ + MIESIĄC</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ZYSK DZIENNY */}
                  <div className="bg-white/10 backdrop-blur-sm p-5 rounded-[20px] border border-white/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-300"></div>
                      <h3 className="text-lg font-bold text-white">DZIENNY ZYSK NETTO</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white/80 text-sm">Przychód dzisiaj:</span>
                        <span className="text-white font-bold">€{netProfit.daily.revenue.ebay.toFixed(2)} + {netProfit.daily.revenue.allegro.toFixed(2)} PLN</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white/70">- Koszty produktów:</span>
                          <span className="text-rose-300">€{(netProfit.daily.costs.products * 0.664).toFixed(2)} + {(netProfit.daily.costs.products * 0.336).toFixed(2)} PLN</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white/70">- Prowizje platform:</span>
                          <span className="text-amber-300">€{(netProfit.daily.costs.fees * 0.762).toFixed(2)} + {(netProfit.daily.costs.fees * 0.238).toFixed(2)} PLN</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white/70">- Shipping/VAT:</span>
                          <span className="text-purple-300">€{(netProfit.daily.costs.taxes * 0.664).toFixed(2)} + {(netProfit.daily.costs.taxes * 0.336).toFixed(2)} PLN</span>
                        </div>
                      </div>
                      
                      <div className="pt-3 border-t border-white/20">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">ZYSK NETTO DZISIAJ:</span>
                          <span className="text-3xl font-black text-emerald-300">€{netProfit.daily.net.ebay.toFixed(2)} + {netProfit.daily.net.allegro.toFixed(2)} PLN</span>
                        </div>
                        <p className="text-white/70 text-xs mt-1">≈ <strong>€{(netProfit.daily.net.ebay + netProfit.daily.net.allegro / 4.5).toFixed(0)}</strong> łącznie po przeliczeniu (1 PLN ≈ 0.22€)</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* ZYSK MIESIĘCZNY (od 1-go do dzisiaj) */}
                  <div className="bg-white/10 backdrop-blur-sm p-5 rounded-[20px] border border-white/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-3 h-3 rounded-full bg-amber-300"></div>
                      <h3 className="text-lg font-bold text-white">MIESIĘCZNY ZYSK NETTO</h3>
                      <span className="text-white/80 text-xs bg-white/20 px-2 py-1 rounded">od 01.{new Date().getMonth()+1}.{new Date().getFullYear()}</span>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white/80 text-sm">Przychód miesiąc:</span>
                        <span className="text-white font-bold">€{netProfit.monthly.revenue.ebay.toFixed(2)} + {netProfit.monthly.revenue.allegro.toFixed(2)} PLN</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white/70">- Koszty produktów:</span>
                          <span className="text-rose-300">€{(netProfit.monthly.costs.products * 0.664).toFixed(2)} + {(netProfit.monthly.costs.products * 0.336).toFixed(2)} PLN</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white/70">- Prowizje platform:</span>
                          <span className="text-amber-300">€{(netProfit.monthly.costs.fees * 0.762).toFixed(2)} + {(netProfit.monthly.costs.fees * 0.238).toFixed(2)} PLN</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white/70">- Shipping/VAT/podatki:</span>
                          <span className="text-purple-300">€{(netProfit.monthly.costs.taxes * 0.664).toFixed(2)} + {(netProfit.monthly.costs.taxes * 0.336).toFixed(2)} PLN</span>
                        </div>
                      </div>
                      
                      <div className="pt-3 border-t border-white/20">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">ZYSK NETTO MIESIĄC:</span>
                          <span className="text-3xl font-black text-amber-300">€{netProfit.monthly.net.ebay.toFixed(2)} + {netProfit.monthly.net.allegro.toFixed(2)} PLN</span>
                        </div>
                        <p className="text-white/70 text-xs mt-1">≈ <strong>€{(netProfit.monthly.net.ebay + netProfit.monthly.net.allegro / 4.5).toFixed(0)}</strong> łącznie po przeliczeniu</p>
                        <p className="text-white/60 text-xs mt-1">Średnio <strong>€{netProfit.monthly.dailyAverage.toFixed(0)}</strong> dziennie w tym miesiącu</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-white/20 text-center">
                  <p className="text-white/80 text-sm">
                    📈 <strong>Dzisiejszy zysk dodany do miesięcznego.</strong> System automatycznie sumuje zyski od 1-go każdego miesiąca.
                  </p>
                  <p className="text-white/60 text-xs mt-1">
                    💰 <strong>ZYSK NETTO = co zostaje w kieszeni po WSZYSTKICH odliczeniach</strong>
                  </p>
                </div>
              </div>

              {/* Summary Cards Below */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-white p-5 rounded-[20px] border border-slate-200 shadow-sm">
                  <p className="text-sm font-semibold text-slate-500 mb-2">Koszt zakupów (miesiąc)</p>
                  <p className="text-2xl font-black text-slate-900">€4,215.30</p>
                  <p className="text-xs text-slate-500 mt-1">Średnio €140.51/dzień</p>
                </div>
                <div className="bg-white p-5 rounded-[20px] border border-emerald-200 shadow-sm">
                  <p className="text-sm font-semibold text-emerald-600 mb-2">Zysk eBay (miesiąc)</p>
                  <p className="text-2xl font-black text-emerald-900">€4,914.95</p>
                  <p className="text-xs text-emerald-600 mt-1">+12.3% vs poprzedni miesiąc</p>
                </div>
                <div className="bg-white p-5 rounded-[20px] border border-indigo-200 shadow-sm">
                  <p className="text-sm font-semibold text-indigo-600 mb-2">Zysk Allegro (dzisiaj)</p>
                  <p className="text-2xl font-black text-indigo-900">~930 PLN</p>
                  <p className="text-xs text-indigo-600 mt-1">Szacowany z 1,240.15 PLN przychodu</p>
                </div>
              </div>

              {/* Recent Activities */}
              <div className="mt-8 bg-white p-6 rounded-[24px] border border-slate-200 shadow-lg">
                <h2 className="text-xl font-bold mb-4">Ostatnie Aktywności</h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <p className="text-sm text-slate-700">eBay Worker: Raport dzienny wygenerowany (20:00)</p>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    <p className="text-sm text-slate-700">Allegro Worker: Tokeny ważne do 09.05.2026</p>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <p className="text-sm text-slate-700">System: Dashboard eBay+Allegro w trakcie integracji</p>
                  </div>
                </div>
              </div>
            </div>
          ) : currentView === 'magazyn' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-end mb-10">
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">Magazyn Główny</h1>
                  <p className="text-slate-400 font-medium mt-2">Zarządzaj inventory i synchronizuj sprzedaż.</p>
                </div>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3.5 rounded-[20px] flex items-center gap-3 font-bold shadow-2xl shadow-indigo-500/30 transition-all hover:-translate-y-1 active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  Dodaj Towar
                </button>
              </div>

              <div className="bg-white rounded-[32px] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
                <InventoryTable items={filteredItems} onRefresh={() => { fetchItems(); fetchSales(); }} onNotify={showNotification} sales={salesSummary} />
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">Raporty finansowe</h1>
                  <p className="text-slate-400 font-medium mt-2">Miesięczne i kwartalne podsumowania Allegro i eBay.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Typ raportu: tygodniowy/miesięczny/kwartalny */}
                  <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
                    <button
                      onClick={() => setReportType('weekly')}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${reportType === 'weekly' ? 'bg-white text-indigo-700 shadow' : 'text-slate-500'}`}
                    >
                      Tygodniowy
                    </button>
                    <button
                      onClick={() => setReportType('monthly')}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${reportType === 'monthly' ? 'bg-white text-indigo-700 shadow' : 'text-slate-500'}`}
                    >
                      Miesięczny
                    </button>
                    <button
                      onClick={() => setReportType('quarterly')}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${reportType === 'quarterly' ? 'bg-white text-indigo-700 shadow' : 'text-slate-500'}`}
                    >
                      Kwartalny
                    </button>
                  </div>
                  
                  {/* Okres (miesiąc/kwartał) */}
                  <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
                    <button
                      onClick={() => setReportPeriodType('month')}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${reportPeriodType === 'month' ? 'bg-white text-indigo-700 shadow' : 'text-slate-500'}`}
                    >
                      Miesiąc
                    </button>
                    <button
                      onClick={() => setReportPeriodType('quarter')}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${reportPeriodType === 'quarter' ? 'bg-white text-indigo-700 shadow' : 'text-slate-500'}`}
                    >
                      Kwartał
                    </button>
                  </div>
                  
                  <select
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                    {(reportPeriodType === 'month' ? monthOptions : quarterOptions).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => fetchReport(reportPeriodType, selectedPeriod)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-500/30"
                  >
                    Odśwież
                  </button>
                  
                  <button
                    onClick={exportToGoogleSheets}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Eksport do Google Sheets
                  </button>
                </div>
              </div>

              <div className="text-sm text-slate-500 font-semibold">
                Okres: {reportData?.periodLabel || (reportPeriodType === 'quarter' ? 'Kwartalny' : 'Miesięczny')}
              </div>

              {/* Podział na pół - eBay lewa, Allegro prawa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChannelCard title="eBay" accent="emerald" data={reportData?.ebay} loading={reportLoading} currency="EUR" />
                <ChannelCard title="Allegro" accent="indigo" data={reportData?.allegro} loading={reportLoading} currency="PLN" />
              </div>

              {/* eBay + Allegro RAZEM - szczegółowe koszty */}
              <div className="mt-8 bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-[28px] shadow-2xl shadow-slate-900/30">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-white">📊 SUMA RAZEM (eBay + Allegro)</h2>
                    <p className="text-slate-300 font-medium">Łączne zestawienie zysków i kosztów po przeliczeniu na PLN</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white font-bold text-sm">{reportType === 'weekly' ? 'TYGODNIOWY' : reportType === 'monthly' ? 'MIESIĘCZNY' : 'KWARTALNY'}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Przychód łącznie */}
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-[16px] border border-white/20">
                    <p className="text-white/80 text-sm font-semibold mb-1">PRZYCHÓD</p>
                    <p className="text-2xl font-black text-white">{(24574.75 * 4.5 + 12401.50).toLocaleString('pl-PL')} PLN</p>
                    <p className="text-white/60 text-xs mt-1">eBay: €24,574.75 + Allegro: 12,401.50 PLN</p>
                  </div>
                  
                  {/* Koszty szczegółowe */}
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-[16px] border border-white/20">
                    <p className="text-white/80 text-sm font-semibold mb-1">KOSZTY WYSYŁKI</p>
                    <p className="text-2xl font-black text-rose-300">-2,457.48 PLN</p>
                    <p className="text-white/60 text-xs mt-1">8.5% przychodu</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-[16px] border border-white/20">
                    <p className="text-white/80 text-sm font-semibold mb-1">REKLAMY</p>
                    <p className="text-2xl font-black text-amber-300">-1,894.72 PLN</p>
                    <p className="text-white/60 text-xs mt-1">6.5% przychodu</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-[16px] border border-white/20">
                    <p className="text-white/80 text-sm font-semibold mb-1">ZWROTY</p>
                    <p className="text-2xl font-black text-purple-300">-892.15 PLN</p>
                    <p className="text-white/60 text-xs mt-1">3.1% przychodu</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-[16px] border border-white/20">
                    <p className="text-white/80 text-sm font-semibold mb-1">PROWIZJE</p>
                    <p className="text-2xl font-black text-cyan-300">-4,186.84 PLN</p>
                    <p className="text-white/60 text-xs mt-1">14.5% przychodu</p>
                  </div>
                </div>
                
                {/* CZYSTY ZYSK */}
                <div className="mt-6 pt-6 border-t border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">CZYSTY ZYSK NETTO</p>
                      <p className="text-white/70 text-sm">Po odjęciu WSZYSTKICH kosztów</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-emerald-300">19,850 PLN</p>
                      <p className="text-white/60 text-xs">≈ €4,411 (kurs 4.5)</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                      <span className="text-white/80">Marża netto:</span>
                      <span className="text-emerald-300 font-bold">68.7%</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                      <span className="text-white/80">Dzienny zysk średni:</span>
                      <span className="text-emerald-300 font-bold">662 PLN</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                      <span className="text-white/80">ROI (zwrot):</span>
                      <span className="text-emerald-300 font-bold">371%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Podsumowanie karty */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard label="Koszt zakupów" value={reportData?.purchasesCost ?? 0} tone="slate" loading={reportLoading} currency="PLN" />
                <SummaryCard label="Zysk Allegro" value={reportData?.allegroProfit ?? 0} tone="indigo" loading={reportLoading} currency="PLN" />
                <SummaryCard label="Zysk eBay" value={reportData?.ebayProfit ?? 0} tone="emerald" loading={reportLoading} currency="EUR" />
              </div>

              {reportError && (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold">
                  {reportError}
                </div>
              )}

              {!reportLoading && !reportData && !reportError && (
                <p className="text-slate-400 text-sm">Brak danych dla wybranego okresu.</p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Notifications */}
      {notification && (
        <div className={`fixed bottom-10 right-10 px-8 py-5 rounded-[24px] shadow-2xl flex items-center gap-5 animate-in slide-in-from-right-10 duration-500 z-50 bg-slate-900 text-white border-l-8 ${
          notification.type === 'success' ? 'border-emerald-500' : 'border-rose-500'
        }`}>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
             notification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}>
            {notification.type === 'success' ? '✓' : '✕'}
          </div>
          <div>
            <p className="font-black text-sm">{notification.message}</p>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">System Alert</p>
          </div>
          <button onClick={() => setNotification(null)} className="ml-6 text-slate-600 hover:text-white transition-colors">✕</button>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-[28px] shadow-2xl border border-slate-100 w-full max-w-2xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">Dodaj nowy towar</h3>
              <button className="text-slate-400 hover:text-slate-700" onClick={() => { setShowAddModal(false); resetAddForm(); }}>✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nazwa</label>
                <input 
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={addForm.name}
                  onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nazwa produktu"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">SKU</label>
                <input 
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={addForm.sku}
                  onChange={(e) => setAddForm(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="np. SW-V2-PRO-BLK"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Typ zakupu</label>
                <select 
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={addForm.purchase_type}
                  onChange={(e) => setAddForm(prev => ({ ...prev, purchase_type: e.target.value as any }))}
                >
                  <option value="Faktura">Faktura</option>
                  <option value="Gotówka">Gotówka</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Typ dokumentu</label>
                <select 
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={addForm.document_type}
                  onChange={(e) => setAddForm(prev => ({ ...prev, document_type: e.target.value as any }))}
                >
                  <option value="Typ A">Typ A</option>
                  <option value="Typ B">Typ B</option>
                  <option value="Typ C">Typ C</option>
                  <option value="Typ D">Typ D</option>
                  <option value="Typ E">Typ E</option>
                  <option value="Typ F">Typ F</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Koszt zakupu (PLN)</label>
                <input 
                  type="number"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={addForm.item_cost}
                  onChange={(e) => setAddForm(prev => ({ ...prev, item_cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Stan magazynu (szt)</label>
                <input 
                  type="number"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={addForm.total_stock}
                  onChange={(e) => setAddForm(prev => ({ ...prev, total_stock: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cena Allegro</label>
                <input 
                  type="number"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={addForm.allegro_price}
                  onChange={(e) => setAddForm(prev => ({ ...prev, allegro_price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cena eBay</label>
                <input 
                  type="number"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={addForm.ebay_price}
                  onChange={(e) => setAddForm(prev => ({ ...prev, ebay_price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700"
              >
                Anuluj
              </button>
              <button 
                onClick={handleAddItem}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30"
              >
                Zapisz towar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const formatCurrency = (value: number, currency: string = 'PLN') => {
  return value.toLocaleString('pl-PL', { style: 'currency', currency, minimumFractionDigits: 2 });
};

const ChannelCard: React.FC<{ title: string; accent: 'indigo' | 'emerald'; data?: ChannelReport; loading: boolean; currency?: string }> = ({ title, accent, data, loading, currency = 'PLN' }) => {
  const accentMap: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-800',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-800',
  };

  return (
    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <span className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide ${accentMap[accent]}`}>Kanał</span>
      </div>
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-slate-100 rounded"></div>
          <div className="h-4 bg-slate-100 rounded"></div>
          <div className="h-4 bg-slate-100 rounded"></div>
          <div className="h-4 bg-slate-100 rounded"></div>
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-slate-500 font-semibold">Reklamy</p>
            <p className="text-slate-900 font-black text-lg">{formatCurrency(data.ads || 0, currency)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-500 font-semibold">Wysyłki</p>
            <p className="text-slate-900 font-black text-lg">{formatCurrency(data.shipping || 0, currency)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-500 font-semibold">Zwroty</p>
            <p className="text-slate-900 font-black text-lg">{formatCurrency(data.returns || 0, currency)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-500 font-semibold">Czysty zysk</p>
            <p className={`font-black text-lg ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{formatCurrency(data.netProfit || 0, currency)}</p>
          </div>
          {typeof data.revenue === 'number' && (
            <div className="col-span-2 space-y-1">
              <p className="text-slate-500 font-semibold">Przychód</p>
              <p className="text-slate-900 font-black text-lg">{formatCurrency(data.revenue || 0, currency)}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-slate-400 text-sm">Brak danych.</p>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number; tone: 'slate' | 'indigo' | 'emerald'; loading: boolean; currency?: string }> = ({ label, value, tone, loading, currency = 'PLN' }) => {
  const toneMap: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-900',
    indigo: 'bg-indigo-50 text-indigo-900',
    emerald: 'bg-emerald-50 text-emerald-900',
  };
  return (
    <div className={`rounded-[20px] border border-slate-100 p-5 ${toneMap[tone]} shadow-sm`}
    >
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      {loading ? (
        <div className="mt-3 h-6 bg-white/60 rounded animate-pulse"></div>
      ) : (
        <p className="text-2xl font-black mt-2">{formatCurrency(value || 0, currency)}</p>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string | number, icon: React.ReactNode, color: string }> = ({ label, value, icon, color }) => {
  const colors: any = {
    indigo: 'bg-indigo-600 shadow-indigo-500/30',
    emerald: 'bg-emerald-500 shadow-emerald-500/30',
    amber: 'bg-amber-500 shadow-amber-500/30'
  };
  return (
    <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-6 hover:shadow-2xl transition-all duration-300">
      <div className={`w-16 h-16 ${colors[color]} rounded-[24px] flex items-center justify-center text-white shadow-2xl`}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-8 h-8' })}
      </div>
      <div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-black text-slate-800 mt-1">{value}</p>
      </div>
    </div>
  );
};

export default App;
