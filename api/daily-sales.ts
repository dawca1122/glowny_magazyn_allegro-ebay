/**
 * Daily Sales API endpoint
 * GET /api/daily-sales
 * Pobiera dane z Dzidka, fallback na mock jeśli niedostępny
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const DZIDEK_URL = 'https://0e784df5af85aaaf-87-179-39-164.serveousercontent.com';
const REQUEST_TIMEOUT = 15000;

async function fetchFromDzidek(): Promise<any | null> {
  try {
    const response = await fetch(`${DZIDEK_URL}/api/warehouse/daily-sales`, {
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
    console.log('[daily-sales] Dzidek unavailable, using mock data');
    return null;
  }
}

function getMockData() {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    date: today,
    allegro: [
      { productName: 'PROFESJONALNA Frezarka NEONAIL 12W Ręczna Mini Manicure', soldToday: 1, revenue: 159.99 },
      { productName: 'NEONAIL Nail Cleaner do naturalnej płytki paznokcia', soldToday: 1, revenue: 26.49 },
      { productName: 'NeoNail Hard Top 7,2 ml – wykończenie hybrydy', soldToday: 1, revenue: 47.82 },
      { productName: 'Blaszka NeoNail Plate For Stamps 12 srebrna', soldToday: 1, revenue: 50.36 },
      { productName: 'Cudy GS1024 Switch LAN 24x Gigabit Metalowy', soldToday: 1, revenue: 190.96 }
    ],
    ebay: [
      { productName: 'OOONO CO-Driver NO1 Blitzwarnung Echtzeit', soldToday: 1, revenue: 45.50 },
      { productName: 'ACE A Digitales Alkoholtester mit Sensor', soldToday: 1, revenue: 32.99 },
      { productName: 'Telekom Sinus PA 207 Telefonset AB DECT', soldToday: 1, revenue: 56.98 }
    ],
    totals: {
      allegro: { items: 5, revenue: 475.62, currency: 'PLN' },
      ebay: { items: 3, revenue: 135.47, currency: 'EUR' }
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
    console.error('[daily-sales] Error:', error);
    // Nawet przy błędzie zwróć mock data żeby UI działało
    const mockData = getMockData();
    return res.status(200).json(mockData);
  }
}
