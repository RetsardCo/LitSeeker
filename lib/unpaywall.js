/**
 * Unpaywall API Provider Adapter
 * Queries the Unpaywall API to discover legal open-access copies of papers via DOI.
 */

const { normalizeDoi } = require('./paper_matcher');

const DEFAULT_EMAIL = 'unpaywall-access@litfinder.research';

function getUnpaywallEmail() {
  return process.env.UNPAYWALL_EMAIL || DEFAULT_EMAIL;
}

/**
 * Maps Unpaywall version string to human-readable academic classification
 */
function mapVersionName(version) {
  switch (version) {
    case 'publishedVersion':
      return 'Version of Record (Published)';
    case 'acceptedVersion':
      return 'Accepted Manuscript (Post-print)';
    case 'submittedVersion':
      return 'Submitted Manuscript (Preprint)';
    default:
      return 'Open Access Version';
  }
}

/**
 * Maps Unpaywall location to LitFinder access classification
 */
function classifyUnpaywallLocation(loc) {
  const hasPdf = Boolean(loc.url_for_pdf || (loc.url && loc.url.toLowerCase().endsWith('.pdf')));
  const isRepo = loc.host_type === 'repository';
  const isPublisher = loc.host_type === 'publisher';
  const isPreprint = loc.version === 'submittedVersion';

  if (hasPdf) {
    return 'Open Access PDF';
  }
  if (isPreprint) {
    return 'Preprint';
  }
  if (isRepo) {
    return 'Repository Copy';
  }
  if (isPublisher) {
    return 'Free Publisher Version';
  }
  return 'Free Full Text';
}

/**
 * Queries Unpaywall API for a given DOI
 * Returns structured candidate versions or empty array on failure
 */
async function findUnpaywallVersions(doi, options = {}) {
  const normDoi = normalizeDoi(doi);
  if (!normDoi) {
    return [];
  }

  const timeoutMs = options.timeoutMs || 6000;
  const email = getUnpaywallEmail();
  const endpoint = `https://api.unpaywall.org/v2/${encodeURIComponent(normDoi)}?email=${encodeURIComponent(email)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LitFinder-Scholarly-Engine/1.0'
      }
    });

    clearTimeout(timeout);

    if (res.status === 404) {
      // Paper not tracked in Unpaywall or no OA record
      return [];
    }

    if (res.status === 429) {
      console.warn('[Unpaywall] Rate limit reached.');
      return [];
    }

    if (!res.ok) {
      throw new Error(`Unpaywall HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.is_oa || !Array.isArray(data.oa_locations)) {
      return [];
    }

    const versions = [];

    for (const loc of data.oa_locations) {
      const primaryUrl = loc.url_for_pdf || loc.url;
      if (!primaryUrl) continue;

      const classification = classifyUnpaywallLocation(loc);
      const repoName = loc.repository_institution || loc.host_type === 'repository' 
        ? (loc.repository_institution || 'Institutional Repository') 
        : (data.publisher || 'Publisher Open Access');

      versions.push({
        source: 'Unpaywall',
        providerName: repoName,
        url: loc.url || primaryUrl,
        pdfUrl: loc.url_for_pdf || (primaryUrl.toLowerCase().endsWith('.pdf') ? primaryUrl : null),
        landingPageUrl: loc.url_for_landing_page || loc.url || null,
        version: mapVersionName(loc.version),
        versionRaw: loc.version || 'unknown',
        hostType: loc.host_type || 'unknown',
        license: loc.license || 'Open Access (Unspecified)',
        accessClassification: classification,
        isBest: Boolean(loc.is_best),
        verified: false,
        confidence: 1.0, // Unpaywall is strictly DOI-keyed
        lastChecked: new Date().toISOString()
      });
    }

    return versions;
  } catch (err) {
    console.warn(`[Unpaywall Provider Warning]: ${err.message}`);
    return [];
  }
}

module.exports = {
  findUnpaywallVersions,
  getUnpaywallEmail,
  classifyUnpaywallLocation,
  mapVersionName
};
