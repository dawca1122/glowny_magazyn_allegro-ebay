
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
  
  // Nowe pola do synchronizacji eBay <-> Allegro
  ean?: string;                    // Kod EAN - klucz łączący eBay z Allegro
  image_url?: string;              // URL zdjęcia produktu
  ebay_sku?: string;               // SKU na eBay
  ebay_title?: string;             // Tytuł ogłoszenia eBay
  ebay_stock?: number;             // Stan magazynowy eBay
  allegro_sku?: string;            // SKU na Allegro (do wpisania ręcznie)
  allegro_title?: string;          // Tytuł ogłoszenia Allegro
  allegro_stock?: number;          // Stan magazynowy Allegro
  allegro_listing_id?: string;     // ID ogłoszenia Allegro (jeśli już wystawione)
  sync_status?: 'not_synced' | 'pending' | 'synced';  // Status synchronizacji
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

export type AllegroCatalogItem = {
  productId: string;
  title: string;
  mainImageUrl?: string;
  images?: string[];
  categoryId?: string;
  score: number;
  reason: string[];
};

export type AllegroSearchResponse = {
  ean: string;
  top3: AllegroCatalogItem[];
};

// Nowe typy dla szczegółowych raportów
export type ReportType = 'weekly' | 'monthly' | 'quarterly';

export interface DetailedCosts {
  shipping: number;      // Koszty wysyłki
  ads: number;          // Koszty reklam
  returns: number;      // Zwroty/refundy
  fees: number;         // Prowizje platform
  taxes: number;        // Podatki/VAT
  products: number;     // Koszty produktów
  other: number;        // Inne koszty
}

export interface PlatformReport {
  platform: 'ebay' | 'allegro';
  period: string; // YYYY-MM-DD dla weekly, YYYY-MM dla monthly, YYYY-Q1 itp
  reportType: ReportType;
  
  // Podstawowe dane
  revenue: number;      // Przychód brutto
  orders: number;       // Liczba zamówień
  itemsSold: number;    // Liczba sprzedanych sztuk
  
  // Szczegółowe koszty
  costs: DetailedCosts;
  
  // Zyski
  grossProfit: number;  // Zysk brutto (revenue - products)
  netProfit: number;    // Zysk netto (revenue - wszystkie koszty)
  
  // Metadane
  generatedAt: string;
  currency: string;     // EUR dla eBay, PLN dla Allegro
}

export interface CombinedReport {
  period: string;
  reportType: ReportType;
  
  // Suma obu platform
  totalRevenue: number;
  totalOrders: number;
  totalItemsSold: number;
  
  // Szczegółowe koszty (suma)
  totalCosts: DetailedCosts;
  
  // Zyski
  totalGrossProfit: number;
  totalNetProfit: number;
  
  // Per platform (dla podziału)
  ebay: Omit<PlatformReport, 'platform' | 'period' | 'reportType' | 'generatedAt'>;
  allegro: Omit<PlatformReport, 'platform' | 'period' | 'reportType' | 'generatedAt'>;
  
  // Metadane
  generatedAt: string;
  note?: string;
}
