/**
 * Sales Summary API endpoint
 * GET /api/sales-summary
 * Pobiera dane z Dzidka - NIE używa mock danych
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const DZIDEK_URL = 'https://api.dzidek.de';
const REQUEST_TIMEOUT = 15000;

async function fetchFromDzidek(): Promise<any | null> {
  try {
    const response = await fetch(`${DZIDEK_URL}/api/app-data`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    console.log('[sales-summary] Dzidek response:', JSON.stringify(data).slice(0, 200));
    
    // Przekształć dane z Dzidka do formatu sales-summary
    if (data.summary || data.platformData) {
      const platformData = data.platformData || { allegro: {}, ebay: {} };
      
      // Oblicz sumy z summary
      let allegroRevenue = 0;
      let allegroItems = 0;
      
      if (data.summary) {
        Object.values(data.summary).forEach((item: any) => {
          allegroRevenue += item.gross || 0;
          allegroItems += item.soldQty || 0;
        });
      }
      
      // Oblicz koszty szacunkowe (Allegro)
      const totalAllegroRevenue = allegroRevenue || platformData.allegro?.revenue || 0;
      const productCost = totalAllegroRevenue * 0.30;  // 30% koszt produktów
      const fees = totalAllegroRevenue * 0.12;         // 12% prowizje
      const taxes = totalAllegroRevenue * 0.08;        // 8% VAT/shipping
      const netAllegro = totalAllegroRevenue - productCost - fees - taxes;  // ~50% zysk netto
      
      const ebayRevenue = platformData.ebay?.revenue || 0;
      const netEbay = ebayRevenue * 0.5;  // 50% marża dla eBay
      
      return {
        daily: {
          revenue: { 
            ebay: ebayRevenue, 
            allegro: totalAllegroRevenue
          },
          costs: { products: productCost, fees: fees, taxes: taxes },
          net: { 
            ebay: netEbay, 
            allegro: netAllegro
          },
          items: {
            ebay: platformData.ebay?.items || 0,
            allegro: allegroItems || platformData.allegro?.items || 0
          }
        },
        // Monthly = suma od początku miesiąca (na razie = daily, bo Dzidek nie ma historii)
        monthly: {
          revenue: { ebay: ebayRevenue, allegro: totalAllegroRevenue },
          costs: { products: productCost, fees: fees, taxes: taxes },
          net: { ebay: netEbay, allegro: netAllegro },
          dailyAverage: netAllegro / 12  // ~12 dni od początku miesiąca
        },
        source: 'dzidek',
        timestamp: data.timestamp || new Date().toISOString()
      };
    }
    
    return null;
  } catch (error) {
    console.log('[sales-summary] Dzidek unavailable:', error);
    return null;
  }
}

function getEmptyData() {
  return {
    daily: {
      revenue: { ebay: 0, allegro: 0 },
      costs: { products: 0, fees: 0, taxes: 0 },
      net: { ebay: 0, allegro: 0 },
      items: { ebay: 0, allegro: 0 }
    },
    monthly: {
      revenue: { ebay: 0, allegro: 0 },
      costs: { products: 0, fees: 0, taxes: 0 },
      net: { ebay: 0, allegro: 0 },
      dailyAverage: 0
    },
    source: 'no-data',
    message: 'Brak danych - połącz się z Dzidkiem',
    timestamp: new Date().toISOString()
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const dzidekData = await fetchFromDzidek();
    
    if (dzidekData) {
      return res.status(200).json(dzidekData);
    }

    return res.status(200).json(getEmptyData());
    
  } catch (error: any) {
    console.error('[sales-summary] Error:', error);
    return res.status(200).json(getEmptyData());
  }
}
