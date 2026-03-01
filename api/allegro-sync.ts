import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheetsClient, sanitizeSheetId } from './_lib/google-sheets.js';

export const runtime = 'nodejs';

const ALLEGRO_API_URL = 'https://api.allegro.pl';
const ALLEGRO_AUTH_URL = 'https://allegro.pl/auth/oauth/token';

const clientId = process.env.ALLEGRO_CLIENT_ID;
const clientSecret = process.env.ALLEGRO_CLIENT_SECRET;
const refreshToken = process.env.ALLEGRO_REFRESH_TOKEN;

const idInventory = sanitizeSheetId(process.env.SPREADSHEET_ID_INVENTORY || '1VkBXhxcPi4DtaMFvhCf32xbPy6p9JrarR6w_FmHTahM');
const idOrders = sanitizeSheetId(process.env.SPREADSHEET_ID_ORDERS || '1r25aipzPPwp8kiEX4Ifhbk_54yFr_-uBREY8EIlbRCw');

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
    const res = await fetch(`${ALLEGRO_API_URL}/order/checkout-forms?limit=50&status=READY_FOR_PROCESSING`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.allegro.public.v1+json',
        },
    });
    if (!res.ok) throw new Error(`Allegro Orders Error: ${res.status}`);
    const data = await res.json();
    return data.checkoutForms || [];
}

async function fetchOffers(token: string) {
    const res = await fetch(`${ALLEGRO_API_URL}/sale/offers?limit=100`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.allegro.public.v1+json',
        },
    });
    if (!res.ok) throw new Error(`Allegro Offers Error: ${res.status}`);
    const data = await res.json();
    return data.offers || [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const token = await getAccessToken();
        const [orders, offers] = await Promise.all([
            fetchOrders(token),
            fetchOffers(token)
        ]);

        const sheets = await getGoogleSheetsClient();

        // 1. Sync INVENTORY (SKU, Name, Stock, Allegro_Price, EBay_Price, Cost)
        const inventoryRows = offers.map((offer: any) => [
            offer.external?.id || offer.id,
            offer.name,
            offer.stock?.available || 0,
            offer.sellingMode?.price?.amount || 0,
            (offer.sellingMode?.price?.amount || 0) / 4.4, // Mock eBay price in EUR
            0 // Cost (Placeholder)
        ]);

        if (inventoryRows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: idInventory,
                range: 'INVENTORY!A2:F',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: inventoryRows },
            });
        }

        // 2. Sync ORDERS_ALLEGRO (Order_ID, Date, SKU, Quantity, Price, Buyer_Login, Shipping_Status)
        const orderRows: any[] = [];
        for (const order of orders) {
            for (const item of (order.lineItems || [])) {
                orderRows.push([
                    order.id,
                    order.updatedAt || order.createdAt,
                    item.offer?.external?.id || item.offer?.id,
                    item.quantity,
                    item.price?.amount,
                    order.buyer?.login,
                    order.status
                ]);
            }
        }

        if (orderRows.length > 0) {
            // We use append for orders to keep history
            await sheets.spreadsheets.values.append({
                spreadsheetId: idOrders,
                range: 'ORDERS_ALLEGRO!A:G',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: orderRows },
            });
        }

        res.status(200).json({
            success: true,
            message: `Synced ${inventoryRows.length} items to INVENTORY and ${orderRows.length} lines to ORDERS_ALLEGRO`,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[allegro-sync] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
