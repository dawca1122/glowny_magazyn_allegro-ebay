/**
 * Sales Summary API endpoint
 * GET /api/sales-summary
 * Pobiera dane z Dzidka, fallback na mock jeśli niedostępny
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const DZIDEK_URL = 'https://api.dzidek.de';
const REQUEST_TIMEOUT = 15000;

async function fetchFromDzidek(): Promise<any | null> {
  try {
    const response = await fetch(`${DZIDEK_URL}/api/warehouse/sales-summary`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success && data.data) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.log('[sales-summary] Dzidek unavailable, using mock data');
    return null;
  }
}

function getMockData() {
  return {
    daily: {
      revenue: { ebay: 2450.75, allegro: 1240.15 },
      costs: { products: 1476, fees: 369, taxes: 295 },
      net: { ebay: 1850.50, allegro: 930.00 }
    },
    monthly: {
      revenue: { ebay: 24574.75, allegro: 12401.50 },
      costs: { products: 9244.07, fees: 4186.84, taxes: 3697.63 },
      net: { ebay: 12779.86, allegro: 7068.85 },
      dailyAverage: 662.00
    },
    source: 'mock',
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
    // Spróbuj pobrać z Dzidka
    const dzidekData = await fetchFromDzidek();
    
    if (dzidekData) {
      return res.status(200).json({
        ...dzidekData,
        source: 'dzidek',
        timestamp: new Date().toISOString()
      });
    }

    // Fallback na mock data
    const mockData = getMockData();
    return res.status(200).json(mockData);
    
  } catch (error: any) {
    console.error('[sales-summary] Error:', error);
    const mockData = getMockData();
    return res.status(200).json(mockData);
  }
}
