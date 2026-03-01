import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheetsClient } from './_lib/google-sheets.js';

export const runtime = 'nodejs';

const ALLEGRO_API_URL = 'https://api.allegro.pl';
const ALLEGRO_AUTH_URL = 'https://allegro.pl/auth/oauth/token';

const clientId = process.env.ALLEGRO_CLIENT_ID;
const clientSecret = process.env.ALLEGRO_CLIENT_SECRET;
const refreshToken = process.env.ALLEGRO_REFRESH_TOKEN;
const spreadsheetId = process.env.SPREADSHEEET_ID_INVENTORY || process.env.SPREADSHEET_ID_INVENTORY || '1VkBXhxcPi4DtaMFvhCf32xbPy6p9JrarR6w_FmHTahM';

async function getAccessToken() {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken || '',
    });

    const res = await fetch(ALLEGRO_AUTH_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    if (!res.ok) throw new Error(`Allegro Auth Error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.access_token;
}

async function fetchOrders(token: string) {
    const res = await fetch(`${ALLEGRO_API_URL}/order/checkout-forms?limit=50`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.allegro.public.v1+json',
        },
    });

    if (!res.ok) throw new Error(`Allegro Orders Error: ${res.status}`);
    const data = await res.json();
    return data.checkoutForms || [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const token = await getAccessToken();
        const orders = await fetchOrders(token);

        const sheets = await getGoogleSheetsClient();

        // Prepare rows for sheet
        const rows = orders.map((order: any) => [
            order.id,
            order.buyer?.login,
            order.updatedAt,
            order.summary?.totalAmount?.amount,
            order.summary?.totalAmount?.currency,
            order.lineItems?.map((li: any) => `${li.offer.name} (${li.quantity})`).join(', ')
        ]);

        if (rows.length > 0) {
            // Check if 'Orders' sheet exists
            const meta = await sheets.spreadsheets.get({ spreadsheetId });
            const hasOrdersSheet = meta.data.sheets?.some(s => s.properties?.title === 'Orders' || s.properties?.title === 'Sprzedaż');

            const sheetName = hasOrdersSheet ? (meta.data.sheets?.find(s => s.properties?.title === 'Orders' || s.properties?.title === 'Sprzedaż')?.properties?.title) : 'Orders';

            if (!hasOrdersSheet) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: { requests: [{ addSheet: { properties: { title: 'Orders' } } }] }
                });
            }

            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `${sheetName}!A:Z`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: rows },
            });
        }

        res.status(200).json({ success: true, message: `Synced ${rows.length} orders`, timestamp: new Date().toISOString() });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}
