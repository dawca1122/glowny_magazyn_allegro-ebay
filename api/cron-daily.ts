/**
 * CRON endpoint - codzienne zadania automatyczne
 * GET /api/cron-daily
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const RETENTION_DAYS = 30;
const DZIDEK_URL = 'https://0e784df5af85aaaf-87-179-39-164.serveousercontent.com';

async function syncFromDzidek(): Promise<boolean> {
  try {
    const response = await fetch(`${DZIDEK_URL}/api/warehouse/sales`);
    if (!response.ok) return false;
    const data = await response.json();
    console.log('[CRON] Dzidek sync:', data.success ? 'OK' : 'FAIL');
    return data.success || false;
  } catch (error) {
    console.error('[CRON] Dzidek sync error:', error);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  const results = {
    timestamp: new Date().toISOString(),
    retentionDays: RETENTION_DAYS,
    tasks: {
      syncDzidek: { success: false }
    },
    duration: 0,
    success: false
  };

  try {
    console.log('[CRON] Starting daily tasks...');
    
    const dzidekSync = await syncFromDzidek();
    results.tasks.syncDzidek = { success: dzidekSync };

    results.duration = Date.now() - startTime;
    results.success = true;

    return res.status(200).json(results);

  } catch (error: any) {
    console.error('[CRON] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
}
