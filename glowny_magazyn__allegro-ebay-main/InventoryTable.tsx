
import React, { useState } from 'react';
import { Send, CheckCircle, Clock, RefreshCw, Package, FileDown, Save } from 'lucide-react';
import { DocumentStatus, InventoryItem, SyncPayload } from './types';
import { inventoryService } from './supabaseClient';

interface Props {
  items: InventoryItem[];
  onRefresh: () => void;
  onNotify: (msg: string, type: 'success' | 'error') => void;
}

const getEnvVar = (name: string): string => {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[name]) return metaEnv[name];
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name] as string;
  } catch {}
  return '';
};

const SYNC_TOKEN = getEnvVar('VITE_SYNC_TOKEN');
const API_ENDPOINT = getEnvVar('VITE_API_ENDPOINT');

const InventoryTable: React.FC<Props> = ({ items, onRefresh, onNotify }) => {
  const [syncingSku, setSyncingSku] = useState<string | null>(null);
  const [updatingSku, setUpdatingSku] = useState<string | null>(null);
  const [stockInputs, setStockInputs] = useState<Record<string, { allegro: number; ebay: number }>>({});
  const [docStatusOverrides, setDocStatusOverrides] = useState<Record<string, DocumentStatus>>({});
  
  // itemEdits przechowuje wszystkie tymczasowe zmiany w wierszu przed zapisem
  const [itemEdits, setItemEdits] = useState<Record<string, Partial<Record<keyof InventoryItem, string>>>>({});

  const handleInputChange = (sku: string, platform: 'allegro' | 'ebay', value: string) => {
    const numValue = parseInt(value) || 0;
    setStockInputs(prev => ({
      ...prev,
      [sku]: {
        ...prev[sku] || { allegro: 0, ebay: 0 },
        [platform]: numValue
      }
    }));
  };

  const handleRowEdit = (sku: string, field: keyof InventoryItem, value: string) => {
    setItemEdits(prev => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        [field]: value
      }
    }));
  };

  const saveRowChanges = async (item: InventoryItem) => {
    const edits = itemEdits[item.sku];
    if (!edits) return;

    setUpdatingSku(item.sku);
    try {
      const updates: Partial<InventoryItem> = {};
      if (edits.allegro_price !== undefined) updates.allegro_price = parseFloat(edits.allegro_price);
      if (edits.ebay_price !== undefined) updates.ebay_price = parseFloat(edits.ebay_price);
      if (edits.item_cost !== undefined) updates.item_cost = parseFloat(edits.item_cost);
      if (edits.total_stock !== undefined) updates.total_stock = parseInt(edits.total_stock);

      await inventoryService.updateItem(item.sku, updates);
      onNotify(`Dane dla SKU: ${item.sku} zostały pomyślnie zaktualizowane.`, 'success');
      
      // Wyczyść stan edycji dla tego wiersza
      setItemEdits(prev => {
        const next = { ...prev };
        delete next[item.sku];
        return next;
      });
      
      onRefresh();
    } catch (err) {
      onNotify('Błąd podczas zapisywania zmian w bazie.', 'error');
    } finally {
      setUpdatingSku(null);
    }
  };

  const handleDocumentAction = async (item: InventoryItem) => {
    const currentStatus: DocumentStatus = docStatusOverrides[item.sku] || item.document_status;
    if (currentStatus !== 'Oczekuje') return;

    try {
      await inventoryService.updateItem(item.sku, { document_status: 'Pobrano', doc_status: 'Pobrano' as any });
      setDocStatusOverrides(prev => ({ ...prev, [item.sku]: 'Pobrano' }));
      onNotify(`Dokument dla SKU: ${item.sku} został pobrany. Status zaktualizowany.`, 'success');
      onRefresh();
    } catch (err) {
      onNotify('Błąd aktualizacji dokumentu w Supabase.', 'error');
    }
  };

  const handleSendAllegro = async (item: InventoryItem) => {
    const amount = stockInputs[item.sku]?.allegro || 0;

    if (amount <= 0) {
      onNotify('Wprowadź ilość towaru do wysłania.', 'error');
      return;
    }

    if (amount > item.total_stock) {
      onNotify('Brak wystarczającej ilości towaru w magazynie!', 'error');
      return;
    }

    if (!API_ENDPOINT) {
      console.error('[Sync] Missing VITE_API_ENDPOINT environment variable.');
      onNotify('Brak skonfigurowanego endpointu API dla synchronizacji.', 'error');
      return;
    }

    if (!SYNC_TOKEN) {
      console.error('[Sync] Missing VITE_SYNC_TOKEN environment variable.');
      onNotify('Brak tokenu synchronizacji.', 'error');
      return;
    }

    setSyncingSku(item.sku);
    try {
      const payload: SyncPayload = {
        items: [{ sku: item.sku, stock_warehouse: amount }]
      };

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-token': SYNC_TOKEN
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${errorText}`);
      }

      const newStock = Math.max(0, item.total_stock - amount);
      await inventoryService.updateItem(item.sku, { total_stock: newStock });
      onNotify(`Synchronizacja Allegro zakończona. Stan SKU: ${item.sku} zmniejszony o ${amount}.`, 'success');
      
      setStockInputs(prev => {
        const next = { ...prev };
        if (next[item.sku]) next[item.sku].allegro = 0;
        return next;
      });
      onRefresh();
    } catch (err) {
      onNotify('Błąd synchronizacji z API Allegro.', 'error');
    } finally {
      setSyncingSku(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[1300px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Produkt / SKU</th>
            <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Zakup / Dok.</th>
            <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status Dok.</th>
            <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Koszt Zakupu</th>
            <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Stan Magazynu</th>
            <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Allegro (Sync)</th>
            <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">eBay (Sync)</th>
            <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ceny & Zyski</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const rowEdit = itemEdits[item.sku] || {};
            const effectiveDocumentStatus = docStatusOverrides[item.sku] || item.document_status;
            
            // Wartości do obliczeń z uwzględnieniem edycji w czasie rzeczywistym
            const effectiveCost = rowEdit.item_cost !== undefined ? parseFloat(rowEdit.item_cost) || 0 : item.item_cost;
            const effectiveStock = rowEdit.total_stock !== undefined ? parseInt(rowEdit.total_stock) || 0 : item.total_stock;
            const effectiveAllegroPrice = rowEdit.allegro_price !== undefined ? parseFloat(rowEdit.allegro_price) || 0 : item.allegro_price;
            const effectiveEbayPrice = rowEdit.ebay_price !== undefined ? parseFloat(rowEdit.ebay_price) || 0 : item.ebay_price;
            
            const allegroProfit = effectiveAllegroPrice - effectiveCost;
            const ebayProfit = effectiveEbayPrice - effectiveCost;
            const totalUnitProfit = allegroProfit + ebayProfit;
            
            const isSyncing = syncingSku === item.sku;
            const isUpdating = updatingSku === item.sku;
            const hasChanges = Object.keys(rowEdit).length > 0;

            return (
              <tr key={item.sku} className="hover:bg-indigo-50/30 transition-all duration-300 group">
                <td className="px-6 py-6">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-slate-800 text-sm line-clamp-1">{item.name}</span>
                    <span className="text-[9px] text-indigo-500 font-black tracking-widest bg-indigo-50 w-fit px-2 py-1 rounded-md uppercase border border-indigo-100">{item.sku}</span>
                  </div>
                </td>

                <td className="px-6 py-6">
                  <div className="flex flex-col gap-1">
                    <select 
                      defaultValue={item.purchase_type}
                      onChange={(e) => inventoryService.updateItem(item.sku, { purchase_type: e.target.value as any })}
                      className="text-xs bg-transparent border-none p-0 focus:ring-0 text-slate-700 font-bold cursor-pointer hover:text-indigo-600 transition-colors"
                    >
                      <option value="Faktura">Faktura</option>
                      <option value="Gotówka">Gotówka</option>
                    </select>
                    <button 
                      onClick={() => handleDocumentAction(item)}
                      className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-indigo-600 transition-all font-medium"
                    >
                      <FileDown className="w-3 h-3" />
                      {item.document_type}
                    </button>
                  </div>
                </td>

                <td className="px-6 py-6">
                  <div className="flex items-center">
                    {effectiveDocumentStatus === 'Pobrano' ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 uppercase tracking-wider shadow-sm shadow-emerald-200/50">
                        <CheckCircle className="w-3 h-3" /> Pobrany
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDocumentAction(item)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 uppercase tracking-wider shadow-sm shadow-amber-200/50 hover:bg-amber-200 transition-colors"
                      >
                        <Clock className="w-3 h-3" /> Oczekuje
                      </button>
                    )}
                  </div>
                </td>

                {/* Kolumna Koszt Zakupu */}
                <td className="px-6 py-6 text-right">
                  <div className="flex justify-end items-center gap-1.5">
                    <input 
                      type="number"
                      step="0.01"
                      value={rowEdit.item_cost ?? item.item_cost}
                      onChange={(e) => handleRowEdit(item.sku, 'item_cost', e.target.value)}
                      className={`w-24 px-2 py-1.5 text-right text-sm font-black rounded-xl border focus:outline-none transition-all ${
                        rowEdit.item_cost !== undefined ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-slate-50/50'
                      }`}
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">PLN</span>
                  </div>
                </td>

                {/* Kolumna Stan Magazynu */}
                <td className="px-6 py-6 text-right">
                  <div className="flex justify-end items-center gap-1.5">
                    <input 
                      type="number"
                      value={rowEdit.total_stock ?? item.total_stock}
                      onChange={(e) => handleRowEdit(item.sku, 'total_stock', e.target.value)}
                      className={`w-20 px-2 py-1.5 text-right text-sm font-black rounded-xl border focus:outline-none transition-all ${
                        rowEdit.total_stock !== undefined ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-slate-50/50'
                      } ${effectiveStock < 5 ? 'text-rose-500' : 'text-slate-800'}`}
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">szt</span>
                  </div>
                </td>

                <td className="px-6 py-6">
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      placeholder="0"
                      min="0"
                      value={stockInputs[item.sku]?.allegro || ''}
                      onChange={(e) => handleInputChange(item.sku, 'allegro', e.target.value)}
                      className="w-16 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-400 focus:outline-none font-bold transition-all"
                    />
                    <button 
                      onClick={() => handleSendAllegro(item)}
                      disabled={isSyncing}
                      className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                        isSyncing ? 'bg-slate-100 text-slate-400 animate-pulse' : 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/30 active:scale-95'
                      }`}
                    >
                      {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </td>

                <td className="px-6 py-6">
                  <div className="flex items-center gap-3 opacity-30 group-hover:opacity-100 transition-all duration-500">
                    <input 
                      type="number" 
                      placeholder="0"
                      className="w-16 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none font-bold bg-slate-50 cursor-not-allowed"
                      disabled
                    />
                    <button className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md cursor-not-allowed opacity-50">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </td>

                <td className="px-6 py-6 text-right">
                  <div className="flex flex-col gap-2">
                    {/* Allegro Price Entry */}
                    <div className="flex justify-end items-center gap-2">
                      <span className="text-[9px] text-slate-400 font-black uppercase">Allegro:</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={rowEdit.allegro_price ?? item.allegro_price}
                        onChange={(e) => handleRowEdit(item.sku, 'allegro_price', e.target.value)}
                        className={`w-20 px-2 py-1 text-xs font-bold text-right border rounded-lg focus:outline-none transition-all ${
                          rowEdit.allegro_price !== undefined ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-slate-50/50'
                        }`}
                      />
                      <span className={`text-[10px] font-bold w-12 ${allegroProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {allegroProfit >= 0 ? '+' : ''}{allegroProfit.toFixed(1)}
                      </span>
                    </div>

                    {/* eBay Price Entry */}
                    <div className="flex justify-end items-center gap-2">
                      <span className="text-[9px] text-slate-400 font-black uppercase">eBay:</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={rowEdit.ebay_price ?? item.ebay_price}
                        onChange={(e) => handleRowEdit(item.sku, 'ebay_price', e.target.value)}
                        className={`w-20 px-2 py-1 text-xs font-bold text-right border rounded-lg focus:outline-none transition-all ${
                          rowEdit.ebay_price !== undefined ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-slate-50/50'
                        }`}
                      />
                      <span className={`text-[10px] font-bold w-12 ${ebayProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {ebayProfit >= 0 ? '+' : ''}{ebayProfit.toFixed(1)}
                      </span>
                    </div>

                    {/* Total Profit & Save Action */}
                    <div className="flex items-center justify-end gap-3 mt-1 pt-1 border-t border-slate-100">
                      {hasChanges && (
                        <button 
                          onClick={() => saveRowChanges(item)}
                          disabled={isUpdating}
                          className="p-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-all animate-pulse shadow-md shadow-indigo-500/20"
                          title="Zapisz wszystkie zmiany dla tego towaru"
                        >
                          {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter mr-1">Suma Zysku:</span>
                        <span className="text-sm font-black text-indigo-600">
                          {(totalUnitProfit * effectiveStock).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="py-32 flex flex-col items-center justify-center text-slate-400">
          <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 mb-6">
            <Package className="w-16 h-16 opacity-5" />
          </div>
          <p className="text-lg font-black text-slate-300">Magazyn jest obecnie pusty.</p>
        </div>
      )}
    </div>
  );
};

export default InventoryTable;
