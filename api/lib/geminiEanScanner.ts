const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const env = (name: string) => process.env[name] || '';
const apiKey = env('GEMINI_API_KEY');

export const isValidEan = (ean: string): boolean => {
  return /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(ean);
};

export const pickBestEan = (text: string): string | null => {
  const matches = Array.from(text.matchAll(/\d{8,14}/g)).map(m => m[0]);
  if (!matches.length) return null;
  const candidates = matches
    .map(m => m.replace(/\D/g, ''))
    .filter(isValidEan);
  if (!candidates.length) return null;

  const byLengthPriority = [13, 14, 12, 8];
  for (const len of byLengthPriority) {
    const found = candidates.find(c => c.length === len);
    if (found) return found;
  }
  return candidates[0];
};

const normalizeBase64 = (input: string): { data: string; mime: string } => {
  if (!input) throw new Error('Image data is empty');
  const dataUrlMatch = input.match(/^data:(.+);base64,(.*)$/);
  if (dataUrlMatch) {
    return { mime: dataUrlMatch[1], data: dataUrlMatch[2] };
  }
  return { mime: 'image/jpeg', data: input };
};

export const scanEanFromBase64 = async (base64: string, mimeType?: string): Promise<string> => {
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }

  const normalized = normalizeBase64(base64);
  const payload = {
    contents: [
      {
        parts: [
          {
            text: 'You are an OCR assistant. Extract only the most likely EAN/GTIN number from the photo. Return ONLY the digits of the best candidate (length 8/12/13/14). No text, no explanation.'
          },
          {
            inlineData: {
              data: normalized.data,
              mimeType: mimeType || normalized.mime || 'image/jpeg'
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      topK: 1,
      maxOutputTokens: 20
    }
  } as const;

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Vision error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join(' ') || '';
  const ean = pickBestEan(text);
  if (!ean) {
    throw new Error('Nie udało się odczytać EAN z obrazu.');
  }
  return ean;
};
