/**
 * Open Access PDF Resolver & CORS Streaming Proxy
 * Enables seamless in-browser downloading and viewing of open-access academic papers.
 */

const https = require('https');
const http = require('http');

/**
 * Clean filename for PDF downloads
 */
function sanitizeFilename(paper) {
  const author = (paper.authors && paper.authors[0]) 
    ? paper.authors[0].split(/\s+/).pop().replace(/[^a-zA-Z0-9]/g, '') 
    : 'ResearchPaper';
  const year = paper.publicationYear || paper.year || '2024';
  const titleSnippet = (paper.title || 'study')
    .slice(0, 40)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_');
  return `${author}_${year}_${titleSnippet}.pdf`;
}

/**
 * Proxy and stream PDF directly to client response
 */
function proxyPdfStream(targetUrl, clientRes, customFilename = 'paper.pdf') {
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return clientRes.status(400).send('Invalid or missing PDF URL');
  }

  const client = targetUrl.startsWith('https') ? https : http;

  const req = client.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/pdf,application/octet-stream,*/*'
    }
  }, (upstreamRes) => {
    // Follow redirect if 301, 302, 307, 308
    if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
      const redirectUrl = upstreamRes.headers.location.startsWith('http') 
        ? upstreamRes.headers.location 
        : new URL(upstreamRes.headers.location, targetUrl).toString();
      return proxyPdfStream(redirectUrl, clientRes, customFilename);
    }

    if (upstreamRes.statusCode !== 200) {
      return clientRes.status(upstreamRes.statusCode).send(`Upstream server returned status ${upstreamRes.statusCode}`);
    }

    // Set headers for download / viewing
    clientRes.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'application/pdf');
    clientRes.setHeader('Content-Disposition', `inline; filename="${customFilename}"`);
    if (upstreamRes.headers['content-length']) {
      clientRes.setHeader('Content-Length', upstreamRes.headers['content-length']);
    }

    upstreamRes.pipe(clientRes);
  });

  req.on('error', (err) => {
    console.error(`[PDF Proxy Error]: ${err.message}`);
    if (!clientRes.headersSent) {
      clientRes.status(502).send(`Failed to stream PDF: ${err.message}`);
    }
  });

  req.setTimeout(12000, () => {
    req.destroy();
    if (!clientRes.headersSent) {
      clientRes.status(504).send('PDF download timed out after 12 seconds');
    }
  });
}

module.exports = {
  sanitizeFilename,
  proxyPdfStream
};
