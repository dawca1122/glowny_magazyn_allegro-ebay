import React, { useMemo, useRef, useState } from 'react';
import { Camera, Check, Image, Loader2, Search, Shield } from 'lucide-react';
import { InventoryItem, AllegroCatalogItem } from './types';
import { allegroListingService } from './allegroListingService';

const isValidEan = (value: string) => /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value);

type Props = {
  item: InventoryItem;
  onClose: () => void;
  onNotify: (message: string, type: 'success' | 'error') => void;
  onListed: () => void;
};

const AllegroListingModal: React.FC<Props> = ({ item, onClose, onNotify, onListed }) => {
  const [eanInput, setEanInput] = useState('');
  const [results, setResults] = useState<AllegroCatalogItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stockWarning = useMemo(() => item.total_stock < 5, [item.total_stock]);

  const handleSearch = async () => {
    setError(null);
    setSelectedProductId(null);
    setResults([]);

    if (!isValidEan(eanInput.trim())) {
      setError('Podaj prawidłowy EAN (8/12/13/14 cyfr).');
      return;
    }
    setSearchLoading(true);
    try {
      const top3 = await allegroListingService.searchByEan(eanInput.trim());
      setResults(top3);
      if (!top3.length) setError('Brak w katalogu Allegro dla EAN.');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się pobrać katalogu Allegro.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFilePick = async (file?: File) => {
    if (!file) return;
    setScanLoading(true);
    setError(null);
    try {
      const ean = await allegroListingService.scanEanFromFile(file);
      setEanInput(ean);
      onNotify(`Odczytano EAN: ${ean}`, 'success');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się zeskanować EAN.');
    } finally {
      setScanLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreate = async () => {
    if (!selectedProductId) {
      setError('Wybierz produkt z listy TOP 3.');
      return;
    }
    if (stockWarning) {
      setError('Za mały stan magazynowy. Wymagane minimum 5 sztuk.');
      return;
    }
    setCreateLoading(true);
    setError(null);
    try {
      await allegroListingService.createOffer(item.sku || String(item.id || ''), selectedProductId);
      onNotify('Oferta w Allegro została utworzona (5 szt.).', 'success');
      onListed();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Nie udało się utworzyć oferty w Allegro.');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[28px] shadow-2xl border border-slate-100 w-full max-w-4xl p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500 mb-2">Wystaw na Allegro</p>
              <h3 className="text-2xl font-black text-slate-900">{item.name}</h3>
              <p className="text-slate-500 text-sm">SKU: {item.sku}</p>
            </div>
            <div className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${stockWarning ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
              <Shield className="w-4 h-4" /> Stan magazynu: {item.total_stock} szt
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 p-4 rounded-2xl border border-slate-200 bg-slate-50">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">EAN</label>
              <div className="mt-2 flex flex-col md:flex-row gap-3">
                <input
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm font-semibold"
                  placeholder="Wpisz lub wklej EAN"
                  value={eanInput}
                  onChange={(e) => setEanInput(e.target.value.replace(/\s+/g, ''))}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={scanLoading}
                    className={`px-4 py-3 rounded-xl border border-indigo-200 text-indigo-700 font-bold flex items-center gap-2 transition-all ${scanLoading ? 'bg-indigo-50' : 'hover:bg-indigo-50'}`}
                  >
                    {scanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Skanuj z foto
                  </button>
                  <button
                    onClick={handleSearch}
                    disabled={searchLoading}
                    className={`px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all ${searchLoading ? 'opacity-70' : 'hover:bg-indigo-700'}`}
                  >
                    {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Szukaj
                  </button>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => handleFilePick(e.target.files?.[0] || undefined)}
              />
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Parametry oferty</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between"><span>Cena Allegro</span><span className="font-bold text-slate-900">{item.allegro_price.toFixed(2)} PLN</span></div>
                <div className="flex justify-between"><span>Ilość do wystawienia</span><span className="font-bold text-slate-900">5 szt</span></div>
                <div className="flex justify-between"><span>Stan magazynowy</span><span className={`font-bold ${stockWarning ? 'text-rose-500' : 'text-emerald-600'}`}>{item.total_stock} szt</span></div>
                <div className="flex justify-between"><span>Status dokumentu</span><span className="font-bold text-slate-900">{item.document_status}</span></div>
              </div>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {results.map((product) => {
              const isSelected = selectedProductId === product.productId;
              return (
                <button
                  key={product.productId}
                  onClick={() => setSelectedProductId(product.productId)}
                  className={`text-left p-4 rounded-2xl border transition-all h-full flex flex-col gap-3 ${isSelected ? 'border-indigo-400 bg-indigo-50 shadow-lg shadow-indigo-200/50' : 'border-slate-200 hover:border-indigo-200 hover:shadow-md'}`}
                >
                  <div className="aspect-square rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden relative">
                    {product.mainImageUrl ? (
                      <img src={product.mainImageUrl} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <Image className="w-10 h-10 text-slate-300" />
                    )}
                    {isSelected && <span className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1"><Check className="w-4 h-4" /></span>}
                  </div>
                  <div className="space-y-2">
                    <p className="font-black text-slate-900 leading-snug line-clamp-2">{product.title}</p>
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-500">Score: {product.score.toFixed(1)}</p>
                    <ul className="text-xs text-slate-500 space-y-1">
                      {product.reason.slice(0, 3).map((r, idx) => (
                        <li key={idx}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                </button>
              );
            })}

            {!results.length && !searchLoading && (
              <div className="md:col-span-3 text-center text-slate-400 py-10 border border-dashed border-slate-200 rounded-2xl">
                Podaj EAN i wyszukaj, aby zobaczyć TOP 3 z katalogu Allegro.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-slate-500 font-semibold">
              Ilość wystawiana zawsze = 5 szt. | Brak wyników → komunikat | Stan &lt; 5 blokuje wystawienie
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800">Anuluj</button>
              <button
                onClick={handleCreate}
                disabled={createLoading || stockWarning || !selectedProductId}
                className={`px-5 py-2 rounded-xl text-white font-bold flex items-center gap-2 shadow-lg transition-all ${
                  createLoading || stockWarning || !selectedProductId
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30'
                }`}
              >
                {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Wystaw 5 sztuk
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllegroListingModal;
