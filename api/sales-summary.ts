/**
 * Sales Summary API endpoint
 * GET /api/sales-summary
 * Pobiera dane z Dzidka - NIE używa mock danych
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const GAS_URL = 'https://script.google.com/u/0/home/projects/1Sh_brzCdhNclr77chHZZyWfRzhMhTYKiHKrci9STvF32tNv9aqB_bg1X/exec';
const REQUEST_TIMEOUT = 30000;

async function fetchFromGas(): Promise<any | null> {
  try {
    const response = await fetch(GAS_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    const data = await response.json();
    console.log('[sales-summary] GAS response received');

    return data;
  } catch (error) {
    console.log('[sales-summary] GAS unavailable:', error);
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
    const gasData = await fetchFromGas();

    if (gasData) {
      return res.status(200).json(gasData);
    }

    return res.status(200).json(getEmptyData());

  } catch (error: any) {
    console.error('[sales-summary] Error:', error);
    return res.status(200).json(getEmptyData());
  }
}
