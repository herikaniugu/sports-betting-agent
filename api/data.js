const { collectSnapshot } = require('./_scrape');

function send(res, status, value, cacheControl) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', cacheControl || 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.end(JSON.stringify(value));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    send(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }
  try {
    const snapshot = await collectSnapshot([]);
    send(res, 200, {
      ok: true,
      updatedAt: snapshot.updatedAt,
      matches: snapshot.matches,
      total: snapshot.matches.length,
      scraped: snapshot.scraped,
      live: snapshot.live,
      bySport: snapshot.bySport
    }, 'public, s-maxage=15, must-revalidate');
  } catch (error) {
    send(res, 500, { ok: false, error: error.message });
  }
};
