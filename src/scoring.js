const tokenize = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const uniqueRatio = (tokens) => {
  if (tokens.length === 0) return 1;
  const unique = new Set(tokens);
  return unique.size / tokens.length;
};

const parsePrice = (priceText) => {
  if (!priceText) return null;
  const numeric = priceText.replace(/[^0-9.]/g, '');
  if (!numeric) return null;
  const value = Number(numeric);
  return Number.isFinite(value) ? value : null;
};

export const scoreProduct = (data) => {
  const flags = [];
  let score = 0;

  const title = (data.title || '').trim();
  const description = (data.description || '').trim();

  if (!title) {
    score += 20;
    flags.push('Missing or empty title');
  }

  if (!description) {
    score += 25;
    flags.push('Missing product description');
  } else {
    if (description.length < 80) {
      score += 20;
      flags.push('Very short description');
    }
    if (description.length > 1500) {
      score += 10;
      flags.push('Overly long description');
    }

    const tokens = tokenize(description);
    const ratio = uniqueRatio(tokens);
    if (ratio < 0.45) {
      score += 15;
      flags.push('Highly repetitive description');
    }
  }

  const genericTitle = /(best|premium|high\s*quality|amazing|new|hot|sale|top\s*rated)/i;
  if (title && genericTitle.test(title)) {
    score += 10;
    flags.push('Generic marketing title terms');
  }

  const priceValue = parsePrice(data.priceText);
  if (priceValue !== null && priceValue < 5) {
    score += 15;
    flags.push('Unusually low price');
  }

  if (typeof data.imageCount === 'number' && data.imageCount < 3) {
    score += 15;
    flags.push('Low product image count');
  }

  if (typeof data.reviewCount === 'number' && data.reviewCount === 0) {
    score += 10;
    flags.push('No visible reviews');
  }

  score = Math.max(0, Math.min(100, score));

  let risk = 'Low';
  if (score >= 55) risk = 'High';
  else if (score >= 25) risk = 'Medium';

  return { score, risk, flags };
};
