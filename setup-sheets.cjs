const { google } = require('googleapis');

const credentials = {
    type: 'service_account',
    project_id: 'contentstudio-429109',
    private_key: `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDf3wbVVSz80WzQ\nSvsktoof6GtCWgmakF0BMBo0AFLQExNGu10BVctjeQIt0ZZVsek8+/KLsTrZ/d8x\neJxTgEojg1ZldUIbE+CRSMQuVZZWMcp7Nm4pusv6WB/MWfs9qWb+f6LLGYZOeoFY\n/aTmuzsCM/xPyXX6+YE6BdA1fYMC7vX7t8vxqB8QrEGCeoWruX4dnN/XWzMUsj/g\nWHRYPjneFMj6xs69wqdQ8UTxD7CsedApgl/VlqOnXSE9REVbC+kOMtAxN3sxAqZk\n6pF26Utypo5cOp6UNpM8a0CmsC9JAodJr+WnUS79olJOIEH6eWYJndS1pSMmHHWG\nlvv3s++pAgMBAAECggEAEm7SiRb46+2h9iIQXPDfPVqVl0pi00xK7h278Jdsuidx\n7T9g3GroIt38MxHYXSC3nb74dO5QNFICEjiWNY1g/VzTbKnrmh9oPIonZhHDvb/e\nhkfgaPTxleCy6JBpnoV/3plbifnFbFmLpCxJSzq0FH27iwXBXjt0O5buMnNNydxD\n6JWJ+eS7igtgB2gBU2H9P0pxEE0qWK19JB6WEE9thfI47pnPPRoy58fNM0clh373\n0uhnBKj0II5z8glstrps4kR/JjSDG/UO4eVGgslCnYeQ7LWIVJ11Cghm1psBVR6j\n6g4XTdw5X3OrVp9YXX60opbG1oauz2+dLQ3GvxYXIQKBgQD3etYxRihasWW7Wg3q\ne6q67pH3kesctGwRWjcaNtKr0kJQoyImRSeMVzkdKOb1Rp1+mDb6sFm1pYaeX8Pz\nef0ngclib2i0c+jqGsjCIDMxEwyLKcm/QF1u72XZ0r1iZfB+ieJJmhJu+4aRhgOl\n7c0IKJM1nDTAu+EqCM1ED2tJiQKBgQDnlB2GmvrEpkylfdK7D9R5dVR76lDPgAOt\nazPQ3prtWCBBkVac1xy6FtIf5BXuPhA0U2b/Z4DREUIvdrIjpuxkKaZ74Q1XtZdF\n7+0wntPIRi0eZcfQGQZjQA36FfoApUd8unc7NtUHDimXmbwmWtdzAZWm8UdhChnd\n+IJn06eNIQKBgDVP6vB2cp8G9Cll/vVyapcWaa9xabqnS1h5nMEy6jNFei+w1Nx1\nrU1YRN95Pje8XJU26TEb6FdvLw7TBn1e3CA0n1NrOJ0XEyfLWVAoa564wc0A1Ysz\nrG0HeWNxOIcH+sTnoy3D2RC7coPK4OJP1glZ5Ex6OAsE7j6F4uI0iCIxAoGBAOW1\llQfBwBptT2zQYUsfqa8K8F+/AnYAc3TuOJG7YbhE532fOO2vVgZqvTXWqmoBorg\n8BoIoU7Av9Y09x9GRNZWOj5HTuThy9wj0jOYWJsggUDV1Q4mxJ9Ouo6HniVlzTN8\nAylJiqYk9jza0jd5hJ0fxUKDszoeuunjx/cVi+4BAoGBAIFO6wca7VhFw5rD26LW\n0VukMFZG/l2OVARnQ/rk5yLfBr1YncePywHVhK58h1KMl2Zhl/AcIkj2pZ+AVM+7\nz+o/jqoEgDU0+KHjSTmR8b+Whpubg5X48cBYQyURZ5vyVceuO+J/jSSTS+Bq7fn1\nqV1IabMq7axbB005Ybt250CH\n-----END PRIVATE KEY-----\n`.replace(/\\n/g, '\n'),
    client_email: 'ebay-allegro@contentstudio-429109.iam.gserviceaccount.com'
};

const SHEETS = {
    INVENTORY: '1VkBXhxcPi4DtaMFvhCf32xbPy6p9JrarR6w_FmHTahM',
    ORDERS: '1r25aipzPPwp8kiEX4Ifhbk_54yFr_-uBREY8EIlbRCw',
    FINANCES: '1EnrbMkpQbg77aKwderpUNzv7TYysDlzrfvmN9sAVdjk'
};

async function setupHeaders() {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        // ORDERS_ALLEGRO headers
        console.log('Setting up ORDERS_ALLEGRO...');
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEETS.ORDERS,
            range: 'ORDERS_ALLEGRO!A1:G1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Order_ID', 'Date', 'SKU', 'Quantity', 'Price', 'Buyer_Login', 'Shipping_Status']] }
        }).catch(async (e) => {
            if (e.message.includes('not found')) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SHEETS.ORDERS,
                    requestBody: { requests: [{ addSheet: { properties: { title: 'ORDERS_ALLEGRO' } } }] }
                });
                return sheets.spreadsheets.values.update({
                    spreadsheetId: SHEETS.ORDERS,
                    range: 'ORDERS_ALLEGRO!A1:G1',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [['Order_ID', 'Date', 'SKU', 'Quantity', 'Price', 'Buyer_Login', 'Shipping_Status']] }
                });
            }
            throw e;
        });

        // FINANCES headers
        console.log('Setting up FINANCES...');
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEETS.FINANCES,
            range: 'FINANCES!A1:F1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Date', 'Platform', 'Revenue', 'Commission', 'Item_Cost', 'Net_Profit']] }
        }).catch(async (e) => {
            if (e.message.includes('not found')) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SHEETS.FINANCES,
                    requestBody: { requests: [{ addSheet: { properties: { title: 'FINANCES' } } }] }
                });
                return sheets.spreadsheets.values.update({
                    spreadsheetId: SHEETS.FINANCES,
                    range: 'FINANCES!A1:F1',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [['Date', 'Platform', 'Revenue', 'Commission', 'Item_Cost', 'Net_Profit']] }
                });
            }
            throw e;
        });

        console.log('Headers setup completed successfully!');
    } catch (error) {
        console.error('Setup failed:', error.message);
    }
}

setupHeaders();
