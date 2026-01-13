import { VercelRequest, VercelResponse } from '@vercel/node';

export const readRawBody = async (req: VercelRequest): Promise<string> => {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);

  return await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
};

export const readJsonBody = async <T = any>(req: VercelRequest): Promise<T> => {
  if (req.body && typeof req.body === 'object') return req.body as T;
  const raw = await readRawBody(req);
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error('Invalid JSON body');
  }
};

export const sendError = (res: VercelResponse, status: number, message: string, extra?: Record<string, any>) => {
  return res.status(status).json({ error: message, ...(extra || {}) });
};
