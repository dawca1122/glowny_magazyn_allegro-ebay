/**
 * Messages Service - obsługa wiadomości od klientów
 * Komunikacja z API /api/messages
 */

import { CustomerMessage, MessagesStats, MessageStatus } from './types';
import apiEndpoints from './apiConfig';

const API_BASE = apiEndpoints.salesSummary.replace('/api/sales-summary', '');

class MessagesService {
  private baseUrl = `${API_BASE}/api/messages`;

  /**
   * Pobierz listę wiadomości
   */
  async getMessages(options?: {
    platform?: 'ebay' | 'allegro';
    status?: MessageStatus;
    limit?: number;
    offset?: number;
  }): Promise<{
    messages: CustomerMessage[];
    total: number;
    stats: MessagesStats;
  }> {
    const params = new URLSearchParams();
    
    if (options?.platform) params.append('platform', options.platform);
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    
    const url = `${this.baseUrl}${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Pobierz tylko statystyki
   */
  async getStats(): Promise<MessagesStats> {
    const { stats } = await this.getMessages({ limit: 1 });
    return stats;
  }

  /**
   * Oznacz wiadomość jako przeczytaną
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.updateMessage(messageId, { status: 'read' });
  }

  /**
   * Oznacz wiadomość jako odpowiedzianą
   */
  async markAsReplied(messageId: string, reply?: string): Promise<void> {
    await this.updateMessage(messageId, { status: 'replied', reply });
  }

  /**
   * Archiwizuj wiadomość
   */
  async archive(messageId: string): Promise<void> {
    await this.updateMessage(messageId, { status: 'archived' });
  }

  /**
   * Aktualizuj wiadomość
   */
  async updateMessage(messageId: string, updates: {
    status?: MessageStatus;
    reply?: string;
  }): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, ...updates }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update message: ${response.status}`);
    }
  }

  /**
   * Pobierz nieprzeczytane wiadomości
   */
  async getUnread(): Promise<CustomerMessage[]> {
    const { messages } = await this.getMessages({ status: 'unread' });
    return messages;
  }

  /**
   * Pobierz wiadomości wymagające akcji
   */
  async getRequiringAction(): Promise<CustomerMessage[]> {
    const { messages } = await this.getMessages();
    return messages.filter(m => m.requiresAction && m.status !== 'archived');
  }

  /**
   * Pobierz wiadomości dla konkretnego zamówienia
   */
  async getByOrder(orderId: string): Promise<CustomerMessage[]> {
    const { messages } = await this.getMessages();
    return messages.filter(m => m.orderId === orderId);
  }

  /**
   * Pobierz wiadomości dla konkretnego produktu (SKU)
   */
  async getBySku(sku: string): Promise<CustomerMessage[]> {
    const { messages } = await this.getMessages();
    return messages.filter(m => m.itemSku === sku);
  }
}

export const messagesService = new MessagesService();
export default messagesService;
