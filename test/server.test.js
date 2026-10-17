const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

test('API: Health endpoint returns status online', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'online');
    assert.equal(body.system, 'LitFinder — Academic Literature Discovery & Synthesis Studio');
  } finally {
    server.close();
  }
});

test('API: Search endpoint handles query and returns scored papers', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/search?q=crop+disease+detection&limit=3`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.papers && body.papers.length > 0);
    const first = body.papers[0];
    assert.ok(first.title);
    assert.ok(first.similarity);
    assert.ok(first.citations);
    assert.ok(first.matrix);
  } finally {
    server.close();
  }
});

test('API: Citation generator formats paper in requested style', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const testPaper = {
      id: 'cite-p1',
      title: 'Neural Networks for Edge Devices',
      authors: ['Jane Doe', 'John Smith'],
      publicationYear: 2023,
      journal: 'IEEE Micro',
      doi: '10.1109/MICRO.2023.1001'
    };

    const res = await fetch(`http://localhost:${port}/api/cite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paper: testPaper, style: 'apa7' })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.citations && body.citations.length > 0);
    assert.ok(body.citations[0].selectedCitation.includes('Doe, J., & Smith, J.'));
  } finally {
    server.close();
  }
});
