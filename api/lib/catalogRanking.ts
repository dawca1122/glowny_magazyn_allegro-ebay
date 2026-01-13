import { AllegroProductDetail } from './allegroClient.js';

export type RankedProduct = {
  productId: string;
  title: string;
  mainImageUrl?: string;
  images: string[];
  categoryId?: string;
  score: number;
  reason: string[];
  raw: AllegroProductDetail;
};

const extractDescriptionLength = (detail: AllegroProductDetail): number => {
  const desc: any = (detail as any).description;
  if (!desc) return 0;
  if (typeof desc === 'string') return desc.length;
  if (Array.isArray(desc?.sections)) {
    const text = desc.sections
      .map((section: any) => (section?.items || [])
        .map((item: any) => item?.text || item?.content || '')
        .join(''))
      .join('');
    return text.length;
  }
  try {
    return JSON.stringify(desc).length;
  } catch {
    return 0;
  }
};

export const scoreProduct = (detail: AllegroProductDetail): { score: number; reason: string[] } => {
  const imagesCount = detail.images?.length || 0;
  const descriptionLength = extractDescriptionLength(detail);
  const parametersCount = detail.parameters?.length || 0;
  const hasBrand = (detail.parameters || []).some(p => /marka/i.test(p.name || p.id || ''));
  const hasModel = (detail.parameters || []).some(p => /model/i.test(p.name || p.id || ''));

  let score = 0;
  const reason: string[] = [];

  score += imagesCount * 10;
  reason.push(`Zdjęcia: ${imagesCount}`);

  const descScore = Math.min(descriptionLength, 2000) / 50;
  score += descScore;
  reason.push(`Opis: ${descriptionLength} znaków (+${descScore.toFixed(1)})`);

  score += parametersCount * 2;
  reason.push(`Parametry: ${parametersCount}`);

  if (hasBrand) {
    score += 10;
    reason.push('Zawiera markę');
  }
  if (hasModel) {
    score += 10;
    reason.push('Zawiera model');
  }
  if (imagesCount === 0) {
    score -= 20;
    reason.push('Brak zdjęć (-20)');
  }

  return { score, reason };
};

export const rankProducts = (products: AllegroProductDetail[]): RankedProduct[] => {
  return products
    .map((p) => {
      const { score, reason } = scoreProduct(p);
      const images = (p.images || []).map(img => img.url).filter(Boolean);
      return {
        productId: (p as any).id,
        title: (p as any).name || 'Produkt Allegro',
        mainImageUrl: images[0],
        images,
        categoryId: (p as any).category?.id,
        score,
        reason,
        raw: p,
      } as RankedProduct;
    })
    .sort((a, b) => b.score - a.score);
};
