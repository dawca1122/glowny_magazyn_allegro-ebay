/**
 * Daily Sales API endpoint
 * GET /api/daily-sales
 * Pobiera dane z Dzidka - NIE używa mock danych
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const DZIDEK_URL = 'https://api.dzidek.de';
const REQUEST_TIMEOUT = 15000;

async function fetchFromDzidek(): Promise<any | null> {
  try {
    // Główny endpoint Dzidka
    const response = await fetch(`${DZIDEK_URL}/api/app-data`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    console.log('[daily-sales] Dzidek response:', JSON.stringify(data).slice(0, 200));
    
    // Przekształć dane z Dzidka do formatu daily-sales
    if (data.summary) {
      const allegroProducts = Object.entries(data.summary).map(([name, info]: [string, any]) => ({
        productName: name,
        soldToday: info.soldQty || 0,
        revenue: info.gross || 0
      }));
      
      return {
        date: new Date().toISOString().split('T')[0],
        allegro: allegroProducts,
        ebay: [], // eBay dane przyjdą od eBay workera
        totals: {
          allegro: { 
            items: allegroProducts.reduce((sum, p) => sum + p.soldToday, 0),
            revenue: allegroProducts.reduce((sum, p) => sum + p.revenue, 0),
            currency: 'PLN'
          },
          ebay: { items: 0, revenue: 0, currency: 'EUR' }
        },
        source: 'dzidek',
        timestamp: data.timestamp || new Date().toISOString()
      };
    }
    
    return data;
  } catch (error) {
    console.log('[daily-sales] Dzidek unavailable:', error);
    return null;
  }
}

function getEmptyData() {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    date: today,
    allegro: [],
    ebay: [],
    totals: {
      allegro: { items: 0, revenue: 0, currency: 'PLN' },
      ebay: { items: 0, revenue: 0, currency: 'EUR' }
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

    // Brak danych - zwróć puste (nie mock!)
    return res.status(200).json(getEmptyData());
    
  } catch (error: any) {
    console.error('[daily-sales] Error:', error);
    return res.status(200).json(getEmptyData());
  }
}
