import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheetsClient, sanitizeSheetId } from './_lib/google-sheets.js';

export const runtime = 'nodejs';

const allegroClientId = process.env.ALLEGRO_CLIENT_ID;
const allegroClientSecret = process.env.ALLEGRO_CLIENT_SECRET;
const allegroRefreshToken = process.env.ALLEGRO_REFRESH_TOKEN;

async function getAllegroToken() {
    const auth = Buffer.from(`${allegroClientId}:${allegroClientSecret}`).toString('base64');
    const res = await fetch('https://allegro.pl/auth/oauth/token?grant_type=refresh_token&refresh_token=' + allegroRefreshToken, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}` }
    });
    const data = await res.json();
    return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { listingId, newSku } = req.body;
    if (!listingId || !newSku) return res.status(400).json({ error: 'ListingId and newSku required' });

    try {
        const token = await getAllegroToken();
        const resPatch = await fetch(`https://api.allegro.pl/sale/offers/${listingId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/vnd.allegro.public.v1+json',
                Accept: 'application/vnd.allegro.public.v1+json'
            },
            body: JSON.stringify({
                external: { id: newSku }
            })
        });

        if (!resPatch.ok) {
            const errText = await resPatch.text();
            throw new Error(`Allegro PATCH Error: ${resPatch.status} ${errText}`);
        }

        const data = await resPatch.json();
        res.status(200).json({ success: true, data });

    } catch (error: any) {
        console.error('[update-allegro-sku] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
