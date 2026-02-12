/**
 * Worker Command endpoint - wysyłanie komend do workerów Allegro/eBay
 * POST /api/worker-command
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const DZIDEK_URL = 'https://api.dzidek.de';
const REQUEST_TIMEOUT = 60000;

type WorkerType = 'allegro' | 'ebay';
type CommandType = 'generate-report' | 'sync-inventory' | 'get-orders' | 'get-status' | 'refresh-token';

interface WorkerCommandBody {
  worker: WorkerType;
  command: CommandType;
  params?: { date?: string; period?: 'daily' | 'weekly' | 'monthly'; forceRefresh?: boolean; [key: string]: any };
}

interface WorkerResponse {
  success: boolean;
  worker: WorkerType;
  command: CommandType;
  data?: any;
  error?: string;
  executedAt: string;
  duration?: number;
}

async function executeWorkerCommand(worker: WorkerType, command: CommandType, params?: Record<string, any>): Promise<WorkerResponse> {
  const startTime = Date.now();

  const commandEndpoints: Record<CommandType, string> = {
    'generate-report': `/api/worker/${worker}/generate-report`,
    'sync-inventory': `/api/worker/${worker}/sync-inventory`,
    'get-orders': `/api/worker/${worker}/orders`,
    'get-status': `/api/worker/${worker}/status`,
    'refresh-token': `/api/worker/${worker}/refresh-token`,
  };

  const endpoint = commandEndpoints[command];
  if (!endpoint) {
    return { success: false, worker, command, error: `Unknown command: ${command}`, executedAt: new Date().toISOString() };
  }

  try {
    const url = `${DZIDEK_URL}${endpoint}`;
    console.log(`[worker-command] Executing: ${command} on ${worker} via ${url}`);

    const isGetRequest = command === 'get-status' || command === 'get-orders';
    const method = isGetRequest ? 'GET' : 'POST';

    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    };

    if (!isGetRequest && params) {
      fetchOptions.body = JSON.stringify({ ...params, requestedAt: new Date().toISOString() });
    }

    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { success: false, worker, command, error: `Worker returned ${response.status}: ${errorText}`, executedAt: new Date().toISOString(), duration };
    }

    const data = await response.json();
    return { success: true, worker, command, data, executedAt: new Date().toISOString(), duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[worker-command] Error executing ${command} on ${worker}:`, error);
    return { success: false, worker, command, error: error.message || 'Connection failed', executedAt: new Date().toISOString(), duration };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = req.body as WorkerCommandBody;

    if (!body.worker) {
      return res.status(400).json({ success: false, error: 'Missing required field: worker (allegro | ebay)' });
    }

    if (!body.command) {
      return res.status(400).json({ success: false, error: 'Missing required field: command' });
    }

    const validWorkers: WorkerType[] = ['allegro', 'ebay'];
    const validCommands: CommandType[] = ['generate-report', 'sync-inventory', 'get-orders', 'get-status', 'refresh-token'];

    if (!validWorkers.includes(body.worker)) {
      return res.status(400).json({ success: false, error: `Invalid worker "${body.worker}". Valid: ${validWorkers.join(', ')}` });
    }

    if (!validCommands.includes(body.command)) {
      return res.status(400).json({ success: false, error: `Invalid command "${body.command}". Valid: ${validCommands.join(', ')}` });
    }

    console.log(`[worker-command] Request: ${body.worker} - ${body.command}`, body.params);
    const result = await executeWorkerCommand(body.worker, body.command, body.params);

    return res.status(result.success ? 200 : 502).json(result);
  } catch (error: any) {
    console.error('[worker-command] Handler error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}
