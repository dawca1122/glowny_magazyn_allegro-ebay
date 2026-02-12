/**
 * Dzidek Status & Workers Management endpoint
 * GET /api/dzidek-status - sprawdza status Dzidka i workerów
 * POST /api/dzidek-status - wysyła komendę do workerów
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const DZIDEK_URL = 'https://api.dzidek.de';
const REQUEST_TIMEOUT = 10000;

interface WorkerStatus {
  name: string;
  online: boolean;
  lastSeen?: string;
  error?: string;
}

interface DzidekStatus {
  online: boolean;
  url: string;
  workers: {
    allegro: WorkerStatus;
    ebay: WorkerStatus;
  };
  lastCheck: string;
  error?: string;
}

async function checkDzidekStatus(): Promise<DzidekStatus> {
  const status: DzidekStatus = {
    online: false,
    url: DZIDEK_URL,
    workers: {
      allegro: { name: 'Allegro Worker', online: false },
      ebay: { name: 'eBay Worker', online: false }
    },
    lastCheck: new Date().toISOString()
  };

  try {
    // Sprawdź główny endpoint
    const mainResponse = await fetch(`${DZIDEK_URL}/api/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (mainResponse.ok) {
      status.online = true;
      const data = await mainResponse.json();
      
      // Pobierz status workerów z odpowiedzi
      if (data.workers) {
        status.workers.allegro.online = data.workers.allegro?.online || false;
        status.workers.allegro.lastSeen = data.workers.allegro?.lastSeen;
        status.workers.ebay.online = data.workers.ebay?.online || false;
        status.workers.ebay.lastSeen = data.workers.ebay?.lastSeen;
      }
    }
  } catch (error: any) {
    status.error = error.message || 'Connection failed';
    
    // Spróbuj alternatywnych endpointów
    try {
      const healthCheck = await fetch(`${DZIDEK_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (healthCheck.ok) {
        status.online = true;
        status.error = 'Main API unavailable but server is running';
      }
    } catch {
      // Ignoruj
    }
  }

  // Spróbuj sprawdzić każdego workera osobno
  try {
    const allegroCheck = await fetch(`${DZIDEK_URL}/api/worker/allegro/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (allegroCheck.ok) {
      status.workers.allegro.online = true;
      const data = await allegroCheck.json();
      status.workers.allegro.lastSeen = data.lastSeen || new Date().toISOString();
    }
  } catch (e: any) {
    status.workers.allegro.error = e.message;
  }

  try {
    const ebayCheck = await fetch(`${DZIDEK_URL}/api/worker/ebay/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (ebayCheck.ok) {
      status.workers.ebay.online = true;
      const data = await ebayCheck.json();
      status.workers.ebay.lastSeen = data.lastSeen || new Date().toISOString();
    }
  } catch (e: any) {
    status.workers.ebay.error = e.message;
  }

  return status;
}

async function sendWorkerCommand(worker: string, command: string, params?: any): Promise<any> {
  const endpoint = `${DZIDEK_URL}/api/worker/${worker}/command`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, params, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return { success: false, error: `Worker returned ${response.status}` };
    }

    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - sprawdź status
  if (req.method === 'GET') {
    try {
      const status = await checkDzidekStatus();
      return res.status(200).json(status);
    } catch (error: any) {
      return res.status(500).json({ 
        online: false, 
        error: error.message,
        lastCheck: new Date().toISOString()
      });
    }
  }

  // POST - wyślij komendę
  if (req.method === 'POST') {
    try {
      const { worker, command, params } = req.body;

      if (!worker || !command) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing worker or command' 
        });
      }

      const result = await sendWorkerCommand(worker, command, params);
      return res.status(200).json({
        success: result.success !== false,
        worker,
        command,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
