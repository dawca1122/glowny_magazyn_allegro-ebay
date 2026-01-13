import { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';
import { readJsonBody, sendError } from '../lib/http';
import { isValidEan, scanEanFromBase64 } from '../lib/geminiEanScanner';

const parseMultipartImage = (req: VercelRequest): Promise<{ base64: string; mime?: string }> => {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    let resolved = false;

    bb.on('file', (_, file, info) => {
      const chunks: Buffer[] = [];
      file.on('data', (d) => chunks.push(d));
      file.on('end', () => {
        if (resolved) return;
        resolved = true;
        const buffer = Buffer.concat(chunks);
        resolve({ base64: buffer.toString('base64'), mime: info.mimeType });
      });
    });

    bb.on('error', (err) => reject(err));
    bb.on('finish', () => {
      if (!resolved) reject(new Error('No file found in multipart payload'));
    });

    req.pipe(bb);
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  try {
    const contentType = req.headers['content-type'] || '';
    let base64 = '';
    let mime: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const parsed = await parseMultipartImage(req);
      base64 = parsed.base64;
      mime = parsed.mime;
    } else {
      const body = await readJsonBody<{ imageBase64?: string; image?: string; data?: string }>(req);
      base64 = (body.imageBase64 || body.image || body.data || '').trim();
      if (!base64) return sendError(res, 400, 'Brak obrazu w żądaniu.');
    }

    const ean = await scanEanFromBase64(base64, mime);
    if (!isValidEan(ean)) {
      return sendError(res, 400, 'Niepoprawny EAN rozpoznany z obrazu.');
    }

    return res.status(200).json({ ean });
  } catch (err: any) {
    console.error('[ean/scan] error', err);
    return sendError(res, 500, err?.message || 'Internal error');
  }
}
