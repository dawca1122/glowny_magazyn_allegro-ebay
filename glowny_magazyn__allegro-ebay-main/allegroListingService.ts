import { AllegroCatalogItem, AllegroSearchResponse } from './types';

const getEnvVar = (name: string): string => {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[name]) return metaEnv[name];
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name] as string;
    if ((window as any).env && (window as any).env[name]) return (window as any).env[name];
  } catch {}
  return '';
};

const CATALOG_ENDPOINT = getEnvVar('VITE_ALLEGRO_CATALOG_SEARCH_ENDPOINT') || '/api/allegro/catalog/search-by-ean';
const OFFER_ENDPOINT = getEnvVar('VITE_ALLEGRO_OFFER_CREATE_ENDPOINT') || '/api/allegro/offer/create-from-product';
const EAN_SCAN_ENDPOINT = getEnvVar('VITE_EAN_SCAN_ENDPOINT') || '/api/ean/scan';

const handleJson = async (res: Response) => {
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = json?.error || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json;
};

export const allegroListingService = {
  async searchByEan(ean: string): Promise<AllegroCatalogItem[]> {
    const res = await fetch(CATALOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ean }),
    });
    const data: AllegroSearchResponse = await handleJson(res);
    return data?.top3 || [];
  },

  async createOffer(warehouseItemId: string, productId: string) {
    const res = await fetch(OFFER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseItemId, productId, quantity: 5 }),
    });
    return handleJson(res);
  },

  async scanEanFromFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(EAN_SCAN_ENDPOINT, { method: 'POST', body: fd });
    const data = await handleJson(res);
    if (!data?.ean) throw new Error('Brak numeru EAN w odpowiedzi.');
    return data.ean as string;
  },
};
