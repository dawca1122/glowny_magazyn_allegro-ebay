import { VercelRequest, VercelResponse } from '@vercel/node';
import { readJsonBody, sendError } from '../../lib/http';
import { supabaseService } from '../../lib/supabase';
import { fetchProductDetail, searchProductsByEan, AllegroProductDetail } from '../../lib/allegroClient';
import { rankProducts } from '../../lib/catalogRanking';
import { isValidEan } from '../../lib/geminiEanScanner';

const CACHE_TABLE = 'allegro_product_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DETAILS = 10;

const loadFromCache = async (productId: string): Promise<AllegroProductDetail | null> => {
  if (!supabaseService) return null;
  const { data, error } = await supabaseService
    .from(CACHE_TABLE)
    .select('*')
    .eq('product_id', productId)
    .limit(1);
  if (error) {
    console.error('[catalog/search] cache fetch error', error.message);
    return null;
  }
  const row = data?.[0];
  if (!row) return null;
  const isFresh = row.fetched_at && new Date(row.fetched_at).getTime() > Date.now() - CACHE_TTL_MS;
  if (!isFresh) return null;
  return row.payload as AllegroProductDetail;
};

const saveToCache = async (productId: string, ean: string, detail: AllegroProductDetail, score: number) => {
  if (!supabaseService) return;
  const mainImageUrl = (detail.images || []).find(img => !!img?.url)?.url;
  const payload = {
    product_id: productId,
    ean,
    payload: detail as any,
    main_image_url: mainImageUrl,
    title: (detail as any)?.name,
    score,
    fetched_at: new Date().toISOString(),
  };
  const { error } = await supabaseService.from(CACHE_TABLE).upsert(payload, { onConflict: 'product_id' });
  if (error) {
    console.error('[catalog/search] cache upsert error', error.message);
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }
  if (!supabaseService) {
    return sendError(res, 500, 'Supabase not configured');
  }

  try {
    const body = await readJsonBody<{ ean?: string }>(req);
    const ean = (body?.ean || '').trim();
    if (!isValidEan(ean)) {
      return sendError(res, 400, 'Nieprawidłowy EAN. Dozwolone tylko cyfry (8/12/13/14).');
    }

    const summaries = await searchProductsByEan(ean);
    if (!summaries || summaries.length === 0) {
      return res.status(200).json({ ean, top3: [] });
    }

    const targetProducts = summaries.slice(0, MAX_DETAILS);
    const details: AllegroProductDetail[] = [];

    for (const product of targetProducts) {
      const pid = (product as any).id;
      if (!pid) continue;
      const cached = await loadFromCache(pid);
      if (cached) {
        details.push(cached);
        continue;
      }
      try {
        const detail = await fetchProductDetail(pid);
        details.push(detail);
      } catch (err: any) {
        console.error('[catalog/search] detail fetch failed', pid, err?.message || err);
      }
    }

    if (details.length === 0) {
      return res.status(200).json({ ean, top3: [] });
    }

    const ranked = rankProducts(details);
    const top3 = ranked.slice(0, 3).map(item => ({
      productId: item.productId,
      title: item.title,
      mainImageUrl: item.mainImageUrl,
      images: item.images,
      categoryId: item.categoryId,
      score: item.score,
      reason: item.reason,
    }));

    // Persist cache for all ranked items (score known now)
    await Promise.all(ranked.map(item => saveToCache(item.productId, ean, item.raw, item.score)));

    return res.status(200).json({ ean, top3 });
  } catch (err: any) {
    console.error('[catalog/search] unexpected error', err);
    return sendError(res, 500, err?.message || 'Internal error');
  }
}
