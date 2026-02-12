/**
 * API Configuration - centralized API endpoints
 * Uses relative URLs for Vercel deployment compatibility
 */

const getEnvVar = (name: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as Record<string, string>)[name] || '';
  }
  return '';
};

// Base URL for API - use relative path on Vercel, localhost for dev
const isDev = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1'
);

export const API_BASE = getEnvVar('VITE_API_BASE') || (isDev ? 'http://localhost:3001' : '');

// API Endpoints
export const apiEndpoints = {
  salesSummary: `${API_BASE}/api/sales-summary`,
  dailySales: `${API_BASE}/api/daily-sales`,
  chartData: (period: string, platform: string) => 
    `${API_BASE}/api/chart-data?period=${period}&platform=${platform}`,
  monthlyChartData: (months: number) => 
    `${API_BASE}/api/monthly-chart-data?months=${months}`,
  platformStats: `${API_BASE}/api/platform-stats`,
  exportToSheets: `${API_BASE}/api/export-to-sheets`,
  reports: `${API_BASE}/api/reports`,
  dzidekSync: `${API_BASE}/api/dzidek-sync`,
  workerCommand: `${API_BASE}/api/worker-command`,
};

export default apiEndpoints;
