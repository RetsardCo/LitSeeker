/**
 * Semantic & Lexical Similarity Scorer for Capstone Titles and Academic Literature
 */

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot',
  'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each',
  'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d',
  'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i',
  'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s',
  'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
  'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll',
  'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
  'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while',
  'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll',
  'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves',
  // Generic research terms that don't add semantic specificity
  'study', 'studies', 'research', 'paper', 'article', 'investigation', 'using', 'based', 'approach', 'system',
  'proposed', 'results', 'show', 'analysis', 'method', 'methods', 'experimental', 'evaluation', 'via', 'new'
]);

/**
 * Tokenize and normalize text into clean words
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Extract 2-word keyphrases / collocations (e.g. 'deep learning', 'crop disease')
 */
function extractBigrams(tokens) {
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

/**
 * Build term frequency vector from list of tokens & bigrams
 */
function buildFrequencyMap(tokens, bigrams = []) {
  const freq = new Map();
  // Unigram weights = 1
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1.0);
  }
  // Bigram weights = 2.0 (higher value for specific technical compound terms)
  for (const b of bigrams) {
    freq.set(b, (freq.get(b) || 0) + 2.0);
  }
  return freq;
}

/**
 * Compute cosine similarity between two frequency vectors
 */
function cosineSimilarity(mapA, mapB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [, val] of mapA) {
    normA += val * val;
  }
  for (const [, val] of mapB) {
    normB += val * val;
  }

  if (normA === 0 || normB === 0) return 0;

  for (const [key, valA] of mapA) {
    if (mapB.has(key)) {
      dotProduct += valA * mapB.get(key);
    }
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculates similarity between a Capstone Title/Problem and a Paper
 * Returns a score between 0 and 100%, shared concepts, and relevance level.
 */
function scorePaperSimilarity(queryText, paper) {
  const queryTokens = tokenize(queryText);
  const queryBigrams = extractBigrams(queryTokens);
  const queryVector = buildFrequencyMap(queryTokens, queryBigrams);

  // Combine title (weighted 3x) and abstract (weighted 1x)
  const titleTokens = tokenize(paper.title || '');
  const titleBigrams = extractBigrams(titleTokens);
  const abstractTokens = tokenize(paper.abstract || '');
  const abstractBigrams = extractBigrams(abstractTokens);

  const paperTokens = [...titleTokens, ...titleTokens, ...titleTokens, ...abstractTokens];
  const paperBigrams = [...titleBigrams, ...titleBigrams, ...abstractBigrams];
  const paperVector = buildFrequencyMap(paperTokens, paperBigrams);

  const cosine = cosineSimilarity(queryVector, paperVector);

  // Identify shared technical terms/keywords
  const sharedTerms = [];
  for (const [term] of queryVector) {
    if (paperVector.has(term)) {
      sharedTerms.push(term);
    }
  }

  // Calculate percentage: normalized between 0 and 100
  // Boost slightly if title matches core bigrams
  let rawScore = cosine * 100;
  if (sharedTerms.length >= 4) rawScore = Math.min(100, rawScore + 10);
  if (sharedTerms.length >= 2) rawScore = Math.min(100, rawScore + 5);
  
  const score = Math.round(Math.min(99, Math.max(15, rawScore)));

  let tier = 'Background';
  let badgeColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

  if (score >= 70) {
    tier = 'Highly Relevant';
    badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300';
  } else if (score >= 45) {
    tier = 'Moderate Match';
    badgeColor = 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300';
  } else {
    tier = 'Conceptual Support';
    badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300';
  }

  return {
    score,
    tier,
    badgeColor,
    sharedTerms: Array.from(new Set(sharedTerms)).slice(0, 6),
    rationale: sharedTerms.length > 0 
      ? `Matches ${sharedTerms.length} core concepts: ${sharedTerms.slice(0, 4).join(', ')}`
      : 'General thematic alignment with study topic'
  };
}

module.exports = {
  tokenize,
  scorePaperSimilarity,
  STOP_WORDS
};
