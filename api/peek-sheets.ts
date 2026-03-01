import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchSheetData, sanitizeSheetId } from './_lib/google-sheets.js';

export const runtime = 'nodejs';
const raw_SHEET_ID = process.env.SPREADSHEEET_ID_INVENTORY || process.env.SPREADSHEET_ID_INVENTORY || '1VkBXhxcPi4DtaMFvhCf32xbPy6p9JrarR6w_FmHTahM';
const SHEET_ID = sanitizeSheetId(raw_SHEET_ID);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const rows = await fetchSheetData(SHEET_ID, 'INVENTORY!A:Z');
        const lastRows = rows.slice(-5);
        res.status(200).json({
            success: true,
            lastRows,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}
