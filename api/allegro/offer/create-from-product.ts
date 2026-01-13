/// <reference path="../../types.d.ts" />
/// <reference types="node" />
import { VercelRequest, VercelResponse } from '@vercel/node';
import { readJsonBody, sendError } from '../../lib/http.js';
import { supabaseService } from '../../lib/supabase.js';
import { createOfferFromProduct } from '../../lib/allegroClient.js';

const INVENTORY_TABLE = 'inventory';
const LOG_TABLE = 'allegro_listings_log';
const LIST_QUANTITY = 5;

const findInventoryRow = async (warehouseItemId: string) => {
  if (!supabaseService) throw new Error('Supabase not configured');
  const { data: byId, error: errById } = await supabaseService
    .from(INVENTORY_TABLE)
    .select('*')
    .eq('id', warehouseItemId)
    .limit(1);
  if (errById) throw errById;
  if (byId && byId.length > 0) return byId[0];

  const { data: bySku, error: errBySku } = await supabaseService
    .from(INVENTORY_TABLE)
    .select('*')
    .eq('sku', warehouseItemId)
    .limit(1);
  if (errBySku) throw errBySku;
  return bySku?.[0] || null;
};

const logAttempt = async (payload: any) => {
  if (!supabaseService) return;
  const { error } = await supabaseService.from(LOG_TABLE).insert(payload);
  if (error) {
    console.error('[offer/create] log insert failed', error.message);
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');
  if (!supabaseService) return sendError(res, 500, 'Supabase not configured');

  try {
    const body = await readJsonBody<{ warehouseItemId?: string; productId?: string; quantity?: number }>(req);
    const warehouseItemId = (body?.warehouseItemId || '').toString().trim();
    const productId = (body?.productId || '').toString().trim();

    if (!warehouseItemId || !productId) {
      return sendError(res, 400, 'warehouseItemId oraz productId są wymagane.');
    }

    const inventoryRow = await findInventoryRow(warehouseItemId);
    if (!inventoryRow) {
      return sendError(res, 404, 'Nie znaleziono towaru w magazynie.');
    }

    const stock = Number(inventoryRow.total_stock) || 0;
    if (stock < LIST_QUANTITY) {
      return sendError(res, 409, 'Za mały stan magazynowy. Potrzeba minimum 5 sztuk.');
    }

    const price = Number(inventoryRow.allegro_price) || 0;
    const payload = {
      productSet: [{ product: { id: productId } }],
      sellingMode: { price: { amount: price.toFixed(2), currency: 'PLN' } },
      stock: { available: LIST_QUANTITY },
      publication: { status: 'ACTIVE' as const },
      external: { id: warehouseItemId },
      name: inventoryRow.name,
    };

    try {
      const offer = await createOfferFromProduct(payload);
      await logAttempt({
        warehouse_item_id: warehouseItemId,
        ean: inventoryRow.ean || null,
        product_id: productId,
        allegro_offer_id: offer?.id || null,
        quantity_listed: LIST_QUANTITY,
        status: 'CREATED',
        error: null,
      });

      return res.status(200).json({
        offerId: offer?.id,
        status: 'CREATED',
        quantityListed: LIST_QUANTITY,
        operationId: offer?.operationId,
      });
    } catch (err: any) {
      const message = err?.message || 'Nie udało się utworzyć oferty w Allegro.';
      await logAttempt({
        warehouse_item_id: warehouseItemId,
        ean: inventoryRow.ean || null,
        product_id: productId,
        allegro_offer_id: null,
        quantity_listed: LIST_QUANTITY,
        status: 'FAILED',
        error: message,
      });
      return sendError(res, 502, message);
    }
  } catch (err: any) {
    console.error('[offer/create] unexpected error', err);
    return sendError(res, 500, err?.message || 'Internal error');
  }
}
