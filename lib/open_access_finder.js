/**
 * Unified Open-Access Paper Finder & Repository Aggregator
 * Coordinates Unpaywall, OpenAlex, arXiv, and Europe PMC discovery with exact-matching and safe verification.
 */

const { findUnpaywallVersions } = require('./unpaywall');
const { findOpenAlexOaLocations } = require('./openalex');
const { findArXivPreprints } = require('./arxiv');
const { findEuropePmcVersions } = require('./europepmc');
const { matchPaper, deduplicateVersions, normalizeDoi } = require('./paper_matcher');
const { verifyCandidateUrl } = require('./pdf_resolver');

// In-memory cache for discovery results (TTL: 10 minutes)
const DISCOVERY_CACHE = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCachedResult(key) {
  const entry = DISCOVERY_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    DISCOVERY_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedResult(key, data) {
  // Prune cache if too large
  if (DISCOVERY_CACHE.size > 500) {
    const oldestKey = DISCOVERY_CACHE.keys().next().value;
    DISCOVERY_CACHE.delete(oldestKey);
  }
  DISCOVERY_CACHE.set(key, { data, timestamp: Date.now() });
}

/**
 * Standard lawful alternative pathways when no direct free version is located
 */
function getLawfulAlternatives(targetPaper) {
  const doi = normalizeDoi(targetPaper.doi);
  const publisherLink = doi ? `https://doi.org/${doi}` : null;
  const firstAuthor = (targetPaper.authors && targetPaper.authors[0]) ? targetPaper.authors[0] : 'the corresponding author';

  return [
    {
      title: 'Publisher Portal & Journal Archives',
      description: 'Access the publisher\'s version of record. Check for open-access licensing or author fee waivers.',
      actionText: 'Open Publisher Page',
      url: publisherLink || `https://scholar.google.com/scholar?q=${encodeURIComponent(targetPaper.title || '')}`
    },
    {
      title: 'University / Institutional Library Access',
      description: 'Log into your university library portal (EZProxy or OpenAthens) to access subscriptions provided by your university.',
      actionText: 'Check Institutional Access',
      url: 'https://scholar.google.com'
    },
    {
      title: 'Direct Author Manuscript Request',
      description: `Academic authors are generally permitted to share accepted manuscripts for private research under fair use. Request a copy from ${firstAuthor}.`,
      actionText: 'Search Author Profiles',
      url: `https://www.google.com/search?q=${encodeURIComponent(`${firstAuthor} "${targetPaper.title || ''}" repository`)}`
    },
    {
      title: 'Interlibrary Loan (ILL) & Document Delivery',
      description: 'Contact your university or local library to request an Interlibrary Loan copy through legitimate library sharing networks.',
      actionText: 'Learn About ILL',
      url: 'https://en.wikipedia.org/wiki/Interlibrary_loan'
    }
  ];
}

/**
 * Main federated discovery function
 */
async function findFreeVersions(targetPaper, options = {}) {
  const { verifyUrls = true, skipCache = false } = options;

  if (!targetPaper || (!targetPaper.doi && !targetPaper.title)) {
    return {
      success: false,
      error: 'Paper requires either a valid DOI or title to discover open-access versions.',
      target: targetPaper || {},
      versions: [],
      alternatives: []
    };
  }

  const cacheKey = (targetPaper.doi || targetPaper.title).toLowerCase().trim();
  if (!skipCache) {
    const cached = getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const startTime = Date.now();
  const providerErrors = [];

  // Query all legitimate providers concurrently with independent failure isolation
  const providerTasks = [
    // 1. Unpaywall (DOI based)
    (async () => {
      try {
        return await findUnpaywallVersions(targetPaper.doi, { timeoutMs: 5000 });
      } catch (err) {
        providerErrors.push({ provider: 'Unpaywall', error: err.message });
        return [];
      }
    })(),

    // 2. OpenAlex (DOI & Title based)
    (async () => {
      try {
        return await findOpenAlexOaLocations(targetPaper, { timeoutMs: 5000 });
      } catch (err) {
        providerErrors.push({ provider: 'OpenAlex', error: err.message });
        return [];
      }
    })(),

    // 3. arXiv (Preprints & Cross-disciplinary STEM)
    (async () => {
      try {
        return await findArXivPreprints(targetPaper, { timeoutMs: 5000 });
      } catch (err) {
        providerErrors.push({ provider: 'arXiv', error: err.message });
        return [];
      }
    })(),

    // 4. Europe PMC (Biomedical, Life Sciences, PMC full text)
    (async () => {
      try {
        return await findEuropePmcVersions(targetPaper, { timeoutMs: 5000 });
      } catch (err) {
        providerErrors.push({ provider: 'Europe PMC', error: err.message });
        return [];
      }
    })()
  ];

  const settled = await Promise.allSettled(providerTasks);
  const rawVersions = [];

  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      rawVersions.push(...s.value);
    }
  }

  // Deduplicate copies by normalized URL while preserving distinct repositories
  const deduplicated = deduplicateVersions(rawVersions);

  // If URL verification is requested, safely inspect the top candidate URLs
  const verifiedVersions = [];

  for (const v of deduplicated) {
    const candidateCopy = { ...v };

    if (verifyUrls && candidateCopy.pdfUrl) {
      try {
        const vResult = await verifyCandidateUrl(candidateCopy.pdfUrl, 3500);

        if (vResult.accessible) {
          if (vResult.isPdf) {
            candidateCopy.verified = true;
            candidateCopy.hasVerifiedPdf = true;
            candidateCopy.accessClassification = candidateCopy.isPreprint ? 'Preprint' : 'Open Access PDF';
          } else {
            // Server returned HTML (landing page or paywall gate)
            candidateCopy.verified = true;
            candidateCopy.hasVerifiedPdf = false;
            candidateCopy.pdfUrl = null; // Do not offer broken direct PDF download
            candidateCopy.accessClassification = 'Free Full Text';
          }
        } else {
          // Verification unsuccessful (timeout, 403 bot guard, or network hiccup)
          // As per rule: failed verification attempt must NOT mean paper is unavailable
          candidateCopy.verified = false;
          candidateCopy.accessClassification = 'Access Unverified';
          candidateCopy.unverifiedReason = vResult.reason || 'Verification timed out or anti-bot challenge encountered';
        }
      } catch (vErr) {
        candidateCopy.verified = false;
        candidateCopy.accessClassification = 'Access Unverified';
      }
    }

    verifiedVersions.push(candidateCopy);
  }

  // Sort versions: Verified Direct PDFs first, then Repositories, then Preprints, then Landing pages
  verifiedVersions.sort((a, b) => {
    const score = v => {
      if (v.verified && v.hasVerifiedPdf && !v.isPreprint) return 100;
      if (v.verified && v.hasVerifiedPdf && v.isPreprint) return 90;
      if (v.pdfUrl && !v.isPreprint) return 80;
      if (v.accessClassification === 'Repository Copy') return 70;
      if (v.isPreprint) return 60;
      if (v.accessClassification === 'Free Full Text') return 50;
      return 30;
    };
    return score(b) - score(a);
  });

  const responsePayload = {
    success: true,
    paper: {
      title: targetPaper.title,
      doi: normalizeDoi(targetPaper.doi) || targetPaper.doi,
      authors: targetPaper.authors || [],
      publicationYear: targetPaper.publicationYear || targetPaper.year,
      publisherLink: targetPaper.doi ? `https://doi.org/${normalizeDoi(targetPaper.doi) || targetPaper.doi}` : null
    },
    totalFound: verifiedVersions.length,
    versions: verifiedVersions,
    alternatives: verifiedVersions.length === 0 ? getLawfulAlternatives(targetPaper) : [],
    providerErrors,
    elapsedMs: Date.now() - startTime,
    queriedProviders: ['Unpaywall', 'OpenAlex', 'arXiv', 'Europe PMC'],
    lastChecked: new Date().toISOString()
  };

  setCachedResult(cacheKey, responsePayload);
  return responsePayload;
}

module.exports = {
  findFreeVersions,
  getLawfulAlternatives,
  DISCOVERY_CACHE
};
