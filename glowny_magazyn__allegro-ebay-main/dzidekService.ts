/**
 * Dzidek Service - zarządzanie połączeniem z workerami Allegro/eBay
 */

import { apiEndpoints } from './apiConfig';

export interface WorkerStatus {
  name: string;
  online: boolean;
  lastSeen?: string;
  error?: string;
}

export interface DzidekStatus {
  online: boolean;
  url: string;
  workers: {
    allegro: WorkerStatus;
    ebay: WorkerStatus;
  };
  lastCheck: string;
  error?: string;
}

export interface WorkerCommandResult {
  success: boolean;
  worker: string;
  command: string;
  result?: any;
  error?: string;
  timestamp: string;
}

class DzidekService {
  private lastStatus: DzidekStatus | null = null;
  private statusCheckInterval: number | null = null;

  /**
   * Sprawdź status Dzidka i workerów
   */
  async checkStatus(): Promise<DzidekStatus> {
    try {
      const response = await fetch(apiEndpoints.dzidekStatus, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      this.lastStatus = await response.json();
      return this.lastStatus;
    } catch (error: any) {
      console.warn('[DzidekService] Status check failed:', error.message);
      return {
        online: false,
        url: 'https://0e784df5af85aaaf-87-179-39-164.serveousercontent.com',
        workers: {
          allegro: { name: 'Allegro Worker', online: false, error: error.message },
          ebay: { name: 'eBay Worker', online: false, error: error.message }
        },
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Pobierz ostatni znany status (bez fetch)
   */
  getLastStatus(): DzidekStatus | null {
    return this.lastStatus;
  }

  /**
   * Wyślij komendę do workera
   */
  async sendCommand(
    worker: 'allegro' | 'ebay',
    command: 'generate-report' | 'sync-inventory' | 'get-orders' | 'get-status',
    params?: Record<string, any>
  ): Promise<WorkerCommandResult> {
    try {
      const response = await fetch(apiEndpoints.workerCommand, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker, command, params }),
      });

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('[DzidekService] Command failed:', error);
      return {
        success: false,
        worker,
        command,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Synchronizuj dane sprzedażowe z Dzidka
   */
  async syncSalesData(): Promise<any> {
    try {
      const response = await fetch(apiEndpoints.dzidekSync, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.warn('[DzidekService] Sync failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pobierz raporty z Allegro
   */
  async generateAllegroReport(date?: string): Promise<WorkerCommandResult> {
    return this.sendCommand('allegro', 'generate-report', { date });
  }

  /**
   * Pobierz raporty z eBay
   */
  async generateEbayReport(date?: string): Promise<WorkerCommandResult> {
    return this.sendCommand('ebay', 'generate-report', { date });
  }

  /**
   * Synchronizuj stan magazynowy
   */
  async syncInventory(worker: 'allegro' | 'ebay'): Promise<WorkerCommandResult> {
    return this.sendCommand(worker, 'sync-inventory');
  }

  /**
   * Pobierz zamówienia
   */
  async getOrders(worker: 'allegro' | 'ebay'): Promise<WorkerCommandResult> {
    return this.sendCommand(worker, 'get-orders');
  }

  /**
   * Uruchom automatyczne sprawdzanie statusu
   */
  startStatusPolling(intervalMs: number = 60000): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
    
    // Sprawdź od razu
    this.checkStatus();
    
    // Potem co X ms
    this.statusCheckInterval = window.setInterval(() => {
      this.checkStatus();
    }, intervalMs);
  }

  /**
   * Zatrzymaj automatyczne sprawdzanie
   */
  stopStatusPolling(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }
}

// Singleton
export const dzidekService = new DzidekService();
export default dzidekService;
