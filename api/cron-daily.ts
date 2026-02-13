/**
 * CRON endpoint - codzienne zadania automatyczne
 * GET /api/cron-daily
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseService } from './lib/supabase.js';

export const runtime = 'nodejs';

const RETENTION_DAYS = 30;
const DZIDEK_URL = 'https://api.dzidek.de';

async function syncFromDzidek(): Promise<{ success: boolean; data?: any }> {
  try {
    const response = await fetch(`${DZIDEK_URL}/api/warehouse/sales`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      console.error('[CRON] Dzidek response not OK:', response.status);
      return { success: false };
    }
    const data = await response.json();
    console.log('[CRON] Dzidek sync:', data.success ? 'OK' : 'FAIL');
    return { success: data.success || false, data };
  } catch (error) {
    console.error('[CRON] Dzidek sync error:', error);
    return { success: false };
  }
}

async function cleanupOldData(): Promise<{ success: boolean; deletedRows: number }> {
  if (!supabaseService) {
    console.log('[CRON] Supabase not configured, skipping cleanup');
    return { success: true, deletedRows: 0 };
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 10);

    console.log(`[CRON] Cleaning data older than ${cutoffDateStr}`);

    const { data: deletedSales, error: salesError } = await supabaseService
      .from('sales_summary')
      .delete()
      .lt('report_date', cutoffDateStr)
      .select('id');

    if (salesError) console.error('[CRON] Error cleaning sales_summary:', salesError);

    const { data: deletedReports, error: reportsError } = await supabaseService
      .from('channel_reports')
      .delete()
      .lt('report_date', cutoffDateStr)
      .select('id');

    if (reportsError) console.error('[CRON] Error cleaning channel_reports:', reportsError);

    const totalDeleted = (deletedSales?.length || 0) + (deletedReports?.length || 0);
    console.log(`[CRON] Cleaned ${totalDeleted} old records`);
    return { success: true, deletedRows: totalDeleted };
  } catch (error) {
    console.error('[CRON] Cleanup error:', error);
    return { success: false, deletedRows: 0 };
  }
}

async function pingWorkers(): Promise<{ allegro: boolean; ebay: boolean }> {
  const results = { allegro: false, ebay: false };
  try {
    const [allegroRes, ebayRes] = await Promise.all([
      fetch(`${DZIDEK_URL}/api/worker/allegro/status`, { signal: AbortSignal.timeout(10000) }).catch(() => null),
      fetch(`${DZIDEK_URL}/api/worker/ebay/status`, { signal: AbortSignal.timeout(10000) }).catch(() => null),
    ]);
    results.allegro = allegroRes?.ok || false;
    results.ebay = ebayRes?.ok || false;
  } catch (error) {
    console.error('[CRON] Worker ping error:', error);
  }
  return results;
}

async function cleanupSheetsHistory(): Promise<{ success: boolean; deleted: number; message: string }> {
  try {
    // Wywołaj API inventory-sheets z metodą DELETE
    const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/inventory-sheets`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      console.log('[CRON] Sheets cleanup response not OK:', response.status);
      return { success: false, deleted: 0, message: 'HTTP error' };
    }
    
    const data = await response.json();
    console.log('[CRON] Sheets history cleanup:', data);
    return { 
      success: data.success || false, 
      deleted: data.deleted || 0, 
      message: data.message || 'OK' 
    };
  } catch (error: any) {
    console.error('[CRON] Sheets cleanup error:', error);
    return { success: false, deleted: 0, message: error.message };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  
  const results = {
    timestamp: new Date().toISOString(),
    retentionDays: RETENTION_DAYS,
    tasks: {
      syncDzidek: { success: false, data: null as any },
      cleanup: { success: false, deletedRows: 0 },
      sheetsCleanup: { success: false, deleted: 0, message: '' },
      workerPing: { allegro: false, ebay: false },
    },
    duration: 0,
    success: false
  };

  try {
    console.log('[CRON] Starting daily tasks...');
    
    // 1. Sync z Dzidkiem
    const dzidekSync = await syncFromDzidek();
    results.tasks.syncDzidek = { success: dzidekSync.success, data: dzidekSync.data };

    // 2. Czyszczenie starych danych Supabase (30+ dni)
    const cleanup = await cleanupOldData();
    results.tasks.cleanup = cleanup;

    // 3. Czyszczenie historii Google Sheets (30+ dni)
    const sheetsCleanup = await cleanupSheetsHistory();
    results.tasks.sheetsCleanup = sheetsCleanup;

    // 4. Ping workerów
    const workerPing = await pingWorkers();
    results.tasks.workerPing = workerPing;

    results.duration = Date.now() - startTime;
    results.success = dzidekSync.success || cleanup.success || sheetsCleanup.success;

    console.log('[CRON] Daily tasks completed:', results);
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
