
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
