// Service to connect to local file-based API (http://localhost:3002)
// Replaces Supabase for zero-cost operation

const API_BASE = 'http://localhost:3002';

export type InventoryItem = {
  sku: string;
  name: string;
  purchase_type: string;
  document_type: string;
  document_status: string;
  item_cost: number;
  total_stock: number;
  allegro_price: number;
  ebay_price: number;
  created?: string;
  updated?: string;
};

export type SalesSummary = {
  soldQty: number;
  gross: number;
  shippingCost?: number;
  adsCost?: number;
  feeCost?: number;
};

export type PlatformStats = {
  revenue: number;
  orders: number;
  profit: number;
  currency?: string;
  details?: {
    fees: number;
    shipping: number;
    ads: number;
  };
};

export type DashboardData = {
  timestamp: string;
  today: {
    ebay: PlatformStats;
    allegro: PlatformStats;
  };
  thisMonth: {
    ebay: {
      totalRevenue: number;
      totalOrders: number;
      totalProfit: number;
      daysCount?: number;
      lastUpdated?: string;
    };
    allegro: {
      totalRevenue: number;
      totalOrders: number;
      totalProfit: number;
      daysCount?: number;
      lastUpdated?: string;
    };
  };
  thisQuarter?: {
    ebay: any;
    allegro: any;
  };
  inventory: InventoryItem[];
  inventoryCount: number;
};

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const localApiService = {
  // Dashboard data
  async getDashboard(): Promise<DashboardData> {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/dashboard`);
      if (!response.ok) {
        throw new Error(`Dashboard API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      // Return empty data if API is not available
      return {
        timestamp: new Date().toISOString(),
        today: {
          ebay: { revenue: 0, orders: 0, profit: 0, currency: 'EUR' },
          allegro: { revenue: 0, orders: 0, profit: 0, currency: 'PLN' }
        },
        thisMonth: {
          ebay: { totalRevenue: 0, totalOrders: 0, totalProfit: 0 },
          allegro: { totalRevenue: 0, totalOrders: 0, totalProfit: 0 }
        },
        inventory: [],
        inventoryCount: 0
      };
    }
  },

  // Inventory
  async getInventory(): Promise<InventoryItem[]> {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/inventory`);
      if (!response.ok) {
        throw new Error(`Inventory API error: ${response.status}`);
      }
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      return [];
    }
  },

  async updateInventoryItem(sku: string, updates: Partial<InventoryItem>): Promise<void> {
    // Note: Our API is read-only for now
    // In future, we can implement write endpoints
    console.log(`Would update item ${sku}:`, updates);
    // For now, just log - data is saved by workers
  },

  async createInventoryItem(item: Omit<InventoryItem, 'created' | 'updated'>): Promise<InventoryItem> {
    // Note: Our API is read-only for now
    const newItem = {
      ...item,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    console.log('Would create item:', newItem);
    return newItem as InventoryItem;
  },

  // Reports
  async getReports(periodType: 'month' | 'quarter' = 'month', period?: string) {
    try {
      const url = new URL(`${API_BASE}/api/reports`);
      url.searchParams.set('periodType', periodType);
      if (period) {
        url.searchParams.set('period', period);
      }
      
      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) {
        throw new Error(`Reports API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      return {
        period: period || 'current',
        periodType,
        allegro: { revenue: 0, ads: 0, shipping: 0, returns: 0, netProfit: 0 },
        ebay: { revenue: 0, ads: 0, shipping: 0, returns: 0, netProfit: 0 },
        purchasesCost: 0,
        allegroProfit: 0,
        ebayProfit: 0
      };
    }
  },

  // Sales summary (by SKU)
  async getSalesSummary(): Promise<Record<string, SalesSummary>> {
    // Note: Our API doesn't have SKU-level sales yet
    // For now, return empty
    return {};
  },

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/health`, {}, 2000);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
};

// Export singleton
export default localApiService;