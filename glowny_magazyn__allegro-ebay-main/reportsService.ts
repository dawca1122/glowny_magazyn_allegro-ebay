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

// Prefer explicit env; fallback to same-origin API to avoid missing/incorrect URL issues
const REPORTS_ENDPOINT = getEnvVar('VITE_REPORTS_ENDPOINT') || '/api/reports';

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

const mockReport = (periodType: ReportPeriodType, period: string): PeriodReport => {
  // Deterministyczny mock na potrzeby dev, gdy brak backendu
  const seed = period.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const base = 10000 + (seed % 2000);
  const allegroAds = 500 + (seed % 200);
  const ebayAds = 350 + (seed % 150);
  const allegroShipping = 800 + (seed % 180);
  const ebayShipping = 650 + (seed % 160);
  const allegroReturns = 200 + (seed % 80);
  const ebayReturns = 180 + (seed % 70);
  const purchasesCost = 6000 + (seed % 1200);

  return {
    period,
    periodType,
    periodLabel: formatPeriodLabel(periodType, period),
    allegro: {
      revenue: base + 1500,
      ads: allegroAds,
      shipping: allegroShipping,
      returns: allegroReturns,
      netProfit: base - allegroAds - allegroShipping - allegroReturns,
    },
    ebay: {
      revenue: base,
      ads: ebayAds,
      shipping: ebayShipping,
      returns: ebayReturns,
      netProfit: base - ebayAds - ebayShipping - ebayReturns,
    },
    purchasesCost,
    allegroProfit: base - allegroAds - allegroShipping - allegroReturns,
    ebayProfit: base - ebayAds - ebayShipping - ebayReturns,
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
      console.warn('[Reports] Brak VITE_REPORTS_ENDPOINT – używam mock danych dev. Ustaw backend, aby widzieć realne liczby.');
      return mockReport(periodType, period);
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
