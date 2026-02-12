/**
 * Dzidek Sync endpoint - komunikacja z głównym serwerem Dzidek
 * GET: pobiera dane sprzedażowe
 * POST: wysyła komendy do workerów
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const DZIDEK_URL = 'https://api.dzidek.de';
const REQUEST_TIMEOUT = 30000;

interface DzidekSalesResponse {
  success: boolean;
  data?: {
    allegro?: { revenue: number; orders: number; items: Array<{ sku: string; soldQty: number; gross: number }> };
    ebay?: { revenue: number; orders: number; items: Array<{ sku: string; soldQty: number; gross: number }> };
  };
  timestamp?: string;
  error?: string;
}

interface WorkerCommandRequest {
  worker: 'allegro' | 'ebay' | 'both';
  command: 'generate-report' | 'sync-inventory' | 'get-orders' | 'get-status';
  params?: Record<string, any>;
}

async function fetchDzidekSales(): Promise<DzidekSalesResponse> {
  try {
    const response = await fetch(`${DZIDEK_URL}/api/warehouse/sales`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      return { success: false, error: `Dzidek returned ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, data, timestamp: new Date().toISOString() };
  } catch (error: any) {
    console.error('[dzidek-sync] Fetch error:', error);
    return { success: false, error: error.message || 'Connection failed' };
  }
}

async function fetchDzidekInventory(): Promise<any> {
  try {
    const response = await fetch(`${DZIDEK_URL}/api/warehouse/inventory`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) return { success: false, error: `Status ${response.status}` };
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendWorkerCommand(worker: string, command: string, params?: Record<string, any>): Promise<any> {
  const workerEndpoint = worker === 'both'
    ? `${DZIDEK_URL}/api/workers/command`
    : `${DZIDEK_URL}/api/worker/${worker}/command`;

  try {
    const response = await fetch(workerEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, params, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) return { success: false, error: `Worker returned ${response.status}` };
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message || 'Worker command failed' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - pobierz dane sprzedażowe
  if (req.method === 'GET') {
    const { type } = req.query;
    try {
      if (type === 'inventory') {
        const inventory = await fetchDzidekInventory();
        return res.status(200).json(inventory);
      }
      const sales = await fetchDzidekSales();
      return res.status(200).json(sales);
    } catch (error: any) {
      console.error('[dzidek-sync] GET error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST - wyślij komendę do workerów
  if (req.method === 'POST') {
    try {
      const body = req.body as WorkerCommandRequest;

      if (!body.worker || !body.command) {
        return res.status(400).json({ success: false, error: 'Missing required fields: worker, command' });
      }

      const validWorkers = ['allegro', 'ebay', 'both'];
      const validCommands = ['generate-report', 'sync-inventory', 'get-orders', 'get-status'];

      if (!validWorkers.includes(body.worker)) {
        return res.status(400).json({ success: false, error: `Invalid worker. Must be: ${validWorkers.join(', ')}` });
      }

      if (!validCommands.includes(body.command)) {
        return res.status(400).json({ success: false, error: `Invalid command. Must be: ${validCommands.join(', ')}` });
      }

      console.log(`[dzidek-sync] Sending command: ${body.command} to ${body.worker}`);
      const result = await sendWorkerCommand(body.worker, body.command, body.params);

      return res.status(200).json({
        success: result.success !== false,
        worker: body.worker,
        command: body.command,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[dzidek-sync] POST error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
