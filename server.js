const express = require('express');
const cors = require('cors');
const path = require('path');
const { searchOpenAlex } = require('./lib/openalex');
const { searchArXiv } = require('./lib/arxiv');
const { scorePaperSimilarity } = require('./lib/similarity');
const { generateCitations, formatAPA7, formatIEEE, formatBibTeX } = require('./lib/citation');
const { generateMatrixRow } = require('./lib/matrix');
const { proxyPdfStream, sanitizeFilename, verifyCandidateUrl } = require('./lib/pdf_resolver');
const { findFreeVersions } = require('./lib/open_access_finder');
const { analyzeResearchPaper } = require('./lib/research_intelligence');
const { DEFAULT_SAMPLE_RESEARCH_PROFILE, compareStudyToProfile, generateSampleSizeJustificationReport } = require('./lib/research_profile');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    system: 'LitSeeker — Academic Literature Discovery & Synthesis Studio',
    timestamp: new Date().toISOString()
  });
});

// Curated Capstone Research Archetypes for 1-click test exploration
const SAMPLE_CAPSTONES = [
  {
    title: 'Automated Crop Disease Detection & Pest Classification Using Convolutional Neural Networks on Embedded Raspberry Pi',
    keywords: 'crop disease detection cnn edge computing raspberry pi',
    discipline: 'Computer Science / Agri-Tech'
  },
  {
    title: 'IoT-Based Smart Aquaponics Telemetry and Autonomous Water Quality Control Using Machine Learning',
    keywords: 'iot smart aquaponics machine learning esp32 water quality',
    discipline: 'Information Technology / IoT'
  },
  {
    title: 'Real-Time Facial Emotion Recognition for Intelligent Student Engagement Monitoring in E-Learning',
    keywords: 'facial emotion recognition student engagement deep learning computer vision',
    discipline: 'Artificial Intelligence'
  },
  {
    title: 'Blockchain-Enabled Decentralized Electronic Medical Records with Zero-Knowledge Privacy Preservation',
    keywords: 'blockchain electronic health records privacy zero knowledge smart contracts',
    discipline: 'Cybersecurity / Software Systems'
  },
  {
    title: 'Vision-Based Autonomous Drone Navigation and Obstacle Avoidance in GPS-Denied Indoor Environments',
    keywords: 'autonomous drone obstacle avoidance yolo slam computer vision',
    discipline: 'Robotics / Computer Engineering'
  }
];

app.get('/api/sample-capstones', (req, res) => {
  res.json({ samples: SAMPLE_CAPSTONES });
});

// Unified Federated Search Endpoint
app.get('/api/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  const capstoneTitle = (req.query.capstone_title || query).trim();
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 15);
  const minYear = req.query.min_year ? parseInt(req.query.min_year, 10) : null;
  const isOA = req.query.is_oa === 'true';
  const source = req.query.source || 'all'; // 'all', 'openalex', 'arxiv'
  const sortBy = req.query.sort || 'similarity'; // 'similarity', 'citations', 'year'

  if (!query) {
    return res.status(400).json({ error: 'Search query parameter "q" is required.' });
  }

  try {
    const fetchPromises = [];

    // OpenAlex query
    if (source === 'all' || source === 'openalex') {
      fetchPromises.push(searchOpenAlex(query, { limit, minYear, isOA, sort: sortBy }));
    }

    // arXiv query
    if (source === 'all' || source === 'arxiv') {
      fetchPromises.push(searchArXiv(query, Math.ceil(limit / 2)));
    }

    const results = await Promise.all(fetchPromises);
    let allPapers = results.flat();

    // Deduplicate papers by DOI or normalized title
    const seen = new Set();
    const uniquePapers = [];

    for (const paper of allPapers) {
      const key = paper.doi ? paper.doi.toLowerCase() : paper.title.toLowerCase().slice(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        uniquePapers.push(paper);
      }
    }

    // Apply Year & Open Access Filters if not fully caught upstream
    let filtered = uniquePapers;
    if (minYear) {
      filtered = filtered.filter(p => p.publicationYear >= minYear);
    }
    if (isOA) {
      filtered = filtered.filter(p => p.isOpenAccess);
    }

    // Compute Semantic Similarity & RRL Synthesis Data for each paper
    const processedPapers = filtered.map((paper, index) => {
      const similarityData = scorePaperSimilarity(capstoneTitle || query, paper);
      const citations = generateCitations(paper, index + 1);
      const matrixData = generateMatrixRow(paper, capstoneTitle || query);

      return {
        ...paper,
        similarity: similarityData,
        citations,
        matrix: matrixData
      };
    });

    // Sort papers
    if (sortBy === 'similarity') {
      processedPapers.sort((a, b) => b.similarity.score - a.similarity.score);
    } else if (sortBy === 'citations') {
      processedPapers.sort((a, b) => (b.citedByCount || 0) - (a.citedByCount || 0));
    } else if (sortBy === 'year') {
      processedPapers.sort((a, b) => b.publicationYear - a.publicationYear);
    }

    res.json({
      query,
      capstoneTitle,
      total: processedPapers.length,
      papers: processedPapers.slice(0, limit)
    });
  } catch (err) {
    console.error(`[Search API Error]: ${err.message}`);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// Dynamic Citation Generator Endpoint
app.post('/api/cite', (req, res) => {
  const { papers, paper, style = 'apa7' } = req.body;
  const list = papers || (paper ? [paper] : []);

  if (list.length === 0) {
    return res.status(400).json({ error: 'Paper data is required' });
  }

  const formattedList = list.map((p, idx) => {
    const bundle = generateCitations(p, idx + 1);
    return {
      id: p.id,
      title: p.title,
      selectedCitation: bundle[style] || bundle.apa7,
      allStyles: bundle
    };
  });

  res.json({ citations: formattedList });
});

// Chapter 2 Synthesis Matrix Endpoint
app.post('/api/synthesize', (req, res) => {
  const { papers, capstoneTitle = '' } = req.body;
  if (!papers || !Array.isArray(papers)) {
    return res.status(400).json({ error: 'Array of papers is required' });
  }

  const matrixRows = papers.map(p => generateMatrixRow(p, capstoneTitle));
  res.json({ matrix: matrixRows });
});

// PDF Proxy & Streaming Endpoint
app.get('/api/pdf/proxy', (req, res) => {
  let targetUrl = req.query.url;
  const doi = req.query.doi;
  const filename = req.query.filename || 'academic_paper.pdf';

  if (!targetUrl && doi) {
    targetUrl = doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
  }

  if (!targetUrl) {
    return res.status(400).send('Missing "url" parameter');
  }

  proxyPdfStream(targetUrl, res, filename).catch((err) => {
    console.error(`[PDF Proxy Uncaught Error]: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'proxy_failed',
        message: `Failed to proxy academic document: ${err.message}`
      });
    }
  });
});

// --- Open Access Paper Finder Endpoints ---
const handleOpenAccessFind = async (req, res) => {
  const paper = req.body?.paper || req.body || {};
  const doi = req.query.doi || paper.doi;
  const title = req.query.title || paper.title;
  const year = req.query.year || paper.publicationYear || paper.year;
  const authors = req.query.authors || paper.authors;
  const authorList = Array.isArray(authors) 
    ? authors 
    : (typeof authors === 'string' ? authors.split(',').map(a => a.trim()).filter(Boolean) : []);

  if (!doi && !title) {
    return res.status(400).json({ error: 'Either "doi" or "title" parameter is required.' });
  }

  try {
    const target = {
      doi: doi ? String(doi).trim() : null,
      title: title ? String(title).trim() : '',
      authors: authorList,
      publicationYear: year ? parseInt(year, 10) : null
    };

    const skipCache = req.query.refresh === 'true' || req.query.skipCache === 'true';
    const result = await findFreeVersions(target, { verifyUrls: true, skipCache });
    res.json(result);
  } catch (err) {
    console.error(`[OA Finder Error]: ${err.message}`);
    res.status(500).json({ error: 'Failed to search open access versions', details: err.message });
  }
};

app.get('/api/open-access/find', handleOpenAccessFind);
app.post('/api/open-access/find', handleOpenAccessFind);
app.get('/api/oa/discover', handleOpenAccessFind);
app.post('/api/oa/discover', handleOpenAccessFind);
app.get('/api/open-access/discover', handleOpenAccessFind);
app.post('/api/open-access/discover', handleOpenAccessFind);
app.get('/api/oa/find', handleOpenAccessFind);
app.post('/api/oa/find', handleOpenAccessFind);

app.post('/api/open-access/verify', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }

  try {
    const verification = await verifyCandidateUrl(url, 4000);
    res.json(verification);
  } catch (err) {
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
});

// --- Research Intelligence & Methodology Endpoints ---
app.get('/api/research/sample-profile', (req, res) => {
  res.json({ profile: DEFAULT_SAMPLE_RESEARCH_PROFILE });
});

app.post('/api/research/analyze', (req, res) => {
  const { paper, fullText = '' } = req.body;
  if (!paper) {
    return res.status(400).json({ error: 'Paper object is required.' });
  }

  try {
    const analysis = analyzeResearchPaper(paper, fullText);
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

app.post('/api/research/compare', (req, res) => {
  const { profile = DEFAULT_SAMPLE_RESEARCH_PROFILE, paper, papers, fullText = '' } = req.body;
  const list = papers || (paper ? [paper] : []);

  if (list.length === 0) {
    return res.status(400).json({ error: 'Paper or papers array is required.' });
  }

  try {
    const comparisons = list.map(p => compareStudyToProfile(profile, p, fullText));
    res.json({ comparisons });
  } catch (err) {
    res.status(500).json({ error: 'Comparison failed', details: err.message });
  }
});

app.post('/api/research/justification-report', (req, res) => {
  const { profile = DEFAULT_SAMPLE_RESEARCH_PROFILE, papers = [] } = req.body;

  try {
    const comparedStudies = papers.map(p => compareStudyToProfile(profile, p));
    const report = generateSampleSizeJustificationReport(profile, comparedStudies);
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate justification report', details: err.message });
  }
});

// Catch-all for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server only when executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[LitSeeker] Server online at http://localhost:${PORT}`);
  });
}

module.exports = app;
