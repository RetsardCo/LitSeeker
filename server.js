const express = require('express');
const cors = require('cors');
const path = require('path');
const { searchOpenAlex } = require('./lib/openalex');
const { searchArXiv } = require('./lib/arxiv');
const { scorePaperSimilarity } = require('./lib/similarity');
const { generateCitations, formatAPA7, formatIEEE, formatBibTeX } = require('./lib/citation');
const { generateMatrixRow } = require('./lib/matrix');
const { proxyPdfStream, sanitizeFilename } = require('./lib/pdf_resolver');

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
    system: 'LitFinder — Academic Literature Discovery & Synthesis Studio',
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
  const targetUrl = req.query.url;
  const filename = req.query.filename || 'academic_paper.pdf';

  if (!targetUrl) {
    return res.status(400).send('Missing "url" parameter');
  }

  proxyPdfStream(targetUrl, res, filename);
});

// Catch-all for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server only when executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[LitFinder] Server online at http://localhost:${PORT}`);
  });
}

module.exports = app;
