import { fetchSheetData } from './_lib/google-sheets.js';

export const runtime = 'nodejs';
const SHEET_ID = process.env.SPREADSHEET_ID_INVENTORY || '1Rkl0t9-7fD4GG6t0dP7_cexo8Ctg48WPwUKfl-_dN18';

export default async function handler(req, res) {
    try {
        const rows = await fetchSheetData(SHEET_ID, 'Magazyn!A:Z');
        const lastRows = rows.slice(-5);
        res.status(200).json({
            success: true,
            lastRows,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
