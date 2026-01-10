// Lightweight client to fetch aggregated sales data by SKU from backend Allegro proxy
// Expected response shape: { summary: { [sku]: { soldQty: number; gross: number } } }

export type SalesSummaryEntry = { soldQty: number; gross: number };
export type SalesSummaryMap = Record<string, SalesSummaryEntry>;

const getEnvVar = (name: string): string => {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[name]) return metaEnv[name];
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name] as string;
  } catch {}
  return '';
};

const SALES_ENDPOINT = getEnvVar('VITE_ALLEGRO_SALES_ENDPOINT');

export const salesService = {
  async fetchSummary(): Promise<SalesSummaryMap> {
    if (!SALES_ENDPOINT) return {};
    const res = await fetch(SALES_ENDPOINT, { method: 'GET' });
    if (!res.ok) throw new Error(`Sales endpoint error: ${res.status}`);
    const json = await res.json();
    return json?.summary || {};
  }
};