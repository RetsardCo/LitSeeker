/**
 * Exact-Paper Matching, Identity Resolution, and Deduplication Engine
 * Ensures that alternative versions match the requested scholarly work with high confidence.
 */

/**
 * Normalizes DOI to standard format (e.g. "10.1109/jiot.2023.3289012")
 */
function normalizeDoi(doi) {
  if (!doi || typeof doi !== 'string') return null;
  let clean = doi.trim().toLowerCase();
  clean = clean.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '');
  clean = clean.replace(/[#?].*$/, '').replace(/\/+$/, '');
  const match = clean.match(/^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/);
  return match ? clean : null;
}

/**
 * Normalizes arXiv identifier (e.g. "2304.09812")
 */
function normalizeArXivId(id) {
  if (!id || typeof id !== 'string') return null;
  let clean = id.trim().toLowerCase();
  clean = clean.replace(/^arxiv:\s*/i, '');
  clean = clean.replace(/^https?:\/\/arxiv\.org\/(?:abs|pdf)\//i, '');
  clean = clean.replace(/(\.pdf)?$/i, '');
  clean = clean.replace(/v\d+$/i, ''); // Strip version suffix
  const match = clean.match(/^(?:\d{4}\.\d{4,5}|[a-z\-]+(\.[a-z]{2})?\/\d{7})$/);
  return match ? clean : null;
}

/**
 * Normalizes title for comparison (strips punctuation, extra spaces, accents)
 */
function normalizeTitle(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Dice coefficient for character bigrams between two strings
 */
function stringSimilarity(strA, strB) {
  const a = normalizeTitle(strA);
  const b = normalizeTitle(strB);
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0;

  const getBigrams = str => {
    const s = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.slice(i, i + 2);
      s.set(bg, (s.get(bg) || 0) + 1);
    }
    return s;
  };

  const bgA = getBigrams(a);
  const bgB = getBigrams(b);
  let intersection = 0;

  for (const [bg, countA] of bgA) {
    if (bgB.has(bg)) {
      intersection += Math.min(countA, bgB.get(bg));
    }
  }

  const total = (a.length - 1) + (b.length - 1);
  return (2.0 * intersection) / total;
}

/**
 * Extract surnames from list of author names
 */
function extractSurnames(authors) {
  if (!authors || !Array.isArray(authors)) return [];
  return authors.map(a => {
    if (!a) return '';
    const clean = String(a).replace(/,/g, ' ').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '') : '';
  }).filter(Boolean);
}

/**
 * Calculates author surname overlap ratio
 */
function authorOverlapScore(targetAuthors, candidateAuthors) {
  const target = extractSurnames(targetAuthors);
  const candidate = extractSurnames(candidateAuthors);
  if (target.length === 0 || candidate.length === 0) {
    return 0.5; // neutral if authors not available
  }

  const targetSet = new Set(target);
  let matched = 0;
  for (const c of candidate) {
    if (targetSet.has(c)) matched++;
  }

  // Jaccard similarity of surnames
  const union = new Set([...target, ...candidate]).size;
  return union > 0 ? (matched / union) : 0;
}

/**
 * Year compatibility score
 */
function yearCompatibilityScore(targetYear, candidateYear) {
  if (!targetYear || !candidateYear) return 0.7; // neutral if missing
  const yT = parseInt(targetYear, 10);
  const yC = parseInt(candidateYear, 10);
  if (isNaN(yT) || isNaN(yC)) return 0.7;

  const diff = Math.abs(yT - yC);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.9; // common between preprint and journal
  if (diff === 2) return 0.7;
  return Math.max(0.1, 1.0 - diff * 0.2);
}

/**
 * Evaluates match confidence between target paper and candidate paper
 * Returns { isMatch, confidence, matchType, reasons }
 */
function matchPaper(target, candidate) {
  const targetDoi = normalizeDoi(target.doi);
  const candidateDoi = normalizeDoi(candidate.doi);

  // 1. Exact DOI match
  if (targetDoi && candidateDoi && targetDoi === candidateDoi) {
    return {
      isMatch: true,
      confidence: 1.0,
      confidencePercent: 100,
      matchType: 'exact_doi',
      reasons: ['Exact DOI identifier match after normalization']
    };
  }

  // 2. Exact arXiv ID match
  const targetArxiv = normalizeArXivId(target.arxivId || target.id);
  const candidateArxiv = normalizeArXivId(candidate.arxivId || candidate.id);
  if (targetArxiv && candidateArxiv && targetArxiv === candidateArxiv) {
    return {
      isMatch: true,
      confidence: 0.98,
      confidencePercent: 98,
      matchType: 'exact_arxiv',
      reasons: ['Exact arXiv preprint identifier match']
    };
  }

  // If DOIs conflict, reject unless one is a known preprint DOI for the work
  if (targetDoi && candidateDoi && targetDoi !== candidateDoi) {
    // Only allow if title is near-identical (>0.92) and year within 1 year (e.g. DOI changed or preprint DOI)
    const titleSim = stringSimilarity(target.title || '', candidate.title || '');
    if (titleSim < 0.92) {
      return {
        isMatch: false,
        confidence: 0.1,
        confidencePercent: 10,
        matchType: 'doi_mismatch',
        reasons: ['Different DOIs and title similarity below threshold']
      };
    }
  }

  // 3. Metadata similarity matching (Title, Author, Year)
  const titleSim = stringSimilarity(target.title || '', candidate.title || '');
  const authorScore = authorOverlapScore(target.authors, candidate.authors);
  const yearScore = yearCompatibilityScore(target.publicationYear || target.year, candidate.publicationYear || candidate.year);

  // Strict title matching: if title similarity is too low, reject immediately
  if (titleSim < 0.65) {
    return {
      isMatch: false,
      confidence: Math.round(titleSim * 100) / 100,
      confidencePercent: Math.round(titleSim * 100),
      matchType: 'title_mismatch',
      reasons: ['Title similarity is below threshold (< 65%)']
    };
  }

  // Weighted composite confidence
  const composite = (titleSim * 0.65) + (authorScore * 0.25) + (yearScore * 0.10);
  const confidencePercent = Math.round(composite * 100);

  if (composite >= 0.80) {
    return {
      isMatch: true,
      confidence: Math.round(composite * 100) / 100,
      confidencePercent,
      matchType: 'high_confidence_metadata',
      reasons: [
        `High title similarity (${Math.round(titleSim * 100)}%)`,
        `Author overlap (${Math.round(authorScore * 100)}%)`,
        `Year compatibility (${Math.round(yearScore * 100)}%)`
      ]
    };
  }

  if (composite >= 0.68) {
    return {
      isMatch: true,
      requiresVerification: true,
      confidence: Math.round(composite * 100) / 100,
      confidencePercent,
      matchType: 'candidate_uncertain',
      reasons: [
        `Moderate title similarity (${Math.round(titleSim * 100)}%)`,
        `Requires user verification before treating as confirmed alternative`
      ]
    };
  }

  return {
    isMatch: false,
    confidence: Math.round(composite * 100) / 100,
    confidencePercent,
    matchType: 'insufficient_confidence',
    reasons: ['Composite metadata match below 68% threshold']
  };
}

/**
 * Deduplicates list of alternative versions for a target paper
 * Merges equivalent records while preserving distinct repository links
 */
function deduplicateVersions(versions) {
  if (!Array.isArray(versions)) return [];

  const seenUrls = new Set();
  const unique = [];

  for (const v of versions) {
    const primaryUrl = (v.pdfUrl || v.url || '').trim().toLowerCase();
    if (!primaryUrl) continue;

    // Normalize URL key (strip trailing slashes, protocol variations)
    const normKey = primaryUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (seenUrls.has(normKey)) continue;

    seenUrls.add(normKey);
    unique.push(v);
  }

  return unique;
}

module.exports = {
  normalizeDoi,
  normalizeArXivId,
  normalizeTitle,
  stringSimilarity,
  extractSurnames,
  authorOverlapScore,
  yearCompatibilityScore,
  matchPaper,
  deduplicateVersions
};
