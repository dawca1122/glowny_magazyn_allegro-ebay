/**
 * API Configuration - centralized API endpoints
 * Frontend łączy się z API Dzidka (publiczny tunel)
 */

const getEnvVar = (name: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as Record<string, string>)[name] || '';
  }
  return '';
};

// Dzidek API URL - główne źródło danych
const DZIDEK_API = getEnvVar('VITE_DZIDEK_API') || 'https://api.dzidek.de';

// Local dev fallback
const isDev = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

// Dla Vercel używamy relative paths do własnych API (które proxy do Dzidka)
// Dla localhost używamy bezpośrednio Dzidka lub localhost:3001
export const API_BASE = getEnvVar('VITE_API_BASE') || 'http://localhost:3001';

// Dzidek endpoints - główne źródło prawdziwych danych
export const dzidekEndpoints = {
  appData: `${DZIDEK_API}/api/app-data`,
  dailySales: `${DZIDEK_API}/api/daily-sales`,
  salesSummary: `${DZIDEK_API}/api/sales-summary`,
  status: `${DZIDEK_API}/api/status`,
  workerAllegro: `${DZIDEK_API}/api/worker/allegro`,
  workerEbay: `${DZIDEK_API}/api/worker/ebay`,
  messages: `${DZIDEK_API}/api/messages`,
};

// API Endpoints - własne API (Vercel functions)
export const apiEndpoints = {
  // Własne endpointy (fallback/cache)
  salesSummary: `${API_BASE}/api/sales-summary`,
  dailySales: `${API_BASE}/api/daily-sales`,
  chartData: (period: string, platform: string) =>
    `${API_BASE}/api/chart-data?period=${period}&platform=${platform}`,
  monthlyChartData: (months: number) =>
    `${API_BASE}/api/monthly-chart-data?months=${months}`,
  platformStats: `${API_BASE}/api/platform-stats`,
  exportToSheets: `${API_BASE}/api/export-to-sheets`,
  inventorySheets: `${API_BASE}/api/inventory-sheets`,
  reports: `${API_BASE}/api/reports`,
  dzidekSync: `${API_BASE}/api/dzidek-sync`,
  dzidekStatus: `${API_BASE}/api/dzidek-status`,
  workerCommand: `${API_BASE}/api/worker-command`,
  messages: `${API_BASE}/api/messages`,

  // Bezpośrednie połączenie z Dzidkiem
  dzidek: dzidekEndpoints,
};

export default apiEndpoints;
