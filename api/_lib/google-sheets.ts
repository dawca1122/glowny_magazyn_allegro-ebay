import { google } from 'googleapis';

const credentials = {
    type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE,
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
    universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
};

const DEFAULT_SHEET_ID = '1VkBXhxcPi4DtaMFvhCf32xbPy6p9JrarR6w_FmHTahM';

export async function getGoogleSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient as any });
}

export function parseSheetNum(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = String(val).trim().replace(/[^\d.,\-]/g, '').replace(',', '.');
    if (cleaned === '' || cleaned === '-') return 0;
    const num = parseFloat(cleaned);
    return isNaN(num) || !isFinite(num) ? 0 : num;
}

export function sanitizeSheetId(id: string | undefined): string {
    return (id || '').replace(/^\ufeff/, '').trim();
}

export async function fetchSheetData(spreadsheetId: string, range: string) {
    const sheets = await getGoogleSheetsClient();
    const cleanId = sanitizeSheetId(spreadsheetId);
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: cleanId || DEFAULT_SHEET_ID,
        range
    });
    return response.data.values || [];
}
