import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * API Endpoint: /api/messages
 * Obsługa wiadomości od klientów (eBay / Allegro)
 * 
 * GET  - Pobierz listę wiadomości
 * POST - Odbierz nową wiadomość od workera
 * PUT  - Aktualizuj status wiadomości
 */

interface CustomerMessage {
  id: string;
  platform: 'ebay' | 'allegro';
  customerId: string;
  customerName: string;
  customerEmail?: string;
  orderId?: string;
  orderNumber?: string;
  itemSku?: string;
  itemTitle?: string;
  subject: string;
  body: string;
  receivedAt: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  isQuestion: boolean;
  isComplaint: boolean;
  isReturn: boolean;
  requiresAction: boolean;
  tags?: string[];
}

// In-memory storage (w produkcji użyć Supabase)
let messagesStore: CustomerMessage[] = [];

// Statystyki
const getStats = () => ({
  total: messagesStore.length,
  unread: messagesStore.filter(m => m.status === 'unread').length,
  requiresAction: messagesStore.filter(m => m.requiresAction).length,
  byPlatform: {
    ebay: {
      total: messagesStore.filter(m => m.platform === 'ebay').length,
      unread: messagesStore.filter(m => m.platform === 'ebay' && m.status === 'unread').length,
    },
    allegro: {
      total: messagesStore.filter(m => m.platform === 'allegro').length,
      unread: messagesStore.filter(m => m.platform === 'allegro' && m.status === 'unread').length,
    },
  },
  byCategory: {
    questions: messagesStore.filter(m => m.isQuestion).length,
    complaints: messagesStore.filter(m => m.isComplaint).length,
    returns: messagesStore.filter(m => m.isReturn).length,
    other: messagesStore.filter(m => !m.isQuestion && !m.isComplaint && !m.isReturn).length,
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Agent-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - Pobierz wiadomości
    if (req.method === 'GET') {
      const { platform, status, limit = '50', offset = '0' } = req.query;
      
      let filtered = [...messagesStore];
      
      if (platform && typeof platform === 'string') {
        filtered = filtered.filter(m => m.platform === platform);
      }
      
      if (status && typeof status === 'string') {
        filtered = filtered.filter(m => m.status === status);
      }
      
      // Sortuj od najnowszych
      filtered.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      
      // Paginacja
      const start = parseInt(offset as string, 10);
      const end = start + parseInt(limit as string, 10);
      const paginated = filtered.slice(start, end);
      
      return res.status(200).json({
        messages: paginated,
        total: filtered.length,
        stats: getStats(),
        timestamp: new Date().toISOString(),
      });
    }

    // POST - Nowa wiadomość od workera
    if (req.method === 'POST') {
      const { from, action, data } = req.body;
      
      console.log(`[Messages] Received from ${from}: action=${action}`);
      
      if (action === 'new-message' && data) {
        const message: CustomerMessage = {
          id: data.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          platform: data.platform || (from === 'ebay-worker' ? 'ebay' : 'allegro'),
          customerId: data.customerId || 'unknown',
          customerName: data.customerName || 'Nieznany klient',
          customerEmail: data.customerEmail,
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          itemSku: data.itemSku,
          itemTitle: data.itemTitle,
          subject: data.subject || '(Brak tematu)',
          body: data.body || data.message || '',
          receivedAt: data.receivedAt || new Date().toISOString(),
          status: 'unread',
          priority: data.priority || 'normal',
          isQuestion: data.isQuestion || false,
          isComplaint: data.isComplaint || false,
          isReturn: data.isReturn || false,
          requiresAction: data.requiresAction ?? true,
          tags: data.tags || [],
        };
        
        // Sprawdź czy nie duplikat
        const exists = messagesStore.find(m => m.id === message.id);
        if (!exists) {
          messagesStore.unshift(message);
          console.log(`[Messages] Added new message: ${message.id} from ${message.customerName}`);
        }
        
        return res.status(201).json({
          success: true,
          message: 'Wiadomość dodana',
          messageId: message.id,
          stats: getStats(),
        });
      }
      
      if (action === 'bulk-messages' && Array.isArray(data)) {
        let added = 0;
        for (const msg of data) {
          const id = msg.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const exists = messagesStore.find(m => m.id === id);
          if (!exists) {
            messagesStore.unshift({
              ...msg,
              id,
              status: 'unread',
              receivedAt: msg.receivedAt || new Date().toISOString(),
            });
            added++;
          }
        }
        
        console.log(`[Messages] Bulk added ${added} messages`);
        
        return res.status(201).json({
          success: true,
          message: `Dodano ${added} wiadomości`,
          added,
          stats: getStats(),
        });
      }
      
      return res.status(400).json({ error: 'Invalid action or missing data' });
    }

    // PUT - Aktualizuj status wiadomości
    if (req.method === 'PUT') {
      const { messageId, status, reply } = req.body;
      
      const message = messagesStore.find(m => m.id === messageId);
      if (!message) {
        return res.status(404).json({ error: 'Wiadomość nie znaleziona' });
      }
      
      if (status) {
        message.status = status;
      }
      
      if (reply) {
        message.status = 'replied';
        message.requiresAction = false;
      }
      
      console.log(`[Messages] Updated message ${messageId}: status=${message.status}`);
      
      return res.status(200).json({
        success: true,
        message: 'Wiadomość zaktualizowana',
        data: message,
        stats: getStats(),
      });
    }

    // DELETE - Usuń/archiwizuj wiadomość
    if (req.method === 'DELETE') {
      const { messageId } = req.query;
      
      if (typeof messageId !== 'string') {
        return res.status(400).json({ error: 'Missing messageId' });
      }
      
      const index = messagesStore.findIndex(m => m.id === messageId);
      if (index === -1) {
        return res.status(404).json({ error: 'Wiadomość nie znaleziona' });
      }
      
      // Archiwizuj zamiast usuwać
      messagesStore[index].status = 'archived';
      
      return res.status(200).json({
        success: true,
        message: 'Wiadomość zarchiwizowana',
        stats: getStats(),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error: any) {
    console.error('[Messages] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error?.message 
    });
  }
}
