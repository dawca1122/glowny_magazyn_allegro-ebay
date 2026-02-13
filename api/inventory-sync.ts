/**
 * Inventory Sync API - pobiera produkty z Allegro i eBay API
 * GET /api/inventory-sync - pobiera wszystkie oferty z platform
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

const ALLEGRO_API_URL = 'https://api.allegro.pl';
const ALLEGRO_AUTH_URL = 'https://allegro.pl/auth/oauth/token';

// Allegro credentials
const allegroClientId = process.env.ALLEGRO_CLIENT_ID || '';
const allegroClientSecret = process.env.ALLEGRO_CLIENT_SECRET || '';
const allegroRefreshToken = process.env.ALLEGRO_REFRESH_TOKEN || '';

// eBay credentials (jeśli dostępne)
const ebayClientId = process.env.EBAY_CLIENT_ID || '';
const ebayClientSecret = process.env.EBAY_CLIENT_SECRET || '';
const ebayRefreshToken = process.env.EBAY_REFRESH_TOKEN || '';

interface InventoryItem {
  sku: string;
  name: string;
  ean?: string;
  price: number;
  stock: number;
  platform: 'allegro' | 'ebay';
  external_id: string;
  image_url?: string;
  status: string;
  currency: string;
}

// ========== ALLEGRO ==========

async function getAllegroAccessToken(): Promise<string | null> {
  if (!allegroClientId || !allegroClientSecret || !allegroRefreshToken) {
    console.log('[inventory-sync] Brak credentials Allegro');
    return null;
  }

  try {
    const basicAuth = Buffer.from(`${allegroClientId}:${allegroClientSecret}`).toString('base64');
    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', allegroRefreshToken);

    const res = await fetch(ALLEGRO_AUTH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      console.error('[inventory-sync] Allegro token error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.access_token;
  } catch (error) {
    console.error('[inventory-sync] Allegro auth error:', error);
    return null;
  }
}

async function fetchAllegroOffers(accessToken: string): Promise<InventoryItem[]> {
  const items: InventoryItem[] = [];
  let offset = 0;
  const limit = 100;

  try {
    while (true) {
      const url = new URL(`${ALLEGRO_API_URL}/sale/offers`);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('publication.status', 'ACTIVE'); // Tylko aktywne oferty

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.allegro.public.v1+json',
        },
      });

      if (!res.ok) {
        console.error('[inventory-sync] Allegro offers error:', res.status);
        break;
      }

      const data = await res.json();
      const offers = data?.offers || [];
      
      for (const offer of offers) {
        items.push({
          sku: offer.external?.id || offer.id,
          name: offer.name || 'Bez nazwy',
          ean: offer.ean || offer.product?.ean,
          price: parseFloat(offer.sellingMode?.price?.amount || '0'),
          stock: offer.stock?.available || 0,
          platform: 'allegro',
          external_id: offer.id,
          image_url: offer.primaryImage?.url,
          status: offer.publication?.status || 'UNKNOWN',
          currency: offer.sellingMode?.price?.currency || 'PLN',
        });
      }

      console.log(`[inventory-sync] Allegro: załadowano ${items.length} ofert (offset=${offset})`);

      if (offers.length < limit) break;
      offset += limit;
      
      // Safety limit
      if (offset > 10000) break;
    }
  } catch (error) {
    console.error('[inventory-sync] Allegro fetch error:', error);
  }

  return items;
}

// ========== EBAY ==========

async function getEbayAccessToken(): Promise<string | null> {
  if (!ebayClientId || !ebayClientSecret || !ebayRefreshToken) {
    console.log('[inventory-sync] Brak credentials eBay');
    return null;
  }

  try {
    const basicAuth = Buffer.from(`${ebayClientId}:${ebayClientSecret}`).toString('base64');
    
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: ebayRefreshToken,
        scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory',
      }).toString(),
    });

    if (!res.ok) {
      console.error('[inventory-sync] eBay token error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.access_token;
  } catch (error) {
    console.error('[inventory-sync] eBay auth error:', error);
    return null;
  }
}

async function fetchEbayInventory(accessToken: string): Promise<InventoryItem[]> {
  const items: InventoryItem[] = [];
  let offset = 0;
  const limit = 100;

  try {
    while (true) {
      const url = new URL('https://api.ebay.com/sell/inventory/v1/inventory_item');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE', // Niemiecki marketplace
        },
      });

      if (!res.ok) {
        console.error('[inventory-sync] eBay inventory error:', res.status);
        break;
      }

      const data = await res.json();
      const inventoryItems = data?.inventoryItems || [];
      
      for (const item of inventoryItems) {
        items.push({
          sku: item.sku,
          name: item.product?.title || item.sku,
          ean: item.product?.ean?.[0],
          price: parseFloat(item.offers?.[0]?.pricingSummary?.price?.value || '0'),
          stock: item.availability?.shipToLocationAvailability?.quantity || 0,
          platform: 'ebay',
          external_id: item.sku,
          image_url: item.product?.imageUrls?.[0],
          status: item.availability ? 'ACTIVE' : 'INACTIVE',
          currency: item.offers?.[0]?.pricingSummary?.price?.currency || 'EUR',
        });
      }

      console.log(`[inventory-sync] eBay: załadowano ${items.length} produktów (offset=${offset})`);

      if (inventoryItems.length < limit) break;
      offset += limit;
      
      // Safety limit
      if (offset > 10000) break;
    }
  } catch (error) {
    console.error('[inventory-sync] eBay fetch error:', error);
  }

  return items;
}

// ========== HANDLER ==========

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
  
  const results = {
    success: true,
    allegro: { items: [] as InventoryItem[], count: 0, status: 'pending' as string },
    ebay: { items: [] as InventoryItem[], count: 0, status: 'pending' as string },
    combined: [] as InventoryItem[],
    totalCount: 0,
    duration: 0,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Pobierz z Allegro
    console.log('[inventory-sync] Rozpoczynam sync z Allegro...');
    const allegroToken = await getAllegroAccessToken();
    if (allegroToken) {
      const allegroItems = await fetchAllegroOffers(allegroToken);
      results.allegro.items = allegroItems;
      results.allegro.count = allegroItems.length;
      results.allegro.status = 'success';
      results.combined.push(...allegroItems);
    } else {
      results.allegro.status = 'no_credentials';
    }

    // 2. Pobierz z eBay
    console.log('[inventory-sync] Rozpoczynam sync z eBay...');
    const ebayToken = await getEbayAccessToken();
    if (ebayToken) {
      const ebayItems = await fetchEbayInventory(ebayToken);
      results.ebay.items = ebayItems;
      results.ebay.count = ebayItems.length;
      results.ebay.status = 'success';
      results.combined.push(...ebayItems);
    } else {
      results.ebay.status = 'no_credentials';
    }

    results.totalCount = results.combined.length;
    results.duration = Date.now() - startTime;

    console.log(`[inventory-sync] Sync zakończony: Allegro=${results.allegro.count}, eBay=${results.ebay.count}, Total=${results.totalCount}`);

    return res.status(200).json(results);

  } catch (error: any) {
    console.error('[inventory-sync] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      allegro: results.allegro,
      ebay: results.ebay,
      combined: [],
      totalCount: 0,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  }
}
