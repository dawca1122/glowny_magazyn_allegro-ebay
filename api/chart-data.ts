/**
 * Chart Data API endpoint
 * GET /api/chart-data?period=7d|30d|90d&platform=all|ebay|allegro
 * Pobiera dane z Dzidka lub zwraca puste dane
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const DZIDEK_URL = 'https://api.dzidek.de';

async function fetchFromDzidek(days: number, platform: string): Promise<any[] | null> {
  try {
    const response = await fetch(`${DZIDEK_URL}/api/chart-data?days=${days}&platform=${platform}`, {
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
    console.log('[chart-data] Dzidek unavailable');
    return null;
  }
}

function getEmptyChartData(days: number) {
  const data: Array<{ date: string; ebay: number; allegro: number }> = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    data.push({
      date: dateStr,
      ebay: 0,
      allegro: 0
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
    const { period = '30d', platform = 'all' } = req.query;

    const periodDays: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90
    };

    const days = periodDays[period as string] || 30;
    
    // Spróbuj pobrać z Dzidka
    const dzidekData = await fetchFromDzidek(days, platform as string);
    
    if (dzidekData && dzidekData.length > 0) {
      return res.status(200).json({
        success: true,
        period,
        platform,
        data: dzidekData,
        source: 'dzidek',
        timestamp: new Date().toISOString()
      });
    }

    // Brak danych - zwróć puste
    return res.status(200).json({
      success: true,
      period,
      platform,
      data: getEmptyChartData(days),
      source: 'no-data',
      message: 'Brak danych historycznych - połącz z Dzidkiem',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[chart-data] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
