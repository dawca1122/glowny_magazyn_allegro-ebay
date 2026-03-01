import React, { useState } from 'react';
import { Save, Plus, RefreshCw, Package, Image, Link2 } from 'lucide-react';
import { InventoryItem, SalesSummaryMap } from './types';
import { inventoryService } from './magazynClient';

interface Props {
  items: InventoryItem[];
  onRefresh: () => void;
  onNotify: (msg: string, type: 'success' | 'error') => void;
  sales?: SalesSummaryMap;
}

const formatMargin = (price: number, cost: number) => {
  if (!price || price === 0) return '-%';
  const profit = price - cost;
  const margin = (profit / price) * 100;
  return `${margin.toFixed(1)}%`;
};

const formatProfit = (price: number, cost: number) => {
  const profit = price - cost;
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(profit);
};

const InventoryTable: React.FC<Props> = ({ items, onRefresh, onNotify, sales = {} }) => {
  const [savingSku, setSavingSku] = useState<string | null>(null);
  const [allegroSkuInputs, setAllegroSkuInputs] = useState<Record<string, string>>({});

  const totalWarehouseStock = items.reduce((sum, item) => sum + (item.total_stock || 0), 0);
  const totalAllegroStock = items.reduce((sum, item) => sum + (item.allegro_stock || 0), 0);
  const totalEbayStock = items.reduce((sum, item) => sum + (item.ebay_stock || 0), 0);

  const handleAllegroSkuChange = (ean: string, value: string) => {
    setAllegroSkuInputs(prev => ({
      ...prev,
      [ean]: value
    }));
  };

  const handleSaveAndAddToAllegro = async (item: InventoryItem) => {
    const allegroSku = allegroSkuInputs[item.ean || item.sku] || item.allegro_sku || '';

    if (!allegroSku.trim()) {
      onNotify('Wprowadź SKU Allegro przed zapisaniem.', 'error');
      return;
    }

    setSavingSku(item.sku);
    try {
      // Zapisz SKU Allegro do bazy
      await inventoryService.updateItem(item.sku, {
        allegro_sku: allegroSku.trim(),
        sync_status: 'pending'
      });

      // TODO: Wywołaj API do dodania na Allegro
      // Na razie tylko zapisujemy SKU

      onNotify(`SKU Allegro "\${allegroSku}" zapisane dla EAN: \${item.ean || item.sku}`, 'success');

      // Wyczyść input
      setAllegroSkuInputs(prev => {
        const next = { ...prev };
        delete next[item.ean || item.sku];
        return next;
      });

      onRefresh();
    } catch (err: any) {
      onNotify(`Błąd zapisu: \${err?.message || 'Nieznany błąd'}`, 'error');
    } finally {
      setSavingSku(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-0 bg-slate-800 text-white rounded-t-2xl">
        <div className="px-6 py-4 text-center">
          <span className="text-lg font-black tracking-wider">eBay</span>
        </div>
        <div className="px-6 py-4 text-center bg-indigo-600 border-x-4 border-indigo-400">
          <span className="text-lg font-black tracking-wider">EAN</span>
        </div>
        <div className="px-6 py-4 text-center">
          <span className="text-lg font-black tracking-wider">Allegro</span>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-0 bg-slate-100 border-b-2 border-slate-200">
        {/* eBay columns */}
        <div className="grid grid-cols-[60px_100px_60px_80px_1fr] gap-2 px-4 py-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Zdjęcie</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">SKU</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Ilość</span>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider text-center font-black">Marża</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tytuł eBay</span>
        </div>

        {/* EAN column */}
        <div className="px-6 py-3 flex flex-col items-center justify-center bg-indigo-50 border-x-2 border-indigo-200 min-w-[160px]">
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">BAZA (Sheet)</span>
          <span className="text-[14px] font-black text-slate-800">{totalWarehouseStock} szt.</span>
        </div>

        {/* Allegro columns */}
        <div className="grid grid-cols-[120px_100px_60px_80px_1fr] gap-2 px-4 py-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">SKU Allegro</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Akcja</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Ilość</span>
          <span className="text-[10px] font-black text-orange-600 uppercase tracking-wider text-center font-black">Marża</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tytuł Allegro</span>
        </div>
      </div>

      {/* Data Rows */}
      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const ean = item.ean || '-';
          const isSaving = savingSku === item.sku;
          const allegroSkuValue = allegroSkuInputs[item.ean || item.sku] ?? item.allegro_sku ?? '';
          const hasAllegroListing = !!item.allegro_listing_id;
          const isLinked = !!item.allegro_sku;

          return (
            <div
              key={item.sku}
              className={`grid grid-cols-[1fr_auto_1fr] gap-0 hover:bg-slate-50 transition-colors \${
                isLinked ? 'bg-emerald-50/30' : ''
              }`}
            >
              {/* eBay Side (Left) */}
              <div className="grid grid-cols-[60px_100px_60px_80px_1fr] gap-2 px-4 py-4 items-center border-r border-slate-100">
                {/* Zdjęcie */}
                <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Image className="w-5 h-5 text-slate-300" />
                  )}
                </div>

                {/* SKU eBay */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 truncate">
                    {item.ebay_sku || item.sku}
                  </span>
                </div>

                {/* Ilość eBay */}
                <div className="text-center">
                  <span className={`text-sm font-black \${(item.ebay_stock ?? item.total_stock) < 5 ? 'text-rose-500' : 'text-slate-700'}`}>
                    {item.ebay_stock ?? item.total_stock}
                  </span>
                </div>

                {/* Marża eBay */}
                <div className="text-center flex flex-col items-center">
                  <span className="text-xs font-black text-indigo-700">
                    {formatMargin(item.ebay_price, item.item_cost)}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400">
                    +{formatProfit(item.ebay_price, item.item_cost)}
                  </span>
                </div>

                {/* Tytuł eBay */}
                <div className="truncate">
                  <span className="text-sm text-slate-700 font-medium line-clamp-2">
                    {item.ebay_title || item.name}
                  </span>
                </div>
              </div>

              {/* EAN (Center) */}
              <div className="px-4 py-4 flex items-center justify-center bg-indigo-50/50 border-x-2 border-indigo-100 min-w-[160px]">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-3 py-2 rounded-xl border-2 border-indigo-200 font-mono tracking-wider">
                    {ean}
                  </span>
                  {isLinked && (
                    <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold">
                      <Link2 className="w-3 h-3" /> Połączono
                    </span>
                  )}
                </div>
              </div>

              {/* Allegro Side (Right) */}
              <div className="grid grid-cols-[120px_100px_60px_80px_1fr] gap-2 px-4 py-4 items-center border-l border-slate-100">
                {/* SKU Allegro (input) */}
                <div>
                  <input
                    type="text"
                    placeholder="Wpisz SKU..."
                    value={allegroSkuValue}
                    onChange={(e) => handleAllegroSkuChange(item.ean || item.sku, e.target.value)}
                    disabled={hasAllegroListing}
                    className={`w-full px-2 py-1.5 text-xs font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all \${
                      hasAllegroListing 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-not-allowed' 
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  />
                </div>

                {/* Przycisk Zapisz i Dodaj */}
                <div>
                  <button
                    onClick={() => handleSaveAndAddToAllegro(item)}
                    disabled={isSaving || hasAllegroListing}
                    className={`w-full px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all \${
                      hasAllegroListing
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-not-allowed'
                        : isSaving
                        ? 'bg-orange-100 text-orange-600 animate-pulse'
                        : 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/30 active:scale-95'
                    }`}
                  >
                    {isSaving ? (
                      <><RefreshCw className="w-3 h-3 animate-spin" /> ...</>
                    ) : hasAllegroListing ? (
                      <><span className="text-emerald-600">✓</span> OK</>
                    ) : (
                      <><Save className="w-3 h-3" /> Zapisz</>
                    )}
                  </button>
                </div>

                {/* Ilość Allegro */}
                <div className="text-center">
                  <span className={`text-sm font-black \${(item.allegro_stock ?? 0) < 5 ? 'text-rose-500' : 'text-slate-700'}`}>
                    {item.allegro_stock ?? '-'}
                  </span>
                </div>

                {/* Marża Allegro */}
                <div className="text-center flex flex-col items-center">
                  <span className="text-xs font-black text-orange-600">
                    {formatMargin(item.allegro_price, item.item_cost)}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400">
                    +{formatProfit(item.allegro_price, item.item_cost)}
                  </span>
                </div>

                {/* Tytuł Allegro */}
                <div className="truncate">
                  <span className={`text-sm font-medium line-clamp-2 \${item.allegro_title ? 'text-slate-700' : 'text-slate-300 italic'}`}>
                    {item.allegro_title || 'Brak ogłoszenia'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <div className="py-32 flex flex-col items-center justify-center text-slate-400">
          <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 mb-6">
            <Package className="w-16 h-16 opacity-20" />
          </div>
          <p className="text-lg font-black text-slate-300">Magazyn jest obecnie pusty.</p>
          <p className="text-sm text-slate-400 mt-2">Dodaj produkty z eBay aby rozpocząć synchronizację z Allegro.</p>
        </div>
      )}
    </div>
  );
};

export default InventoryTable;
