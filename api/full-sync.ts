import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheetsClient, sanitizeSheetId } from './_lib/google-sheets.js';

export const runtime = 'nodejs';

const raw_SHEET_ID = process.env.SPREADSHEEET_ID_INVENTORY || process.env.SPREADSHEET_ID_INVENTORY || '1VkBXhxcPi4DtaMFvhCf32xbPy6p9JrarR6w_FmHTahM';
const SHEET_ID = sanitizeSheetId(raw_SHEET_ID);

// Credentials
const allegroClientId = process.env.ALLEGRO_CLIENT_ID;
const allegroClientSecret = process.env.ALLEGRO_CLIENT_SECRET;
const allegroRefreshToken = process.env.ALLEGRO_REFRESH_TOKEN;

const ebayClientId = process.env.EBAY_CLIENT_ID;
const ebayClientSecret = process.env.EBAY_CLIENT_SECRET;
const ebayRefreshToken = process.env.EBAY_REFRESH_TOKEN;

async function getAllegroToken() {
    if (!allegroClientId || !allegroClientSecret || !allegroRefreshToken) throw new Error('Allegro credentials missing');
    const auth = Buffer.from(`${allegroClientId}:${allegroClientSecret}`).toString('base64');
    const res = await fetch('https://allegro.pl/auth/oauth/token?grant_type=refresh_token&refresh_token=' + allegroRefreshToken, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}` }
    });
    const data = await res.json();
    return data.access_token;
}

async function getEbayToken() {
    if (!ebayClientId || !ebayClientSecret || !ebayRefreshToken) throw new Error('eBay credentials missing');
    const auth = Buffer.from(`${ebayClientId}:${ebayClientSecret}`).toString('base64');
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: ebayRefreshToken,
            scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory'
        })
    });
    const data = await res.json();
    return data.access_token;
}

async function fetchEbayInventory(token: string) {
    let allItems: any[] = [];
    let offset = 0;
    while (true) {
        const res = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item?offset=${offset}&limit=100`, {
            headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE' }
        });
        const data = await res.json();
        const items = data.inventoryItems || [];
        allItems.push(...items);
        if (items.length < 100) break;
        offset += 100;
        if (offset > 1000) break;
    }
    return allItems;
}

async function fetchAllegroOffers(token: string) {
    let allOffers: any[] = [];
    let offset = 0;
    while (true) {
        const res = await fetch(`https://api.allegro.pl/sale/offers?offset=${offset}&limit=100`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.allegro.public.v1+json'
            }
        });
        const data = await res.json();
        const offers = data.offers || [];
        allOffers.push(...offers);
        if (offers.length < 100) break;
        offset += 100;
        if (offset > 1000) break;
    }
    return allOffers;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const [aToken, eToken] = await Promise.all([getAllegroToken(), getEbayToken()]);
        const [aOffers, eItems] = await Promise.all([fetchAllegroOffers(aToken), fetchEbayInventory(eToken)]);

        // eBay items map by EAN
        const ebayMap = new Map();
        eItems.forEach(item => {
            const ean = item.product?.ean?.[0] || item.product?.upc?.[0];
            if (ean) ebayMap.set(ean, item);
        });

        const joinedRows: any[] = [];
        const allegroOnlyRows: any[] = [];

        aOffers.forEach(offer => {
            const ean = offer.external?.id || offer.ean || offer.id; // Mocking EAN search if not explicit
            // Actually Allegro offers have EAN in product object often
            const realEan = offer.product?.ean || offer.external?.id; // Fallback

            const ebayMatch = ebayMap.get(realEan);

            const row = [
                offer.external?.id || offer.id, // SKU
                offer.name, // Name
                realEan || '', // EAN
                (offer.stock?.available || 0) + (ebayMatch?.availability?.shipToLocationAvailability?.quantity || 0), // Total Stock
                0, // Cost (Placeholder)
                ebayMatch?.sku || '', // eBay SKU
                ebayMatch?.product?.title || '', // eBay Title
                ebayMatch?.availability?.shipToLocationAvailability?.quantity || 0, // eBay Stock
                ebayMatch?.offers?.[0]?.pricingSummary?.price?.value || 0, // eBay Price
                offer.external?.id || '', // Allegro SKU
                offer.name, // Allegro Title
                offer.stock?.available || 0, // Allegro Stock
                offer.sellingMode?.price?.amount || 0, // Allegro Price
                offer.primaryImage?.url || ebayMatch?.product?.imageUrls?.[0] || '', // Image URL
                offer.id, // Allegro Listing ID
                ebayMatch ? 'synced' : 'not_synced' // Sync Status
            ];

            if (ebayMatch) {
                joinedRows.push(row);
                ebayMap.delete(realEan);
            } else {
                allegroOnlyRows.push(row);
            }
        });

        const ebayOnlyRows = Array.from(ebayMap.values()).map(item => [
            item.sku,
            item.product?.title || '',
            item.product?.ean?.[0] || '',
            item.availability?.shipToLocationAvailability?.quantity || 0,
            0,
            item.sku,
            item.product?.title || '',
            item.availability?.shipToLocationAvailability?.quantity || 0,
            item.offers?.[0]?.pricingSummary?.price?.value || 0,
            '', '', 0, 0,
            item.product?.imageUrls?.[0] || '',
            '',
            'not_synced'
        ]);

        const headers = [
            'SKU', 'Name', 'EAN', 'Total_Stock', 'Cost',
            'eBay_SKU', 'eBay_Title', 'eBay_Stock', 'eBay_Price',
            'Allegro_SKU', 'Allegro_Title', 'Allegro_Stock', 'Allegro_Price',
            'Image_URL', 'Allegro_Listing_ID', 'Sync_Status'
        ];

        const allRows = [headers, ...joinedRows, ...allegroOnlyRows, ...ebayOnlyRows];

        const sheets = await getGoogleSheetsClient();
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: 'INVENTORY!A1:P',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: allRows }
        });

        res.status(200).json({
            success: true,
            summary: {
                joined: joinedRows.length,
                allegroOnly: allegroOnlyRows.length,
                ebayOnly: ebayOnlyRows.length
            }
        });

    } catch (error: any) {
        console.error('[full-sync] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
