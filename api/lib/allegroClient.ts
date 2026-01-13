/// <reference path="../types.d.ts" />
/// <reference types="node" />
import { supabaseService } from './supabase.js';

const ALLEGRO_API_URL = 'https://api.allegro.pl';
const ALLEGRO_AUTH_URL = 'https://allegro.pl/auth/oauth/token';

const env = (name: string) => process.env[name] || '';
const clientId = env('ALLEGRO_CLIENT_ID');
const clientSecret = env('ALLEGRO_CLIENT_SECRET');
const bootstrapRefreshToken = env('ALLEGRO_REFRESH_TOKEN');

export type AllegroToken = { access_token: string; token_type: string; expires_in: number; refresh_token: string; scope?: string };
export type TokenRow = { id: string; access_token: string; refresh_token: string; expires_at: string; updated_at: string };

const assertSupabase = () => {
  if (!supabaseService) {
    throw new Error('Supabase not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseService;
};

const basicAuth = () => Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

const fetchNewToken = async (refreshToken: string): Promise<AllegroToken> => {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Allegro credentials or refresh token');
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);

  const res = await fetch(ALLEGRO_AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Allegro token error ${res.status}: ${text}`);
  }
  return res.json();
};

const tokenTable = 'integrations_allegro_tokens';
const EXPIRY_BUFFER_MS = 60_000;

const getStoredToken = async (): Promise<TokenRow | null> => {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from(tokenTable)
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
};

const persistToken = async (token: AllegroToken, existingId?: string): Promise<TokenRow> => {
  const supabase = assertSupabase();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const payload = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  } as const;

  if (existingId) {
    const { data, error } = await supabase
      .from(tokenTable)
      .update(payload)
      .eq('id', existingId)
      .select()
      .single();
    if (error) throw error;
    return data as TokenRow;
  }

  const { data, error } = await supabase
    .from(tokenTable)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as TokenRow;
};

const isExpired = (expiresAt: string | null | undefined) => {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - Date.now() <= EXPIRY_BUFFER_MS;
};

const ensureToken = async (): Promise<{ accessToken: string; refreshToken: string; recordId?: string }> => {
  let stored = null as TokenRow | null;
  try {
    stored = await getStoredToken();
  } catch (err) {
    console.error('[AllegroClient] Failed to read stored token:', err);
  }

  if (!stored && !bootstrapRefreshToken) {
    throw new Error('No Allegro token found. Seed integrations_allegro_tokens or set ALLEGRO_REFRESH_TOKEN.');
  }

  if (!stored) {
    const token = await fetchNewToken(bootstrapRefreshToken);
    const row = await persistToken(token);
    stored = row;
  }

  if (stored && !isExpired(stored.expires_at)) {
    return { accessToken: stored.access_token, refreshToken: stored.refresh_token, recordId: stored.id };
  }

  const refreshed = await fetchNewToken(stored?.refresh_token || bootstrapRefreshToken);
  const row = await persistToken(refreshed, stored?.id);
  return { accessToken: row.access_token, refreshToken: row.refresh_token, recordId: row.id };
};

const allegroFetch = async <T = any>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> => {
  const { accessToken, refreshToken, recordId } = await ensureToken();

  const res = await fetch(path.startsWith('http') ? path : `${ALLEGRO_API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.allegro.public.v1+json',
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    const text = await res.text();
    if (attempt === 0) {
      await persistToken(await fetchNewToken(refreshToken), recordId);
      return allegroFetch(path, init, attempt + 1);
    }
    throw new Error(`Allegro auth error ${res.status}: ${text}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Allegro API error ${res.status}: ${text || res.statusText}`);
  }

  const raw = await res.text();
  return (raw ? JSON.parse(raw) : null) as T;
};

export type AllegroProductSummary = {
  id: string;
  name?: string;
  images?: { url: string }[];
  category?: { id?: string };
};

export type AllegroProductDetail = AllegroProductSummary & {
  parameters?: { name?: string; id?: string; values?: string[] }[];
  description?: any;
};

export const searchProductsByEan = async (ean: string) => {
  const url = new URL(`${ALLEGRO_API_URL}/sale/products`);
  url.searchParams.set('phrase', ean);
  url.searchParams.set('mode', 'GTIN');
  const data = await allegroFetch<{ products?: AllegroProductSummary[]; items?: AllegroProductSummary[] }>(url.toString());
  return data?.products || data?.items || [];
};

export const fetchProductDetail = async (productId: string): Promise<AllegroProductDetail> => {
  return allegroFetch<AllegroProductDetail>(`/sale/products/${productId}?language=pl-PL`);
};

export type CreateOfferPayload = {
  productSet: { product: { id: string } }[];
  sellingMode: { price: { amount: string; currency: string } };
  stock: { available: number };
  publication: { status: 'ACTIVE' | 'INACTIVE' };
  external?: { id?: string };
  name?: string;
};

export type CreateOfferResponse = { id?: string; publication?: { status?: string }; message?: string; operationId?: string };

export const createOfferFromProduct = async (payload: CreateOfferPayload): Promise<CreateOfferResponse> => {
  return allegroFetch<CreateOfferResponse>('/sale/product-offers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.allegro.public.v1+json',
    },
    body: JSON.stringify(payload),
  });
};

export const allegroRequest = allegroFetch;
