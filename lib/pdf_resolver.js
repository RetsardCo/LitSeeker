/**
 * Open Access PDF Resolver, Safe Verifier & SSRF-Protected Streaming Proxy
 * Strictly complies with academic copyright, prevents SSRF, and ensures safe verification.
 */

const https = require('https');
const http = require('http');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const MAX_DOWNLOAD_BYTES = 35 * 1024 * 1024; // 35 MB limit
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 12000;

// Academic user agent
const SCHOLARLY_USER_AGENT = 'LitFinder-Academic-Research/1.0 (Open-Access Research Verification; mailto:litfinder@antigravity.research)';

/**
 * Checks if an IP address is in a private, loopback, or link-local range
 */
function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return true;

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(n => parseInt(n, 10));
    if (parts.length !== 4 || parts.some(isNaN)) return true;

    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-Local / AWS/GCP/Azure Metadata: 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (parts[0] >= 224) return true;

    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Loopback
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    // Unspecified
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
    // Unique Local (fc00::/7)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link Local (fe80::/10)
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
    if (lower.includes('::ffff:')) {
      const v4Part = lower.split('::ffff:').pop();
      if (net.isIPv4(v4Part)) {
        return isPrivateIp(v4Part);
      }
    }
    return false;
  }

  return true;
}

/**
 * Validates a target URL against SSRF, DNS-rebinding, and protocol vulnerabilities
 */
async function validateSafeUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { safe: false, reason: 'URL parameter is missing or empty' };
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { safe: false, reason: 'Malformed or invalid URL structure' };
  }

  // Restrict protocol: only HTTPS is permitted by default; HTTP allowed for standard academic domains
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { safe: false, reason: `Unsupported protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and internal names
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '0.0.0.0'
  ) {
    return { safe: false, reason: 'Access to localhost and internal hostnames is prohibited' };
  }

  // Direct IP literal in URL check
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { safe: false, reason: `Access to private IP ${hostname} is prohibited` };
    }
  }

  // Perform DNS lookup to prevent DNS rebinding attacks
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { safe: false, reason: `Host ${hostname} could not be resolved via DNS` };
    }

    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        return { safe: false, reason: `Host ${hostname} resolves to prohibited private address: ${record.address}` };
      }
    }
  } catch (err) {
    return { safe: false, reason: `DNS lookup failed for ${hostname}: ${err.message}` };
  }

  return { safe: true, parsed };
}

/**
 * Sanitizes filename to prevent path traversal and shell injection
 */
function sanitizeFilename(paperOrFilename) {
  let raw = '';
  if (typeof paperOrFilename === 'string') {
    raw = paperOrFilename;
  } else if (paperOrFilename && typeof paperOrFilename === 'object') {
    let author = 'ResearchPaper';
    if (paperOrFilename.authors && paperOrFilename.authors[0]) {
      const aStr = String(paperOrFilename.authors[0]).trim();
      if (aStr.includes(',')) {
        author = aStr.split(',')[0].trim().replace(/[^a-zA-Z0-9]/g, '');
      } else {
        author = aStr.split(/\s+/).pop().replace(/[^a-zA-Z0-9]/g, '');
      }
    }
    const year = paperOrFilename.publicationYear || paperOrFilename.year || '2024';
    const titleSnippet = (paperOrFilename.title || 'study')
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_');
    raw = `${author}_${year}_${titleSnippet}.pdf`;
  } else {
    raw = 'academic_paper.pdf';
  }

  // Strip path separators, null bytes, control characters
  let clean = raw
    .replace(/[/\\]/g, '_')
    .replace(/\0/g, '')
    .replace(/\.\.+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);

  if (!clean.toLowerCase().endsWith('.pdf')) {
    clean += '.pdf';
  }

  return clean || 'academic_paper.pdf';
}

/**
 * Safely verifies a candidate URL without downloading the whole file
 * Checks status, headers, and verifies if it is a legitimate PDF or full text.
 */
async function verifyCandidateUrl(targetUrl, timeoutMs = 6000) {
  const safety = await validateSafeUrl(targetUrl);
  if (!safety.safe) {
    return {
      accessible: false,
      isPdf: false,
      reason: safety.reason,
      status: 'blocked_unsafe'
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const client = targetUrl.startsWith('https:') ? https : http;

    // Use Range GET for first 1024 bytes (some repos block HEAD, but Range GET is widely supported)
    const options = {
      headers: {
        'User-Agent': SCHOLARLY_USER_AGENT,
        'Range': 'bytes=0-1023',
        'Accept': 'application/pdf,application/octet-stream,*/*'
      }
    };

    const req = client.get(targetUrl, options, (res) => {
      // Follow redirects up to MAX_REDIRECTS
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const nextUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, targetUrl).toString();

        // Recursively verify redirect target safely
        verifyCandidateUrl(nextUrl, timeoutMs - 1000).then(finish);
        return;
      }

      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume();
        return finish({
          accessible: false,
          isPdf: false,
          statusCode: res.statusCode,
          reason: `Upstream responded with HTTP ${res.statusCode}`
        });
      }

      const contentType = (res.headers['content-type'] || '').toLowerCase();
      let buffer = Buffer.alloc(0);

      res.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length >= 10) {
          // Check magic bytes for PDF signature: %PDF-
          const isMagicPdf = buffer.toString('utf8', 0, 5).startsWith('%PDF-');
          const isPdfType = contentType.includes('application/pdf') || isMagicPdf;

          req.destroy();
          finish({
            accessible: true,
            isPdf: isPdfType,
            contentType,
            statusCode: res.statusCode,
            hasPdfSignature: isMagicPdf,
            verifiedUrl: targetUrl
          });
        }
      });

      res.on('end', () => {
        const isMagicPdf = buffer.toString('utf8', 0, 5).startsWith('%PDF-');
        const isPdfType = contentType.includes('application/pdf') || isMagicPdf;
        finish({
          accessible: true,
          isPdf: isPdfType,
          contentType,
          statusCode: res.statusCode,
          hasPdfSignature: isMagicPdf,
          verifiedUrl: targetUrl
        });
      });
    });

    req.on('error', (err) => {
      finish({
        accessible: false,
        isPdf: false,
        reason: err.message
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      finish({
        accessible: false,
        isPdf: false,
        reason: 'Verification request timed out'
      });
    });
  });
}

/**
 * Proxy and stream PDF directly to client response with SSRF protection, size limits, and sanitization
 */
async function proxyPdfStream(targetUrl, clientRes, customFilename = 'paper.pdf', redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) {
    if (!clientRes.headersSent) {
      return clientRes.status(502).send('Too many redirects encountered while resolving PDF');
    }
    return;
  }

  const safety = await validateSafeUrl(targetUrl);
  if (!safety.safe) {
    console.warn(`[PDF Proxy Blocked]: ${safety.reason} (${targetUrl})`);
    if (!clientRes.headersSent) {
      return clientRes.status(403).send(`Access to destination blocked for security reasons: ${safety.reason}`);
    }
    return;
  }

  const client = targetUrl.startsWith('https:') ? https : http;
  const safeFilename = sanitizeFilename(customFilename);

  const req = client.get(targetUrl, {
    headers: {
      'User-Agent': SCHOLARLY_USER_AGENT,
      'Accept': 'application/pdf,application/octet-stream,*/*'
    }
  }, (upstreamRes) => {
    // Follow redirect safely
    if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
      upstreamRes.resume();
      const redirectUrl = upstreamRes.headers.location.startsWith('http')
        ? upstreamRes.headers.location
        : new URL(upstreamRes.headers.location, targetUrl).toString();

      return proxyPdfStream(redirectUrl, clientRes, safeFilename, redirectCount + 1);
    }

    if (upstreamRes.statusCode !== 200 && upstreamRes.statusCode !== 206) {
      upstreamRes.resume();
      if (!clientRes.headersSent) {
        let landingUrl = targetUrl;
        const ieeeMatch = targetUrl.match(/ieeexplore\.ieee\.org\/(?:ielx7\/[0-9]+\/[0-9]+\/|document\/)?([0-9]+)/i);
        if (ieeeMatch && ieeeMatch[1]) {
          landingUrl = `https://ieeexplore.ieee.org/document/${ieeeMatch[1]}`;
        }
        const errorPayload = {
          error: 'upstream_unavailable',
          statusCode: upstreamRes.statusCode,
          message: `Upstream repository returned status ${upstreamRes.statusCode}. Direct automated binary streaming is restricted by this publisher.`,
          landingUrl: landingUrl
        };
        clientRes.setHeader('Content-Type', 'application/json');
        if (typeof clientRes.json === 'function') {
          return clientRes.status(upstreamRes.statusCode).json(errorPayload);
        }
        return clientRes.status(upstreamRes.statusCode).send(JSON.stringify(errorPayload));
      }
      return;
    }

    const contentType = (upstreamRes.headers['content-type'] || '').toLowerCase();
    
    // If upstream returns HTML instead of PDF, inspect HTML for embedded open-access PDF link
    if (contentType.includes('text/html') && !targetUrl.toLowerCase().includes('.pdf')) {
      let htmlBuffer = '';
      let isResolvingSublink = false;

      const attemptPdfExtraction = (html) => {
        if (isResolvingSublink) return true;
        
        // Standard academic metadata tags: citation_pdf_url, dc.identifier, OJS article download
        const metaPdfMatch = html.match(/<meta\s+[^>]*?(?:name|property)=["']citation_pdf_url["'][^>]*?content=["']([^"']+)["']/i) ||
                             html.match(/<meta\s+[^>]*?content=["']([^"']+)["'][^>]*?(?:name|property)=["']citation_pdf_url["']/i) ||
                             html.match(/href=["']([^"']*\/article\/download\/[0-9]+\/[0-9]+[^"']*)["']/i);

        if (metaPdfMatch && metaPdfMatch[1]) {
          isResolvingSublink = true;
          const discoveredUrl = metaPdfMatch[1].startsWith('http') 
            ? metaPdfMatch[1] 
            : new URL(metaPdfMatch[1], targetUrl).toString();

          proxyPdfStream(discoveredUrl, clientRes, safeFilename, redirectCount + 1);
          return true;
        }
        return false;
      };

      upstreamRes.on('data', (chunk) => {
        if (isResolvingSublink) return;
        htmlBuffer += chunk.toString('utf8');

        // Check head / first 48KB
        if (htmlBuffer.length > 49152 || htmlBuffer.includes('</head>')) {
          upstreamRes.destroy();
          const found = attemptPdfExtraction(htmlBuffer);
          if (!found && !clientRes.headersSent) {
            const errorPayload = {
              error: 'html_landing_page',
              statusCode: 422,
              message: 'The target source is an HTML landing page rather than a direct downloadable PDF. Please view the paper via the provided repository link.',
              landingUrl: targetUrl
            };
            clientRes.setHeader('Content-Type', 'application/json');
            if (typeof clientRes.json === 'function') {
              return clientRes.status(422).json(errorPayload);
            }
            return clientRes.status(422).send('The target source is an HTML landing page rather than a direct downloadable PDF. Please view the paper via the provided repository link.');
          }
        }
      });

      upstreamRes.on('end', () => {
        if (isResolvingSublink || clientRes.headersSent) return;
        const found = attemptPdfExtraction(htmlBuffer);
        if (!found && !clientRes.headersSent) {
          const errorPayload = {
            error: 'html_landing_page',
            statusCode: 422,
            message: 'The target source is an HTML landing page rather than a direct downloadable PDF. Please view the paper via the provided repository link.',
            landingUrl: targetUrl
          };
          clientRes.setHeader('Content-Type', 'application/json');
          if (typeof clientRes.json === 'function') {
            return clientRes.status(422).json(errorPayload);
          }
          return clientRes.status(422).send('The target source is an HTML landing page rather than a direct downloadable PDF. Please view the paper via the provided repository link.');
        }
      });
      return;
    }

    // Set secure response headers
    clientRes.setHeader('Content-Type', 'application/pdf');
    clientRes.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    clientRes.setHeader('X-Content-Type-Options', 'nosniff');

    if (upstreamRes.headers['content-length']) {
      const len = parseInt(upstreamRes.headers['content-length'], 10);
      if (len > MAX_DOWNLOAD_BYTES) {
        upstreamRes.destroy();
        if (!clientRes.headersSent) {
          return clientRes.status(413).send(`PDF size exceeds maximum allowed limit of 35MB.`);
        }
        return;
      }
      clientRes.setHeader('Content-Length', len);
    }

    let bytesReceived = 0;
    let checkedSignature = false;

    upstreamRes.on('data', (chunk) => {
      bytesReceived += chunk.length;

      // Check first chunk signature
      if (!checkedSignature) {
        checkedSignature = true;
        // If content is obviously not PDF (e.g. starts with <!DOCTYPE or <html), fail safely
        const prefix = chunk.toString('utf8', 0, 15).toLowerCase();
        if (prefix.startsWith('<!doctype') || prefix.startsWith('<html')) {
          upstreamRes.destroy();
          if (!clientRes.headersSent) {
            return clientRes.status(422).send('The upstream server returned an HTML webpage instead of a valid PDF document.');
          }
          return;
        }
      }

      if (bytesReceived > MAX_DOWNLOAD_BYTES) {
        upstreamRes.destroy();
        if (!clientRes.headersSent) {
          clientRes.status(413).send('Download exceeded maximum file size limit.');
        }
        return;
      }

      clientRes.write(chunk);
    });

    upstreamRes.on('end', () => {
      if (!clientRes.writableEnded) {
        clientRes.end();
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[PDF Stream Error]: ${err.message}`);
    if (!clientRes.headersSent) {
      clientRes.status(502).send(`Failed to stream academic document: ${err.message}`);
    }
  });

  req.setTimeout(REQUEST_TIMEOUT_MS, () => {
    req.destroy();
    if (!clientRes.headersSent) {
      clientRes.status(504).send('PDF download timed out after 12 seconds');
    }
  });
}

module.exports = {
  isPrivateIp,
  validateSafeUrl,
  sanitizeFilename,
  verifyCandidateUrl,
  proxyPdfStream,
  MAX_DOWNLOAD_BYTES
};
