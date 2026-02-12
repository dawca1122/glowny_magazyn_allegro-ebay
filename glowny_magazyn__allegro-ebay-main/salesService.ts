// Lightweight client to fetch aggregated sales data by SKU from backend Allegro proxy
// Expected response shape: { summary: { [sku]: { soldQty: number; gross: number } } }

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

const SALES_ENDPOINT = getEnvVar('VITE_ALLEGRO_SALES_ENDPOINT') || 'http://localhost:3001/api/app-data';

export const salesService = {
  async fetchSummary(): Promise<SalesSummaryMap> {
    if (!SALES_ENDPOINT) return {};
    try {
      const res = await fetch(SALES_ENDPOINT, { method: 'GET' });
      if (!res.ok) {
        console.error(`Sales endpoint error ${res.status}: ${res.statusText}`);
        throw new Error(`Sales endpoint error: ${res.status}`);
      }
      const json = await res.json();
      
      // DEBUG: Log what we received
      console.log('📊 API Response:', {
        hasDaily: !!json.daily,
        hasMonthly: !!json.monthly,
        source: json.source,
        dailyRevenue: json.daily?.revenue
      });
      
      // Convert API response to expected format
      // Our API returns { daily: { revenue: { allegro: X, ebay: Y }, ... }, ... }
      // But app expects { summary: { [sku]: { soldQty: X, gross: Y } } }
      
      // For now, return empty map but log real data
      console.log('💰 REAL DATA from API:');
      console.log('   Allegro revenue:', json.daily?.revenue?.allegro || 0);
      console.log('   eBay revenue:', json.daily?.revenue?.ebay || 0);
      console.log('   Source:', json.source || 'unknown');
      
      // Return empty map for now - app needs to be updated to use new structure
      return {};
      
    } catch (error) {
      console.error('❌ Failed to fetch sales summary:', error);
      throw error;
    }
  }
};