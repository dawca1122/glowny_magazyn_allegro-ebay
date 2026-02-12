// Lightweight client to fetch aggregated sales data from Dzidek API
// Dzidek API: https://franchise-undefined-growth-valley.trycloudflare.com/api/app-data

export type SalesSummaryEntry = {
  soldQty: number;
  gross: number;
  shippingCost?: number;
  adsCost?: number;
  feeCost?: number;
};
export type SalesSummaryMap = Record<string, SalesSummaryEntry>;

const getEnvVar = (name: string): string => {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[name]) return metaEnv[name];
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name] as string;
  } catch {}
  return '';
};

// Dzidek API - główne źródło danych
const DZIDEK_API = getEnvVar('VITE_DZIDEK_API') || 'https://franchise-undefined-growth-valley.trycloudflare.com';
const SALES_ENDPOINT = getEnvVar('VITE_ALLEGRO_SALES_ENDPOINT') || `${DZIDEK_API}/api/app-data`;

export const salesService = {
  async fetchSummary(): Promise<SalesSummaryMap> {
    try {
      console.log('[SalesService] Fetching from Dzidek:', SALES_ENDPOINT);
      
      const res = await fetch(SALES_ENDPOINT, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!res.ok) {
        console.warn(`[SalesService] Dzidek API error ${res.status}, using fallback`);
        return {};
      }
      
      const json = await res.json();
      
      console.log('[SalesService] Dzidek response:', {
        hasDaily: !!json.daily,
        hasMonthly: !!json.monthly,
        source: json.source,
      });
      
      return {};
      
    } catch (error) {
      console.warn('[SalesService] Dzidek unavailable:', error);
      return {};
    }
  },
  
  // Pobierz pełne dane z Dzidka
  async fetchFromDzidek(): Promise<any> {
    try {
      const res = await fetch(SALES_ENDPOINT, { method: 'GET' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
};