
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

export const inventoryService = {
  async fetchAll(): Promise<InventoryItem[]> {
    if (!supabase) return getMockData();
    const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((item: any) => ({
      ...item,
      document_status: item.document_status || item.doc_status || 'Oczekuje',
      doc_status: item.doc_status || item.document_status || 'Oczekuje'
    })) as InventoryItem[];
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
