/**
 * Monthly Chart Data API endpoint
 * GET /api/monthly-chart-data?months=6
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

function generateMonthlyData(months: number) {
  const data: Array<{ month: string; ebay: number; allegro: number; total: number }> = [];
  const today = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = date.toISOString().slice(0, 7); // YYYY-MM

    const monthNames = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
    const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

    // Generate realistic mock data
    const ebay = 20000 + Math.random() * 10000;
    const allegro = 10000 + Math.random() * 5000;

    data.push({
      month: label,
      ebay: Math.round(ebay * 100) / 100,
      allegro: Math.round(allegro * 100) / 100,
      total: Math.round((ebay + allegro) * 100) / 100
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

    const chartData = generateMonthlyData(monthCount);

    return res.status(200).json({
      success: true,
      months: monthCount,
      data: chartData,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[monthly-chart-data] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
