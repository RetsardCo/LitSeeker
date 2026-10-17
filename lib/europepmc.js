/**
 * Europe PMC Provider Adapter
 * Queries Europe PMC REST API for verified biomedical, life-sciences, and institutional repository full-text copies.
 */

const { normalizeDoi, matchPaper } = require('./paper_matcher');

/**
 * Searches Europe PMC for legitimate open-access versions of a paper
 */
async function findEuropePmcVersions(targetPaper, options = {}) {
  const timeoutMs = options.timeoutMs || 6000;
  const doi = normalizeDoi(targetPaper.doi);
  const title = (targetPaper.title || '').trim();

  let query = '';
  if (doi) {
    query = `DOI:"${doi}"`;
  } else if (title) {
    const cleanTitle = title.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    query = `TITLE:"${cleanTitle}"`;
  } else {
    return [];
  }

  const endpoint = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&resultType=core&pageSize=5`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LitFinder-Scholarly-Engine/1.0 (mailto:litfinder@antigravity.research)'
      }
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Europe PMC HTTP ${res.status}`);
    }

    const data = await res.json();
    const resultList = data.resultList?.result || [];
    if (resultList.length === 0) return [];

    const versions = [];

    for (const record of resultList) {
      // Validate identity match with target paper
      const candidateMeta = {
        title: record.title || '',
        doi: record.doi || null,
        authors: (record.authorString || '').split(',').map(s => s.trim()),
        publicationYear: record.pubYear ? parseInt(record.pubYear, 10) : null
      };

      const match = matchPaper(targetPaper, candidateMeta);
      if (!match.isMatch || match.confidence < 0.68) continue;

      const isOA = record.isOpenAccess === 'Y' || record.inEpmc === 'Y';
      if (!isOA && !record.pmcid) continue;

      let directPdfUrl = null;
      let landingUrl = record.pmcid 
        ? `https://europepmc.org/article/PMC/${record.pmcid}` 
        : `https://europepmc.org/article/MED/${record.id}`;

      if (record.pmcid) {
        directPdfUrl = `https://europepmc.org/backend/ptpmcrender.fcgi?accid=${record.pmcid}&blobtype=pdf`;
      }

      // Check fullTextUrlList for direct PDFs or repository URLs
      const ftList = record.fullTextUrlList?.fullTextUrl || [];
      for (const ft of ftList) {
        if (ft.documentStyle === 'pdf' && (ft.availability === 'Open access' || ft.availability === 'Free')) {
          directPdfUrl = ft.url;
          break;
        }
      }

      const isPreprint = record.pubType === 'preprint' || (record.journalTitle || '').toLowerCase().includes('biorxiv') || (record.journalTitle || '').toLowerCase().includes('medrxiv');

      let classification = 'Free Full Text';
      if (directPdfUrl) {
        classification = 'Open Access PDF';
      } else if (isPreprint) {
        classification = 'Preprint';
      } else if (record.pmcid) {
        classification = 'Repository Copy';
      }

      versions.push({
        source: 'Europe PMC',
        providerName: record.pmcid ? 'PubMed Central (Europe PMC Repository)' : (record.journalTitle || 'Europe PMC'),
        url: directPdfUrl || landingUrl,
        pdfUrl: directPdfUrl,
        landingPageUrl: landingUrl,
        version: isPreprint ? 'Submitted Manuscript (Preprint)' : 'Version of Record / Accepted Manuscript',
        hostType: record.pmcid ? 'repository' : 'publisher',
        license: isOA ? 'Open Access (PMC/Europe PMC)' : 'Free to Read',
        accessClassification: classification,
        pmcid: record.pmcid || null,
        verified: false,
        confidence: match.confidence,
        confidencePercent: match.confidencePercent,
        lastChecked: new Date().toISOString()
      });
    }

    return versions;
  } catch (err) {
    console.warn(`[Europe PMC Warning]: ${err.message}`);
    return [];
  }
}

module.exports = {
  findEuropePmcVersions
};
