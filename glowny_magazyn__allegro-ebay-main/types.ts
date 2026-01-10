
export type PurchaseType = 'Faktura' | 'Gotówka';
export type DocumentType = 'Typ A' | 'Typ B' | 'Typ C' | 'Typ D' | 'Typ E' | 'Typ F';
export type DocumentStatus = 'Oczekuje' | 'Pobrano';

export interface InventoryItem {
  id?: number;
  name: string;
  sku: string;
  purchase_type: PurchaseType;
  document_type: DocumentType;
  document_status: DocumentStatus;
  doc_status?: DocumentStatus;
  item_cost: number;
  total_stock: number; // Zmienione z total_quantity
  allegro_price: number;
  ebay_price: number;
  created_at?: string;
}

export interface SyncPayload {
  items: {
    sku: string;
    stock_warehouse: number;
  }[];
}

export type SalesSummaryEntry = {
  soldQty: number;
  gross: number;
  shippingCost?: number;
  adsCost?: number;
  feeCost?: number;
};
export type SalesSummaryMap = Record<string, SalesSummaryEntry>;

export type ReportPeriodType = 'month' | 'quarter';

export type ChannelReport = {
  revenue?: number;
  ads: number;
  shipping: number;
  returns: number;
  netProfit: number;
};

export interface PeriodReport {
  period: string;
  periodType: ReportPeriodType;
  periodLabel: string;
  allegro: ChannelReport;
  ebay: ChannelReport;
  purchasesCost: number;
  allegroProfit: number;
  ebayProfit: number;
}
