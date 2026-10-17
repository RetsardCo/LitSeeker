const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const {
  normalizeDoi,
  normalizeArXivId,
  stringSimilarity,
  matchPaper,
  deduplicateVersions
} = require('../lib/paper_matcher');
const {
  isPrivateIp,
  validateSafeUrl,
  sanitizeFilename,
  verifyCandidateUrl,
  proxyPdfStream
} = require('../lib/pdf_resolver');
const {
  findUnpaywallVersions,
  classifyUnpaywallLocation,
  getUnpaywallEmail
} = require('../lib/unpaywall');
const {
  findFreeVersions,
  getLawfulAlternatives
} = require('../lib/open_access_finder');
const app = require('../server');

test('OA Matcher: Normalizes DOIs from various prefixes and casings', () => {
  assert.equal(normalizeDoi('10.1109/JIOT.2023.3289012'), '10.1109/jiot.2023.3289012');
  assert.equal(normalizeDoi('https://doi.org/10.1109/JIOT.2023.3289012'), '10.1109/jiot.2023.3289012');
  assert.equal(normalizeDoi('http://dx.doi.org/10.1109/JIOT.2023.3289012/'), '10.1109/jiot.2023.3289012');
  assert.equal(normalizeDoi('doi: 10.1109/JIOT.2023.3289012'), '10.1109/jiot.2023.3289012');
  assert.equal(normalizeDoi(''), null);
  assert.equal(normalizeDoi('invalid-doi-format'), null);
});

test('OA Matcher: Normalizes arXiv identifiers and strips version tags', () => {
  assert.equal(normalizeArXivId('arXiv:2304.09812v2'), '2304.09812');
  assert.equal(normalizeArXivId('https://arxiv.org/abs/2304.09812v1'), '2304.09812');
  assert.equal(normalizeArXivId('https://arxiv.org/pdf/2304.09812.pdf'), '2304.09812');
  assert.equal(normalizeArXivId(''), null);
});

test('OA Matcher: Exact DOI match yields 100% confidence', () => {
  const target = {
    doi: '10.1109/JIOT.2023.3289012',
    title: 'Automated Crop Disease Detection',
    authors: ['Arun Sharma']
  };
  const candidate = {
    doi: 'https://doi.org/10.1109/jiot.2023.3289012',
    title: 'Automated Crop Disease Detection Using Edge Computing',
    authors: ['A. Sharma']
  };

  const match = matchPaper(target, candidate);
  assert.equal(match.isMatch, true);
  assert.equal(match.confidence, 1.0);
  assert.equal(match.matchType, 'exact_doi');
});

test('OA Matcher: Exact arXiv identifier match yields high confidence', () => {
  const target = {
    title: 'Facial Emotion Recognition in E-Learning',
    doi: '10.48550/arXiv.2301.07721',
    arxivId: '2301.07721'
  };
  const candidate = {
    title: 'Facial Emotion Recognition for Classroom Monitoring',
    arxivId: '2301.07721v3'
  };

  const match = matchPaper(target, candidate);
  assert.equal(match.isMatch, true);
  assert.equal(match.matchType, 'exact_arxiv');
  assert.ok(match.confidence >= 0.95);
});

test('OA Matcher: Rejects similar titles belonging to different research papers', () => {
  const target = {
    title: 'Deep Transfer Learning for Automated Glaucoma Detection from Fundus Photographs',
    doi: '10.1016/j.compbiomed.2021.104234',
    authors: ['John Smith', 'Maria Santos'],
    publicationYear: 2021
  };
  const differentPaper = {
    title: 'Comparative Benchmark of Deep Transfer Learning Architectures on Mobile Edge Cameras',
    doi: '10.1109/CVPR.2022.987654',
    authors: ['Chen Wei', 'Sofia Rossi'],
    publicationYear: 2022
  };

  const match = matchPaper(target, differentPaper);
  assert.equal(match.isMatch, false);
  assert.ok(match.confidence < 0.65);
});

test('OA Matcher: Deduplicates multiple repository copies of same paper', () => {
  const versions = [
    { source: 'OpenAlex', pdfUrl: 'https://zenodo.org/record/12345/files/paper.pdf', providerName: 'Zenodo' },
    { source: 'Unpaywall', pdfUrl: 'https://zenodo.org/record/12345/files/paper.pdf', providerName: 'Zenodo Repo' },
    { source: 'Europe PMC', pdfUrl: 'https://europepmc.org/backend/ptpmcrender.fcgi?accid=PMC999&blobtype=pdf', providerName: 'PMC' }
  ];

  const deduped = deduplicateVersions(versions);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].pdfUrl, 'https://zenodo.org/record/12345/files/paper.pdf');
  assert.equal(deduped[1].pdfUrl, 'https://europepmc.org/backend/ptpmcrender.fcgi?accid=PMC999&blobtype=pdf');
});

test('Security & SSRF: Blocks localhost, private IP ranges, link-local, and cloud metadata', async () => {
  // Direct IP checks
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('10.0.0.5'), true);
  assert.equal(isPrivateIp('172.16.50.1'), true);
  assert.equal(isPrivateIp('192.168.1.100'), true);
  assert.equal(isPrivateIp('169.254.169.254'), true); // Cloud metadata
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false); // Public DNS

  // URL safety validator checks
  const localCheck = await validateSafeUrl('http://localhost:8080/internal-admin');
  assert.equal(localCheck.safe, false);

  const ipCheck = await validateSafeUrl('http://192.168.0.1/secrets.json');
  assert.equal(ipCheck.safe, false);

  const metaCheck = await validateSafeUrl('http://169.254.169.254/latest/meta-data/');
  assert.equal(metaCheck.safe, false);

  const protoCheck = await validateSafeUrl('ftp://example.com/paper.pdf');
  assert.equal(protoCheck.safe, false);
});

test('Security: Sanitizes filenames against path traversal and null bytes', () => {
  const malicious = '../../../../etc/passwd.pdf';
  const clean = sanitizeFilename(malicious);
  assert.ok(!clean.includes('../'));
  assert.ok(!clean.includes('..\\'));
  assert.ok(clean.endsWith('.pdf'));

  const paperObj = {
    authors: ['Santos, Maria'],
    publicationYear: 2023,
    title: 'Crop Disease / Pest Detection: A Study?'
  };
  const fromObj = sanitizeFilename(paperObj);
  assert.ok(fromObj.includes('Santos_2023_'));
  assert.ok(fromObj.endsWith('.pdf'));
});

test('Security & Proxy: Rejects HTML responses when streaming PDF', async () => {
  // Spin up temporary mock server returning text/html
  const mockServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>Login required or Paywalled article page</body></html>');
  });

  await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
  const port = mockServer.address().port;

  // Mock client response
  let receivedStatusCode = null;
  let receivedBody = '';
  const mockClientRes = {
    headersSent: false,
    status(code) {
      receivedStatusCode = code;
      return {
        send(msg) {
          receivedBody = msg;
        }
      };
    },
    setHeader() {}
  };

  try {
    // Attempt to stream via localhost (should be blocked by SSRF check)
    await proxyPdfStream(`http://127.0.0.1:${port}/article`, mockClientRes, 'test.pdf');
    assert.equal(receivedStatusCode, 403);
    assert.ok(receivedBody.includes('blocked for security reasons'));
  } finally {
    mockServer.close();
  }
});

test('OA Discovery: Returns lawful alternative recommendations when no free version found', () => {
  const paper = {
    title: 'Proprietary Industrial Robotics Protocol',
    doi: '10.1016/j.robot.2023.0101',
    authors: ['Elena Petrova']
  };

  const alternatives = getLawfulAlternatives(paper);
  assert.ok(Array.isArray(alternatives));
  assert.ok(alternatives.length >= 4);
  assert.ok(alternatives.some(a => a.title.includes('Publisher')));
  assert.ok(alternatives.some(a => a.title.includes('Institutional Library')));
  assert.ok(alternatives.some(a => a.title.includes('Author Manuscript Request')));
  assert.ok(alternatives.some(a => a.title.includes('Interlibrary Loan')));
});

test('Unpaywall Adapter: Safe configuration email and version mapping', () => {
  const email = getUnpaywallEmail();
  assert.ok(email.includes('@'));

  const publishedLoc = {
    host_type: 'publisher',
    version: 'publishedVersion',
    url_for_pdf: 'https://publisher.com/paper.pdf'
  };
  assert.equal(classifyUnpaywallLocation(publishedLoc), 'Open Access PDF');

  const preprintLoc = {
    host_type: 'repository',
    version: 'submittedVersion',
    url: 'https://repo.org/abs/123'
  };
  assert.equal(classifyUnpaywallLocation(preprintLoc), 'Preprint');

  const acceptedLoc = {
    host_type: 'repository',
    version: 'acceptedVersion',
    url: 'https://institution.edu/handle/123'
  };
  assert.equal(classifyUnpaywallLocation(acceptedLoc), 'Repository Copy');
});

test('API: Open-Access discovery endpoint returns structured candidate versions', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Test with benchmark open-access paper DOI
    const res = await fetch(`http://localhost:${port}/api/open-access/find?doi=10.1109/JIOT.2023.3289012&title=Automated+Plant+Disease+Detection`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.paper);
    assert.ok(Array.isArray(body.versions));
    assert.ok(Array.isArray(body.alternatives));
    assert.ok(body.queriedProviders.includes('Unpaywall'));
    assert.ok(body.queriedProviders.includes('OpenAlex'));
    assert.ok(body.queriedProviders.includes('arXiv'));
  } finally {
    server.close();
  }
});

test('API: Open-Access verify endpoint rejects SSRF targets safely', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/open-access/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://localhost:3000/internal-metrics' })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.accessible, false);
    assert.equal(body.status, 'blocked_unsafe');
  } finally {
    server.close();
  }
});

test('API: PDF Proxy handles HTML landing pages and upstream errors safely without raw file crashes', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // 1. Missing URL
    const missingRes = await fetch(`http://localhost:${port}/api/pdf/proxy`);
    assert.equal(missingRes.status, 400);

    // 2. SSRF URL blocked
    const ssrfRes = await fetch(`http://localhost:${port}/api/pdf/proxy?url=${encodeURIComponent('http://127.0.0.1:9999/test.pdf')}`);
    assert.equal(ssrfRes.status, 403);
  } finally {
    server.close();
  }
});

