/**
 * Daily Sales API endpoint
 * GET /api/daily-sales
 * Pobiera dane z Dzidka - NIE używa mock danych
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const GAS_URL = 'https://script.google.com/u/0/home/projects/1Sh_brzCdhNclr77chHZZyWfRzhMhTYKiHKrci9STvF32tNv9aqB_bg1X/exec'; // Zmieniono na /exec dla Vercel
const REQUEST_TIMEOUT = 30000;

async function fetchFromGas(): Promise<any | null> {
  try {
    const response = await fetch(GAS_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) return null;

    // Google Apps Script może zwrócić HTML jeśli link jest zły/brak uprawnień
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    const data = await response.json();
    console.log('[daily-sales] GAS response received');

    return data;
  } catch (error) {
    console.log('[daily-sales] GAS unavailable:', error);
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
    const gasData = await fetchFromGas();

    if (gasData) {
      return res.status(200).json(gasData);
    }

    // Brak danych - zwróć puste (nie mock!)
    return res.status(200).json(getEmptyData());

  } catch (error: any) {
    console.error('[daily-sales] Error:', error);
    return res.status(200).json(getEmptyData());
  }
}
