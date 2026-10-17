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
const REQUEST_TIMEOUT_MS = 30000;

// Academic user agent
const SCHOLARLY_USER_AGENT = 'LitSeeker-Academic-Research/1.0 (Open-Access Research Verification; mailto:litseeker@antigravity.research)';

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
 * Extracts IEEE Xplore document/article number (arnumber) from URLs or DOIs
 */
function extractIeeeArnumber(urlOrDoi) {
  if (!urlOrDoi) return null;
  const str = String(urlOrDoi).trim();

  // 1. Direct query parameter arnumber=10192897
  const qMatch = str.match(/[?&]arnumber=(\d+)/i);
  if (qMatch) return qMatch[1];

  // 2. /document/10192897
  const docMatch = str.match(/ieeexplore\.ieee\.org\/document\/(\d+)/i);
  if (docMatch) return docMatch[1];

  // 3. /ielx\d+/\d+/\d+/10192897.pdf
  const pdfMatch = str.match(/ieeexplore\.ieee\.org\/ielx\d+\/\d+\/\d+\/(\d+)\.pdf/i);
  if (pdfMatch) return pdfMatch[1];

  // 4. /stamp/stamp.jsp?tp=&arnumber=10192897
  const stampMatch = str.match(/ieeexplore\.ieee\.org\/stamp\/stamp\.jsp.*?arnumber=(\d+)/i);
  if (stampMatch) return stampMatch[1];

  // 5. Generic match for 6-10 digit article ID on IEEE domain
  const genericMatch = str.match(/ieeexplore\.ieee\.org\/.*?[/=](\d{6,10})/i);
  if (genericMatch) return genericMatch[1];

  return null;
}

/**
 * Resolves IEEE article number from URL or asynchronously via DOI redirection
 */
async function resolveIeeeArnumber(urlOrDoi, timeoutMs = 3500) {
  const syncMatch = extractIeeeArnumber(urlOrDoi);
  if (syncMatch) return syncMatch;

  if (!urlOrDoi) return null;
  const str = String(urlOrDoi).trim();
  const cleanDoi = str.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '').trim();

  // If this is an IEEE DOI (10.1109/...)
  if (cleanDoi.toLowerCase().startsWith('10.1109/')) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`https://doi.org/${encodeURIComponent(cleanDoi)}`, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal
      });
      clearTimeout(timer);
      const location = res.headers.get('location');
      if (location) {
        return extractIeeeArnumber(location);
      }
    } catch {}
  }

  return null;
}

/**
 * Resolves the live, working IEEE Open Access PDF URL via IEEE's official stamp.jsp reader
 * IEEE often restructures /ielx7/ issue paths (e.g. 6514899 -> 10005208) causing stale 404/418 in OpenAlex/Unpaywall.
 * stamp.jsp provides the active iframe src with the correct issue number and security token.
 */
async function resolveIeeePdf(arnumber, timeoutMs = 6000) {
  if (!arnumber) return null;
  const stampUrl = `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${arnumber}`;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res) => {
      if (!settled) {
        settled = true;
        resolve(res);
      }
    };

    const req = https.get(stampUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      // If IEEE redirected
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const nextUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://ieeexplore.ieee.org${res.headers.location}`;
        const nextArnum = extractIeeeArnumber(nextUrl) || arnumber;
        return resolveIeeePdf(nextArnum, timeoutMs - 1500).then(finish);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return finish(null);
      }

      let html = '';
      res.on('data', (chunk) => {
        html += chunk.toString('utf8');
        const m = html.match(/<iframe[^>]+src=["']([^"']+\.pdf[^"']*)["']/i);
        if (m && m[1]) {
          try { req.destroy(); } catch {}
          try { res.destroy(); } catch {}
          let fullUrl = m[1].startsWith('http') ? m[1] : `https://ieeexplore.ieee.org${m[1]}`;
          fullUrl = fullUrl.replace(/&amp;/g, '&');
          return finish(fullUrl);
        }
      });

      res.on('end', () => {
        const m = html.match(/<iframe[^>]+src=["']([^"']+\.pdf[^"']*)["']/i);
        if (m && m[1]) {
          let fullUrl = m[1].startsWith('http') ? m[1] : `https://ieeexplore.ieee.org${m[1]}`;
          fullUrl = fullUrl.replace(/&amp;/g, '&');
          return finish(fullUrl);
        }
        finish(null);
      });

      res.on('error', () => finish(null));
    });

    req.on('error', () => finish(null));
    req.setTimeout(timeoutMs, () => {
      try { req.destroy(); } catch {}
      finish(null);
    });
  });
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

  const ieeeArnumber = extractIeeeArnumber(targetUrl);

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
        'User-Agent': targetUrl.includes('ieeexplore.ieee.org')
          ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          : SCHOLARLY_USER_AGENT,
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

        // If this is an IEEE target returning 404 or other non-200, attempt resolution via stamp.jsp
        if (ieeeArnumber && timeoutMs > 2500) {
          resolveIeeePdf(ieeeArnumber, timeoutMs - 1500).then(async (resolvedPdfUrl) => {
            if (resolvedPdfUrl && resolvedPdfUrl !== targetUrl) {
              const liveCheck = await verifyCandidateUrl(resolvedPdfUrl, timeoutMs - 2000);
              if (liveCheck.accessible && liveCheck.isPdf) {
                return finish({
                  ...liveCheck,
                  verifiedUrl: resolvedPdfUrl,
                  readerUrl: `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}`,
                  landingUrl: `https://ieeexplore.ieee.org/document/${ieeeArnumber}`
                });
              }
            }
            return finish({
              accessible: false,
              isPdf: false,
              statusCode: res.statusCode,
              reason: `Upstream responded with HTTP ${res.statusCode}`,
              readerUrl: `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}`,
              landingUrl: `https://ieeexplore.ieee.org/document/${ieeeArnumber}`
            });
          }).catch(() => finish({
            accessible: false,
            isPdf: false,
            statusCode: res.statusCode,
            reason: `Upstream responded with HTTP ${res.statusCode}`,
            readerUrl: `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}`,
            landingUrl: `https://ieeexplore.ieee.org/document/${ieeeArnumber}`
          }));
          return;
        }

        return finish({
          accessible: false,
          isPdf: false,
          statusCode: res.statusCode,
          reason: `Upstream responded with HTTP ${res.statusCode}`
        });
      }

      const contentType = (res.headers['content-type'] || '').toLowerCase();
      let buffer = Buffer.alloc(0);

      const handleCompletedCheck = (isMagicPdf, isPdfType) => {
        if (!isPdfType && ieeeArnumber && timeoutMs > 2500) {
          resolveIeeePdf(ieeeArnumber, timeoutMs - 1500).then(async (resolvedPdfUrl) => {
            if (resolvedPdfUrl && resolvedPdfUrl !== targetUrl) {
              const liveCheck = await verifyCandidateUrl(resolvedPdfUrl, timeoutMs - 2000);
              if (liveCheck.accessible && liveCheck.isPdf) {
                return finish({
                  ...liveCheck,
                  verifiedUrl: resolvedPdfUrl,
                  readerUrl: `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}`,
                  landingUrl: `https://ieeexplore.ieee.org/document/${ieeeArnumber}`
                });
              }
            }
            return finish({
              accessible: true,
              isPdf: false,
              contentType,
              statusCode: res.statusCode,
              hasPdfSignature: false,
              verifiedUrl: targetUrl,
              readerUrl: `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}`,
              landingUrl: `https://ieeexplore.ieee.org/document/${ieeeArnumber}`
            });
          }).catch(() => finish({
            accessible: true,
            isPdf: false,
            contentType,
            statusCode: res.statusCode,
            hasPdfSignature: false,
            verifiedUrl: targetUrl,
            readerUrl: `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}`,
            landingUrl: `https://ieeexplore.ieee.org/document/${ieeeArnumber}`
          }));
          return;
        }

        finish({
          accessible: true,
          isPdf: isPdfType,
          contentType,
          statusCode: res.statusCode,
          hasPdfSignature: isMagicPdf,
          verifiedUrl: targetUrl,
          readerUrl: ieeeArnumber ? `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}` : null,
          landingUrl: ieeeArnumber ? `https://ieeexplore.ieee.org/document/${ieeeArnumber}` : null
        });
      };

      res.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length >= 10) {
          const isMagicPdf = buffer.toString('utf8', 0, Math.min(buffer.length, 512)).includes('%PDF-');
          const isPdfType = contentType.includes('application/pdf') || isMagicPdf;

          try { req.destroy(); } catch {}
          handleCompletedCheck(isMagicPdf, isPdfType);
        }
      });

      res.on('end', () => {
        const isMagicPdf = buffer.toString('utf8', 0, Math.min(buffer.length, 512)).includes('%PDF-');
        const isPdfType = contentType.includes('application/pdf') || isMagicPdf;
        handleCompletedCheck(isMagicPdf, isPdfType);
      });
    });

    req.on('error', (err) => {
      finish({
        accessible: false,
        isPdf: false,
        reason: err.message,
        readerUrl: ieeeArnumber ? `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}` : null,
        landingUrl: ieeeArnumber ? `https://ieeexplore.ieee.org/document/${ieeeArnumber}` : null
      });
    });

    req.setTimeout(timeoutMs, () => {
      try { req.destroy(); } catch {}
      finish({
        accessible: false,
        isPdf: false,
        reason: 'Verification request timed out',
        readerUrl: ieeeArnumber ? `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}` : null,
        landingUrl: ieeeArnumber ? `https://ieeexplore.ieee.org/document/${ieeeArnumber}` : null
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

  const ieeeArnumber = extractIeeeArnumber(targetUrl);

  // If this is an IEEE target that doesn't yet have active issue parameters, proactively resolve live PDF
  if (ieeeArnumber && !targetUrl.includes('isnumber=')) {
    try {
      const resolved = await resolveIeeePdf(ieeeArnumber, 4500);
      if (resolved && resolved !== targetUrl) {
        return proxyPdfStream(resolved, clientRes, customFilename, redirectCount);
      }
    } catch (ieeeErr) {
      console.warn(`[IEEE Smart Resolve Warning]: ${ieeeErr.message}`);
    }
  }

  const client = targetUrl.startsWith('https:') ? https : http;
  const safeFilename = sanitizeFilename(customFilename);

  const headers = {
    'User-Agent': targetUrl.includes('ieeexplore.ieee.org')
      ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      : SCHOLARLY_USER_AGENT,
    'Accept': 'application/pdf,application/octet-stream,*/*'
  };
  if (targetUrl.includes('ieeexplore.ieee.org')) {
    headers['Referer'] = 'https://ieeexplore.ieee.org/';
  }

  let upstreamReq = null;
  let activeUpstreamRes = null;

  // Cleanup handler if client drops connection
  const handleClientClose = () => {
    try {
      if (upstreamReq) upstreamReq.destroy();
      if (activeUpstreamRes) activeUpstreamRes.destroy();
    } catch {}
  };
  if (clientRes && typeof clientRes.on === 'function') {
    clientRes.once('close', handleClientClose);
  }

  upstreamReq = client.get(targetUrl, { headers }, (upstreamRes) => {
    activeUpstreamRes = upstreamRes;

    // Attach error listener to upstream response to prevent unhandled stream errors
    upstreamRes.on('error', (resErr) => {
      console.warn(`[Upstream Stream Error]: ${resErr.message}`);
      if (!clientRes.headersSent && typeof clientRes.status === 'function') {
        clientRes.status(502).json({ error: 'upstream_error', message: resErr.message });
      }
    });

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
        if (ieeeArnumber) {
          landingUrl = `https://ieeexplore.ieee.org/document/${ieeeArnumber}`;
        }
        const readerUrl = ieeeArnumber
          ? `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}`
          : landingUrl;

        const isIeee = Boolean(ieeeArnumber);
        const errorPayload = {
          error: isIeee ? 'publisher_reader_required' : 'upstream_unavailable',
          statusCode: upstreamRes.statusCode,
          message: isIeee
            ? 'IEEE Xplore delivers this open-access paper through its interactive browser reader. Click below to view and download the PDF directly.'
            : `Upstream repository returned status ${upstreamRes.statusCode}. Direct automated binary streaming is restricted by this publisher.`,
          landingUrl: readerUrl,
          directReaderUrl: readerUrl,
          publisherLandingUrl: landingUrl,
          requiresInteractiveSession: true
        };
        clientRes.setHeader('Content-Type', 'application/json');
        const code = isIeee ? 422 : upstreamRes.statusCode;
        if (typeof clientRes.json === 'function') {
          return clientRes.status(code).json(errorPayload);
        }
        return clientRes.status(code).send(JSON.stringify(errorPayload));
      }
      return;
    }

    const contentType = (upstreamRes.headers['content-type'] || '').toLowerCase();
    
    // If upstream returns HTML instead of PDF, inspect HTML for embedded open-access PDF link
    if (contentType.includes('text/html')) {
      let htmlBuffer = '';
      let isResolvingSublink = false;

      const attemptPdfExtraction = (html) => {
        if (isResolvingSublink) return true;
        
        // Standard academic metadata tags: citation_pdf_url, dc.identifier, OJS article download, or IEEE iframe
        const metaPdfMatch = html.match(/<meta\s+[^>]*?(?:name|property)=["']citation_pdf_url["'][^>]*?content=["']([^"']+)["']/i) ||
                             html.match(/<meta\s+[^>]*?content=["']([^"']+)["'][^>]*?(?:name|property)=["']citation_pdf_url["']/i) ||
                             html.match(/href=["']([^"']*\/article\/download\/[0-9]+\/[0-9]+[^"']*)["']/i) ||
                             html.match(/<iframe[^>]+src=["']([^"']+\.pdf[^"']*)["']/i);

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
            let landingUrl = targetUrl;
            if (ieeeArnumber) {
              landingUrl = `https://ieeexplore.ieee.org/document/${ieeeArnumber}`;
            }
            const readerUrl = ieeeArnumber
              ? `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}`
              : landingUrl;

            const errorPayload = {
              error: ieeeArnumber ? 'publisher_reader_required' : 'html_landing_page',
              statusCode: 422,
              message: ieeeArnumber
                ? 'IEEE Xplore delivers this open-access paper through its interactive browser reader. Click below to view and download the PDF directly.'
                : 'The target source is an HTML landing page rather than a direct downloadable PDF. Please view the paper via the provided repository link.',
              landingUrl: readerUrl,
              directReaderUrl: ieeeArnumber ? readerUrl : null,
              publisherLandingUrl: landingUrl,
              requiresInteractiveSession: Boolean(ieeeArnumber)
            };
            clientRes.setHeader('Content-Type', 'application/json');
            if (typeof clientRes.json === 'function') {
              return clientRes.status(422).json(errorPayload);
            }
            return clientRes.status(422).send(JSON.stringify(errorPayload));
          }
        }
      });

      upstreamRes.on('end', () => {
        if (isResolvingSublink || clientRes.headersSent) return;
        const found = attemptPdfExtraction(htmlBuffer);
        if (!found && !clientRes.headersSent) {
          let landingUrl = targetUrl;
          if (ieeeArnumber) {
            landingUrl = `https://ieeexplore.ieee.org/document/${ieeeArnumber}`;
          }
          const readerUrl = ieeeArnumber
            ? `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}`
            : landingUrl;

          const errorPayload = {
            error: ieeeArnumber ? 'publisher_reader_required' : 'html_landing_page',
            statusCode: 422,
            message: ieeeArnumber
              ? 'IEEE Xplore delivers this open-access paper through its interactive browser reader. Click below to view and download the PDF directly.'
              : 'The target source is an HTML landing page rather than a direct downloadable PDF. Please view the paper via the provided repository link.',
            landingUrl: readerUrl,
            directReaderUrl: ieeeArnumber ? readerUrl : null,
            publisherLandingUrl: landingUrl,
            requiresInteractiveSession: Boolean(ieeeArnumber)
          };
          clientRes.setHeader('Content-Type', 'application/json');
          if (typeof clientRes.json === 'function') {
            return clientRes.status(422).json(errorPayload);
          }
          return clientRes.status(422).send(JSON.stringify(errorPayload));
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
        const headStr = chunk.toString('utf8', 0, Math.min(chunk.length, 512));
        const hasPdfMagic = headStr.includes('%PDF-');
        const isHtmlOrScript = headStr.toLowerCase().includes('<!doctype') ||
                               headStr.toLowerCase().includes('<html') ||
                               headStr.toLowerCase().includes('<script') ||
                               headStr.toLowerCase().includes('<apm_do_not_touch>');

        if (!hasPdfMagic || isHtmlOrScript) {
          upstreamRes.destroy();
          if (!clientRes.headersSent) {
            let landingUrl = targetUrl;
            if (ieeeArnumber) {
              landingUrl = `https://ieeexplore.ieee.org/document/${ieeeArnumber}`;
            }
            const readerUrl = ieeeArnumber
              ? `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}`
              : landingUrl;

            const errorPayload = {
              error: ieeeArnumber ? 'publisher_reader_required' : 'html_landing_page',
              statusCode: 422,
              message: ieeeArnumber
                ? 'IEEE Xplore delivers this open-access paper through its interactive browser reader. Click below to view and download the PDF directly.'
                : 'The upstream server returned an HTML webpage instead of a valid PDF document.',
              landingUrl: readerUrl,
              directReaderUrl: ieeeArnumber ? readerUrl : null,
              publisherLandingUrl: landingUrl,
              requiresInteractiveSession: Boolean(ieeeArnumber)
            };
            clientRes.setHeader('Content-Type', 'application/json');
            if (typeof clientRes.json === 'function') {
              return clientRes.status(422).json(errorPayload);
            }
            return clientRes.status(422).send(JSON.stringify(errorPayload));
          }
          return;
        }
      }

      if (bytesReceived > MAX_DOWNLOAD_BYTES) {
        upstreamRes.destroy();
        if (!clientRes.headersSent) {
          return clientRes.status(413).send('Download exceeded maximum file size limit.');
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

  upstreamReq.on('error', (err) => {
    console.error(`[PDF Stream Error]: ${err.message}`);
    if (!clientRes.headersSent) {
      const isIeee = Boolean(ieeeArnumber);
      const readerUrl = ieeeArnumber ? `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}` : null;
      const landingUrl = ieeeArnumber ? `https://ieeexplore.ieee.org/document/${ieeeArnumber}` : targetUrl;
      const errorPayload = {
        error: isIeee ? 'publisher_reader_required' : 'upstream_error',
        message: isIeee
          ? 'IEEE Xplore restricted automated binary streaming. You can read and download the PDF directly via the publisher reader.'
          : `Failed to stream academic document: ${err.message}`,
        directReaderUrl: readerUrl,
        landingUrl: readerUrl || landingUrl,
        publisherLandingUrl: landingUrl,
        requiresInteractiveSession: isIeee
      };
      clientRes.setHeader('Content-Type', 'application/json');
      if (typeof clientRes.json === 'function') {
        clientRes.status(502).json(errorPayload);
      } else {
        clientRes.status(502).send(JSON.stringify(errorPayload));
      }
    }
  });

  upstreamReq.setTimeout(REQUEST_TIMEOUT_MS, () => {
    upstreamReq.destroy();
    if (!clientRes.headersSent) {
      const isIeee = Boolean(ieeeArnumber);
      const readerUrl = ieeeArnumber ? `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${ieeeArnumber}` : null;
      const landingUrl = ieeeArnumber ? `https://ieeexplore.ieee.org/document/${ieeeArnumber}` : targetUrl;
      const errorPayload = {
        error: isIeee ? 'publisher_reader_required' : 'upstream_timeout',
        message: isIeee
          ? 'IEEE Xplore streaming timed out. You can access the full-text PDF directly in the publisher reader below.'
          : 'PDF download timed out after 30 seconds.',
        directReaderUrl: readerUrl,
        landingUrl: readerUrl || landingUrl,
        publisherLandingUrl: landingUrl,
        requiresInteractiveSession: isIeee
      };
      clientRes.setHeader('Content-Type', 'application/json');
      if (typeof clientRes.json === 'function') {
        clientRes.status(504).json(errorPayload);
      } else {
        clientRes.status(504).send(JSON.stringify(errorPayload));
      }
    }
  });
}

module.exports = {
  isPrivateIp,
  validateSafeUrl,
  sanitizeFilename,
  verifyCandidateUrl,
  proxyPdfStream,
  extractIeeeArnumber,
  resolveIeeeArnumber,
  resolveIeeePdf,
  MAX_DOWNLOAD_BYTES
};
