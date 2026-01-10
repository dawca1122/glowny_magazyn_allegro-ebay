const ALLEGRO_AUTH_URL = 'https://allegro.pl/auth/oauth/token';
const ALLEGRO_API_URL = 'https://api.allegro.pl';

const getEnv = (name: string): string => process.env[name] || '';

const clientId = getEnv('ALLEGRO_CLIENT_ID');
const clientSecret = getEnv('ALLEGRO_CLIENT_SECRET');
const defaultRefreshToken = getEnv('ALLEGRO_REFRESH_TOKEN');

const basicAuth = () => Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

export type AllegroToken = { access_token: string; token_type: string; expires_in: number; refresh_token: string; scope?: string };

export async function refreshToken(refreshToken?: string): Promise<AllegroToken> {
  if (!clientId || !clientSecret || !(refreshToken || defaultRefreshToken)) {
    throw new Error('Missing Allegro client credentials or refresh token');
  }
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken || defaultRefreshToken);

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
}

export type CheckoutForm = {
  id: string;
  updatedAt: string;
  lineItems: { offer: { id: string; name: string; external?: { id?: string } }; quantity: number; price: { amount: string } }[];
  summary?: { totalToPay?: { amount: string } };
  delivery?: { cost?: { amount?: string } };
};

export async function fetchCheckoutForms(accessToken: string, fromIso: string, toIso: string, limit = 100): Promise<CheckoutForm[]> {
  const items: CheckoutForm[] = [];
  let offset = 0;
  while (true) {
    const url = new URL(`${ALLEGRO_API_URL}/order/checkout-forms`);
    url.searchParams.set('updatedAt.gte', fromIso);
    url.searchParams.set('updatedAt.lte', toIso);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.allegro.public.v1+json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Allegro checkout-forms error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const chunk: CheckoutForm[] = data?.checkoutForms || [];
    items.push(...chunk);
    if (!data?.count || chunk.length < limit) break;
    offset += limit;
  }
  return items;
}
