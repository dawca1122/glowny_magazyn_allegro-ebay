/**
 * Platform Stats API endpoint
 * GET /api/platform-stats
 * Pobiera dane z Dzidka lub zwraca puste dane
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const DZIDEK_URL = 'https://api.dzidek.de';

async function fetchFromDzidek(): Promise<any | null> {
  try {
    const response = await fetch(`${DZIDEK_URL}/api/app-data`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Przekształć dane z Dzidka do formatu platform-stats
    if (data.summary || data.platformData) {
      const platformData = data.platformData || { allegro: {}, ebay: {} };
      
      // Oblicz statystyki z summary
      let allegroRevenue = 0;
      let allegroItems = 0;
      const allegroProducts: any[] = [];
      
      if (data.summary) {
        Object.entries(data.summary).forEach(([name, info]: [string, any]) => {
          allegroRevenue += info.gross || 0;
          allegroItems += info.soldQty || 0;
          if (info.soldQty > 0) {
            allegroProducts.push({
              name,
              sold: info.soldQty,
              revenue: info.gross
            });
          }
        });
      }
      
      return {
        success: true,
        platforms: {
          ebay: {
            name: 'eBay',
            currency: 'EUR',
            totalRevenue: platformData.ebay?.revenue || 0,
            totalOrders: platformData.ebay?.items || 0,
            avgOrderValue: 0,
            topProducts: [],
            conversionRate: 0,
            returnRate: 0
          },
          allegro: {
            name: 'Allegro',
            currency: 'PLN',
            totalRevenue: allegroRevenue || platformData.allegro?.revenue || 0,
            totalOrders: allegroItems || platformData.allegro?.items || 0,
            avgOrderValue: allegroItems > 0 ? allegroRevenue / allegroItems : 0,
            topProducts: allegroProducts.slice(0, 5),
            conversionRate: 0,
            returnRate: 0
          }
        },
        comparison: {
          revenueShare: { 
            ebay: (platformData.ebay?.revenue || 0) / Math.max(1, (platformData.ebay?.revenue || 0) + allegroRevenue) * 100, 
            allegro: allegroRevenue / Math.max(1, (platformData.ebay?.revenue || 0) + allegroRevenue) * 100 
          },
          ordersShare: { 
            ebay: (platformData.ebay?.items || 0) / Math.max(1, (platformData.ebay?.items || 0) + allegroItems) * 100, 
            allegro: allegroItems / Math.max(1, (platformData.ebay?.items || 0) + allegroItems) * 100
          },
          growthMoM: { ebay: 0, allegro: 0 }
        },
        source: 'dzidek',
        timestamp: data.timestamp || new Date().toISOString()
      };
    }
    
    return null;
  } catch (error) {
    console.log('[platform-stats] Dzidek unavailable:', error);
    return null;
  }
}

function getEmptyStats() {
  return {
    success: true,
    platforms: {
      ebay: {
        name: 'eBay',
        currency: 'EUR',
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        topProducts: [],
        conversionRate: 0,
        returnRate: 0
      },
      allegro: {
        name: 'Allegro',
        currency: 'PLN',
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        topProducts: [],
        conversionRate: 0,
        returnRate: 0
      }
    },
    comparison: {
      revenueShare: { ebay: 0, allegro: 0 },
      ordersShare: { ebay: 0, allegro: 0 },
      growthMoM: { ebay: 0, allegro: 0 }
    },
    source: 'no-data',
    message: 'Brak danych - połącz z Dzidkiem',
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

    return res.status(200).json(getEmptyStats());
  } catch (error: any) {
    console.error('[platform-stats] Error:', error);
    return res.status(200).json(getEmptyStats());
  }
}
