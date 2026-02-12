/**
 * Chart Data API endpoint
 * GET /api/chart-data?period=7d|30d|90d&platform=all|ebay|allegro
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

function generateChartData(days: number, platform: string) {
  const data: Array<{ date: string; ebay: number; allegro: number }> = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Generate realistic mock data with some variation
    const baseEbay = 800 + Math.random() * 400;
    const baseAllegro = 400 + Math.random() * 200;

    data.push({
      date: dateStr,
      ebay: platform === 'allegro' ? 0 : Math.round(baseEbay * 100) / 100,
      allegro: platform === 'ebay' ? 0 : Math.round(baseAllegro * 100) / 100
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
    const chartData = generateChartData(days, platform as string);

    return res.status(200).json({
      success: true,
      period,
      platform,
      data: chartData,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[chart-data] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
