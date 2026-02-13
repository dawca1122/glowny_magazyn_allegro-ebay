
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InventoryItem } from './types';

const getEnvVar = (name: string): string => {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[name]) return metaEnv[name];
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name];
    if ((window as any).env && (window as any).env[name]) return (window as any).env[name];
  } catch (e) {}
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. Falling back to mock data.');
}

export const isConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const MOCK_STORAGE_KEY = 'syncpro_demo_inventory';

const getMockData = (): InventoryItem[] => {
  const stored = localStorage.getItem(MOCK_STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  
  const initial: InventoryItem[] = [
    {
      name: '[TWÓJ PRODUKT 1]',
      sku: 'PROD-001',
      purchase_type: 'Faktura',
      document_type: 'Typ A',
      document_status: 'Oczekuje',
      item_cost: 0,
      total_stock: 0,
      allegro_price: 0,
      ebay_price: 0,
      created_at: new Date().toISOString()
    },
    {
      name: '[TWÓJ PRODUKT 2]',
      sku: 'PROD-002',
      purchase_type: 'Gotówka',
      document_type: 'Typ B',
      document_status: 'Pobrano',
      item_cost: 0,
      total_stock: 0,
      allegro_price: 0,
      ebay_price: 0,
      created_at: new Date().toISOString()
    }
  ];
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

const saveMockData = (data: InventoryItem[]) => {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
};

// Cache dla produktów (żeby nie pobierać za każdym razem)
let inventoryCache: { items: InventoryItem[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minut

// Pobierz produkty bezpośrednio z Allegro i eBay API
const fetchProductsFromPlatforms = async (): Promise<InventoryItem[] | null> => {
  // Sprawdź cache
  if (inventoryCache && Date.now() - inventoryCache.timestamp < CACHE_TTL) {
    console.log('[Inventory] Using cached data:', inventoryCache.items.length, 'products');
    return inventoryCache.items;
  }
  
  try {
    // Użyj API endpoint - pobiera z Allegro i eBay
    const apiBase = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? '' 
      : 'http://localhost:3001';
    
    const response = await fetch(`${apiBase}/api/inventory-sync`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.warn('[Inventory] Sync API returned:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.combined && data.combined.length > 0) {
      // Przekształć na format InventoryItem
      const products: InventoryItem[] = data.combined.map((item: any) => ({
        name: item.name || item.sku,
        sku: item.sku,
        ean: item.ean || item.sku,
        purchase_type: 'Faktura' as const,
        document_type: 'Typ A' as const,
        document_status: 'Pobrano' as const,
        item_cost: item.price * 0.5, // Szacowany koszt = 50% ceny
        total_stock: item.stock || 0,
        allegro_price: item.platform === 'allegro' ? item.price : 0,
        ebay_price: item.platform === 'ebay' ? item.price : 0,
        allegro_stock: item.platform === 'allegro' ? item.stock : 0,
        ebay_stock: item.platform === 'ebay' ? item.stock : 0,
        allegro_title: item.platform === 'allegro' ? item.name : '',
        ebay_title: item.platform === 'ebay' ? item.name : '',
        allegro_sku: item.platform === 'allegro' ? item.external_id : '',
        allegro_listing_id: item.platform === 'allegro' ? item.external_id : undefined,
        ebay_sku: item.platform === 'ebay' ? item.external_id : '',
        image_url: item.image_url,
        sync_status: item.status === 'ACTIVE' ? 'synced' : 'pending',
        created_at: new Date().toISOString()
      }));
      
      // Zapisz do cache
      inventoryCache = { items: products, timestamp: Date.now() };
      
      console.log(`[Inventory] Loaded from APIs: Allegro=${data.allegro?.count || 0}, eBay=${data.ebay?.count || 0}, Total=${products.length}`);
      return products;
    }
    
    console.log('[Inventory] No products from platforms:', data.allegro?.status, data.ebay?.status);
    return null;
  } catch (error) {
    console.warn('[Inventory] Sync API unavailable:', error);
    return null;
  }
};

export const inventoryService = {
  async fetchAll(): Promise<InventoryItem[]> {
    // 1. Główne źródło: API Allegro + eBay (300+ produktów)
    const platformProducts = await fetchProductsFromPlatforms();
    if (platformProducts && platformProducts.length > 0) {
      return platformProducts;
    }
    
    // 2. Fallback: Supabase jeśli skonfigurowane
    if (supabase) {
      const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data.map((item: any) => ({
          ...item,
          document_status: item.document_status || item.doc_status || 'Oczekuje',
          doc_status: item.doc_status || item.document_status || 'Oczekuje'
        })) as InventoryItem[];
      }
    }
    
    // 3. Ostateczny fallback: localStorage (puste produkty)
    return getMockData();
  },

  async updateItem(sku: string, updates: Partial<InventoryItem>) {
    if (!supabase) {
      const data = getMockData();
      const index = data.findIndex(i => i.sku === sku);
      if (index !== -1) {
        data[index] = { ...data[index], ...updates };
        saveMockData(data);
      }
      return;
    }

    // Supabase: nie wysyłaj pól, których może nie być w schemacie (np. doc_status)
    const { doc_status, ...safeUpdates } = updates as any;
    const { data, error } = await supabase.from('inventory').update(safeUpdates).eq('sku', sku);
    if (error) throw error;
    return data;
  },

  async createItem(item: Omit<InventoryItem, 'created_at'>): Promise<InventoryItem> {
    const basePayload: InventoryItem = {
      ...item,
      document_status: item.document_status || item.doc_status || 'Oczekuje',
      doc_status: item.doc_status || item.document_status || 'Oczekuje',
      created_at: new Date().toISOString()
    };

    if (!supabase) {
      const data = getMockData();
      const next = [...data, basePayload];
      saveMockData(next);
      return basePayload;
    }

    // Supabase: usuń doc_status jeśli tabela go nie ma
    const { doc_status, ...dbPayload } = basePayload as any;
    const { data, error } = await supabase.from('inventory').insert([dbPayload]).select().single();
    if (error) {
      console.error('[Supabase] insert failed', {
        message: error.message,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        code: (error as any)?.code,
        dbPayload
      });
      throw new Error(error.message || 'Supabase insert error');
    }
    return data as InventoryItem;
  },

  async checkConnection(): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase.from('inventory').select('id').limit(1);
    if (error) {
      console.error('[Supabase] Connection check failed:', error.message);
      return false;
    }
    return true;
  },

  async subtractStock(sku: string, amount: number) {
    if (!supabase) {
      const data = getMockData();
      const index = data.findIndex(i => i.sku === sku);
      if (index !== -1) {
        data[index].total_stock = Math.max(0, data[index].total_stock - amount);
        data[index].document_status = 'Pobrano';
        saveMockData(data);
        return data[index].total_stock;
      }
      throw new Error("Item not found");
    }
    
    const { data: item, error: fetchError } = await supabase.from('inventory').select('total_stock').eq('sku', sku).single();
    if (fetchError) throw fetchError;

    const newStock = Math.max(0, (item?.total_stock || 0) - amount);
    const { error: updateError } = await supabase.from('inventory').update({ 
      total_stock: newStock,
      document_status: 'Pobrano' 
    }).eq('sku', sku);

    if (updateError) throw updateError;
    return newStock;
  }
};
