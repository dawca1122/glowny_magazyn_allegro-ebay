
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, LogOut, Bell, Search, Plus, Database, CloudOff, TrendingUp, ShoppingBag, FileCheck } from 'lucide-react';
import InventoryTable from './InventoryTable';
import { inventoryService, isConfigured } from './supabaseClient';
import { InventoryItem } from './types';

type View = 'dashboard' | 'magazyn';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('magazyn');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchItems();
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
    } catch (error) {
      showNotification('Błąd podczas dodawania towaru.', 'error');
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-10">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">System Dashboard</h1>
                <p className="text-slate-400 font-medium mt-2">Przegląd kluczowych wskaźników magazynowych.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <StatCard label="Wszystkie Produkty" value={items.length} icon={<Package />} color="indigo" />
                <StatCard label="Estymowany Zysk (Suma)" value={`${totalProfit.toLocaleString()} PLN`} icon={<TrendingUp />} color="emerald" />
                <StatCard label="Oczekujące Dokumenty" value={items.filter(i => i.document_status === 'Oczekuje').length} icon={<FileCheck />} color="amber" />
              </div>

              <div className="mt-12 bg-white p-10 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50">
                 <h2 className="text-xl font-bold mb-6">Ostatnie Aktywności</h2>
                 <p className="text-slate-400 text-sm italic">Moduł analizy danych w przygotowaniu...</p>
              </div>
            </div>
          ) : (
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
                <InventoryTable items={filteredItems} onRefresh={fetchItems} onNotify={showNotification} />
              </div>
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
