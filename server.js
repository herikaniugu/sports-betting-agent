const http = require('http');
const fs = require('fs');
const path = require('path');
const { collectSnapshot } = require('./api/_scrape');

const root = __dirname;
const port = 8765;
const staticFiles = new Set([
  '/index.html',
  '/assets/styles.min.css',
  '/assets/app.min.js',
  '/favicon.svg',
  '/robots.txt'
]);
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};

function json(res, status, value) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, securityHeaders));
  res.end(JSON.stringify(value));
}

function notFound(res) {
  res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, securityHeaders));
  res.end('Not found');
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, 'http://127.0.0.1');
  const pathname = parsed.pathname === '/' ? '/index.html' : parsed.pathname;

  if (req.method !== 'GET') {
    json(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/data') {
    try {
      const snapshot = await collectSnapshot([]);
      json(res, 200, {
        ok: true,
        updatedAt: snapshot.updatedAt,
        matches: snapshot.matches,
        total: snapshot.matches.length,
        scraped: snapshot.scraped,
        live: snapshot.live,
        bySport: snapshot.bySport
      });
    } catch (error) {
      json(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (!staticFiles.has(pathname)) {
    notFound(res);
    return;
  }

  const file = path.join(root, pathname.slice(1));
  fs.readFile(file, (error, data) => {
    if (error) {
      notFound(res);
      return;
    }
    res.writeHead(200, Object.assign({
      'Content-Type': path.extname(file) === '.svg' ? 'image/svg+xml' : path.extname(file) === '.css' ? 'text/css' : path.extname(file) === '.js' ? 'text/javascript' : path.extname(file) === '.txt' ? 'text/plain' : 'text/html',
      'Cache-Control': 'no-store'
    }, securityHeaders));
    res.end(data);
  });
});

server.listen(port, '127.0.0.1', () => console.log('Ready on http://127.0.0.1:' + port));
