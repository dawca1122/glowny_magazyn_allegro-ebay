/**
 * Monthly Chart Data API endpoint
 * GET /api/monthly-chart-data?months=6
 * Zwraca puste dane (brak historycznych danych miesięcznych)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const DZIDEK_URL = 'https://api.dzidek.de';

async function fetchFromDzidek(months: number): Promise<any[] | null> {
  try {
    const response = await fetch(`${DZIDEK_URL}/api/monthly-chart-data?months=${months}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success && data.data) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.log('[monthly-chart-data] Dzidek unavailable');
    return null;
  }
}

function getEmptyMonthlyData(months: number) {
  const data: Array<{ month: string; ebay: number; allegro: number; total: number }> = [];
  const today = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthNames = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
    const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

    data.push({
      month: label,
      ebay: 0,
      allegro: 0,
      total: 0
    });
  }

  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { months = '6' } = req.query;
    const monthCount = parseInt(months as string, 10) || 6;

    // Spróbuj pobrać z Dzidka
    const dzidekData = await fetchFromDzidek(monthCount);
    
    if (dzidekData && dzidekData.length > 0) {
      return res.status(200).json({
        success: true,
        months: monthCount,
        data: dzidekData,
        source: 'dzidek',
        timestamp: new Date().toISOString()
      });
    }

    // Brak danych - zwróć puste
    return res.status(200).json({
      success: true,
      months: monthCount,
      data: getEmptyMonthlyData(monthCount),
      source: 'no-data',
      message: 'Brak danych historycznych - połącz z Dzidkiem',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[monthly-chart-data] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
