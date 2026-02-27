/**
 * Dzidek Sync endpoint - komunikacja z zewnętrznymi API
 * GET: pobiera dane sprzedażowe z nowego Google Apps Script
 * POST: wysyła komendy do workerów Dzidka
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PlatformReport } from '../glowny_magazyn__allegro-ebay-main/types';

export const runtime = 'nodejs';

// Endpoint GAS wprowadzony przez użytkownika (Uwaga: to link do edytora, do działania w produkcji wymagany jest link Deploy /exec)
const GAS_URL = 'https://script.google.com/u/0/home/projects/1Sh_brzCdhNclr77chHZZyWfRzhMhTYKiHKrci9STvF32tNv9aqB_bg1X/edit';
const DZIDEK_URL = 'https://api.dzidek.de';
const REQUEST_TIMEOUT = 30000;

interface WorkerCommandRequest {
  worker: 'allegro' | 'ebay' | 'both';
  command: 'generate-report' | 'sync-inventory' | 'get-orders' | 'get-status';
  params?: Record<string, any>;
}

async function fetchGasReport(): Promise<{ success: boolean; data?: { allegro: PlatformReport }; timestamp?: string; error?: string }> {
  try {
    const response = await fetch(GAS_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      return { success: false, error: `Google Apps Script returned ${response.status}: ${response.statusText}` };
    }

    const gasData = await response.json();
    return {
      success: true,
      data: {
        allegro: gasData as PlatformReport,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('[dzidek-sync] Fetch GAS error:', error);
    return { success: false, error: error.message || 'Connection failed' };
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

  // GET - pobierz dane sprzedażowe (GAS)
  if (req.method === 'GET') {
    try {
      const sales = await fetchGasReport();
      return res.status(200).json(sales);
    } catch (error: any) {
      console.error('[dzidek-sync] GET error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST - wyślij komendę do workerów (Legacy API)
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
