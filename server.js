const http = require('http');
const fs = require('fs');
const path = require('path');
const { updateData, collectSnapshot, dataPath } = require('./scrape');

const root = __dirname;
const port = 8765;
const staticFiles = new Set([
  '/index.html',
  '/assets/styles.min.css',
  '/assets/app.min.js',
  '/data.js',
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

let updating = false;
let startup = { done: false, ok: false, error: null, result: null };

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, securityHeaders));
  res.end(body);
}

function notFound(res) {
  res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, securityHeaders));
  res.end('Not found');
}

updating = true;
const startupPromise = updateData()
  .then(result => {
    startup = { done: true, ok: true, error: null, result };
  })
  .catch(error => {
    startup = { done: true, ok: false, error: error.message, result: null };
  })
  .finally(() => {
    updating = false;
  });

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, 'http://127.0.0.1');
  const pathname = parsed.pathname === '/' ? '/index.html' : parsed.pathname;

  if (req.method !== (pathname === '/api/update-data' ? 'POST' : 'GET')) {
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

  if (pathname === '/api/bootstrap') {
    startupPromise.then(() => {
      if (startup.ok) json(res, 200, Object.assign({ ok: true }, startup.result));
      else json(res, 200, { ok: false, error: startup.error });
    });
    return;
  }

  if (pathname === '/api/status') {
    json(res, 200, { ok: true, updating });
    return;
  }

  if (pathname === '/api/last-update') {
    try {
      const updatedAt = fs.statSync(dataPath).mtimeMs;
      json(res, 200, { ok: true, updatedAt: new Date(updatedAt).toISOString() });
    } catch (error) {
      json(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (pathname === '/api/update-data') {
    if (updating) {
      json(res, 409, { ok: false, error: 'Update already running' });
      return;
    }
    updating = true;
    try {
      const result = await updateData();
      json(res, 200, Object.assign({ ok: true }, result));
    } catch (error) {
      json(res, 500, { ok: false, error: error.message });
    } finally {
      updating = false;
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
