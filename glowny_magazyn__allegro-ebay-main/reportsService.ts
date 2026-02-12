// Service to fetch monthly/quarterly financial reports per channel
// Expected backend response shape:
// {
//   period: string; // e.g. "2025-01" or "2025-Q1"
//   periodType: 'month' | 'quarter';
//   periodLabel?: string;
//   allegro: { revenue?: number; ads?: number; shipping?: number; returns?: number; netProfit?: number; };
//   ebay: { revenue?: number; ads?: number; shipping?: number; returns?: number; netProfit?: number; };
//   purchasesCost?: number;
//   allegroProfit?: number;
//   ebayProfit?: number;
// }

import { ChannelReport, PeriodReport, ReportPeriodType } from './types';

const getEnvVar = (name: string): string => {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[name]) return metaEnv[name];
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name];
    if ((window as any).env && (window as any).env[name]) return (window as any).env[name];
  } catch (e) {}
  return '';
};

// Prefer explicit env; fallback to local API server for development
const REPORTS_ENDPOINT = getEnvVar('VITE_REPORTS_ENDPOINT') || 'http://localhost:3001/api/reports';

const formatPeriodLabel = (periodType: ReportPeriodType, period: string): string => {
  if (periodType === 'quarter') {
    const [year, quarter] = period.split('-');
    return `${year} ${quarter}`;
  }
  const [year, month] = period.split('-');
  const monthInt = Number(month);
  const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  const label = monthInt >= 1 && monthInt <= 12 ? monthNames[monthInt - 1] : month;
  return `${label} ${year}`;
};

const normalizeChannel = (raw: Partial<ChannelReport> | undefined): ChannelReport => ({
  revenue: raw?.revenue ?? 0,
  ads: raw?.ads ?? 0,
  shipping: raw?.shipping ?? 0,
  returns: raw?.returns ?? 0,
  netProfit: raw?.netProfit ?? 0,
});

const emptyReport = (periodType: ReportPeriodType, period: string): PeriodReport => {
  // Zwróć puste dane gdy brak backendu
  return {
    period,
    periodType,
    periodLabel: formatPeriodLabel(periodType, period),
    allegro: {
      revenue: 0,
      ads: 0,
      shipping: 0,
      returns: 0,
      netProfit: 0,
    },
    ebay: {
      revenue: 0,
      ads: 0,
      shipping: 0,
      returns: 0,
      netProfit: 0,
    },
    purchasesCost: 0,
    allegroProfit: 0,
    ebayProfit: 0,
  };
};

const normalizeReport = (raw: any, periodType: ReportPeriodType, period: string): PeriodReport => {
  return {
    period: raw?.period || period,
    periodType: (raw?.periodType as ReportPeriodType) || periodType,
    periodLabel: raw?.periodLabel || formatPeriodLabel(periodType, period),
    allegro: normalizeChannel(raw?.allegro),
    ebay: normalizeChannel(raw?.ebay),
    purchasesCost: raw?.purchasesCost ?? 0,
    allegroProfit: raw?.allegroProfit ?? normalizeChannel(raw?.allegro).netProfit,
    ebayProfit: raw?.ebayProfit ?? normalizeChannel(raw?.ebay).netProfit,
  };
};

export const reportsService = {
  async fetchReport(periodType: ReportPeriodType, period: string): Promise<PeriodReport> {
    if (!REPORTS_ENDPOINT) {
      console.warn('[Reports] Brak VITE_REPORTS_ENDPOINT – brak danych. Ustaw backend, aby widzieć realne liczby.');
      return emptyReport(periodType, period);
    }

    const url = new URL(REPORTS_ENDPOINT);
    url.searchParams.set('periodType', periodType);
    url.searchParams.set('period', period);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`[Reports] ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return normalizeReport(data, periodType, period);
  }
};
