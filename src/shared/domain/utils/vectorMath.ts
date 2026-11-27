const VECTOR_DIMENSIONS = 64;

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
};

const hashStringToBucket = (str: string, maxBuckets: number): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash) % maxBuckets;
};

export const buildClinicalVector = (text: string): number[] => {
  const normalized = normalizeText(text);
  const rawTokens = normalized.split(/\s+/).filter((token) => token.length > 1);

  const vector = new Array<number>(VECTOR_DIMENSIONS).fill(0);

  if (rawTokens.length === 0) {
    return vector;
  }

  // 1. Unigramas
  for (const token of rawTokens) {
    const bucket = hashStringToBucket(token, VECTOR_DIMENSIONS);
    const currentValue = vector[bucket] ?? 0;
    vector[bucket] = currentValue + 1.0;
  }

  // 2. Bigramas para capturar contexto clínico (ej: "higado graso", "dolor toracico")
  for (let i = 0; i < rawTokens.length - 1; i++) {
    const tokenA = rawTokens[i] ?? '';
    const tokenB = rawTokens[i + 1] ?? '';
    const bigram = `${tokenA}_${tokenB}`;
    const bucket = hashStringToBucket(bigram, VECTOR_DIMENSIONS);
    const currentValue = vector[bucket] ?? 0;
    vector[bucket] = currentValue + 1.5;
  }

  // 3. Normalización L2
  let sumOfSquares = 0;
  for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
    const val = vector[i] ?? 0;
    sumOfSquares += val * val;
  }

  const magnitude = Math.sqrt(sumOfSquares);
  if (magnitude > 0) {
    for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
      const val = vector[i] ?? 0;
      vector[i] = Number((val / magnitude).toFixed(6));
    }
  }

  return vector;
};

export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normASq = 0;
  let normBSq = 0;

  for (let i = 0; i < vecA.length; i++) {
    const valA = vecA[i] ?? 0;
    const valB = vecB[i] ?? 0;
    dotProduct += valA * valB;
    normASq += valA * valA;
    normBSq += valB * valB;
  }

  const denominator = Math.sqrt(normASq) * Math.sqrt(normBSq);
  if (denominator === 0) {
    return 0;
  }

  const similarity = dotProduct / denominator;
  return Math.max(0, Math.min(1, Number(similarity.toFixed(6))));
};
