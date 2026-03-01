import { getGoogleSheetsClient, sanitizeSheetId } from './_lib/google-sheets.js';

export const runtime = 'nodejs';
const raw_SHEET_ID = process.env.SPREADSHEEET_ID_INVENTORY || process.env.SPREADSHEET_ID_INVENTORY || '1VkBXhxcPi4DtaMFvhCf32xbPy6p9JrarR6w_FmHTahM';
const SHEET_ID = sanitizeSheetId(raw_SHEET_ID);

export default async function handler(req, res) {
    try {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SHEET_ID,
            fields: 'sheets.properties.title'
        });
        const sheetNames = response.data.sheets?.map((s) => s.properties.title) || [];
        res.status(200).json({
            success: true,
            sheetNames,
            spreadsheetId: SHEET_ID,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message, spreadsheetId: SHEET_ID });
    }
}
