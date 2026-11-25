const https = require('https');

const sportSources = [
  { name: 'Football', sportId: 'sr:sport:1', slug: 'football', marketIds: '1,18,10,29,11,26,36,14,60100', timeline: '6.4' },
  { name: 'Basketball', sportId: 'sr:sport:2', slug: 'basketball', marketIds: '219,18,223,1,14,11', timeline: '13.4' },
  { name: 'Tennis', sportId: 'sr:sport:5', slug: 'tennis', marketIds: '186,189,202,188,187,1,18', timeline: '13.4' },
  { name: 'eFootball', sportId: 'sr:sport:137', slug: 'eFootball', marketIds: '1,18', timeline: '13.4' },
  { name: 'Other', sportId: 'sr:sport:20', slug: 'tableTennis', marketIds: '186,1,18', timeline: '13.4' },
  { name: 'Other', sportId: 'sr:sport:21', slug: 'cricket', marketIds: '186,1,18', timeline: '13.4' }
];
const headers = {
  'sec-ch-ua-platform': '"Windows"',
  referer: 'https://www.sportybet.com/tz/sport/football/today',
  'accept-language': 'en',
  'sec-ch-ua': '"Chromium";v="159", "Not/A)Brand";v="8"',
  clientid: 'web',
  operid: '2',
  'sec-ch-ua-mobile': '?0',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/159.0.0.0 Safari/537.36',
  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  platform: 'web',
  accept: '*/*'
};

function fetchJson(url, referer) {
  return new Promise((resolve, reject) => {
    const requestHeaders = Object.assign({}, headers, {
      referer: referer || headers.referer
    });
    const request = https.get(url, { headers: requestHeaders }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(6000, () => request.destroy(new Error('Request timeout')));
    request.on('error', reject);
  });
}

function upcomingUrl(source) {
  const encodedIds = source.marketIds.split(',').map(id => encodeURIComponent(id)).join('%2C');
  return 'https://www.sportybet.com/api/tz/factsCenter/pcUpcomingEvents?sportId=' + encodeURIComponent(source.sportId) +
    '&marketId=' + encodedIds + '&pageSize=100&pageNum=1&todayGames=true&timeline=' + encodeURIComponent(source.timeline);
}

function liveUrl(source) {
  return 'https://www.sportybet.com/api/tz/factsCenter/liveOrPrematchEvents?sportId=' + encodeURIComponent(source.sportId);
}

function oddsOf(market, test) {
  const outcome = (market && market.outcomes || []).find(test);
  const value = outcome ? Number(outcome.odds) : 0;
  return Number.isFinite(value) ? value : 0;
}

function oddsByDesc(market) {
  const result = {};
  for (const outcome of (market && market.outcomes) || []) {
    const value = Number(outcome.odds);
    if (outcome.desc && Number.isFinite(value) && value > 0) result[outcome.desc] = Number(value.toFixed(2));
  }
  return result;
}

function totalOf(specifier) {
  const match = String(specifier || '').match(/total=([\d.]+)/);
  return match ? Number(match[1]) : null;
}

function formatTime(ms) {
  const date = new Date(Number(ms) + 3 * 60 * 60 * 1000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(11, 16);
}

function primaryMarket(event) {
  const markets = event.markets || [];
  return markets.find(market => market.id === '219' || /Winner \(incl\. overtime\)/i.test(market.name || ''))
    || markets.find(market => market.id === '186' || /^Winner$/i.test(market.name || ''))
    || markets.find(market => market.name === '1X2' || market.id === '1');
}

function eventOdds(event) {
  const markets = event.markets || [];
  const main = primaryMarket(event);
  const doubleChance = markets.find(market => market.name === 'Double Chance' || market.id === '10');
  const home = oddsOf(main, outcome => /^Home\b/i.test(outcome.desc || ''));
  const draw = oddsOf(main, outcome => /^Draw\b/i.test(outcome.desc || ''));
  const away = oddsOf(main, outcome => /^Away\b/i.test(outcome.desc || ''));
  const odds = draw > 0 ? [home, draw, away] : [home, away];
  const dc = oddsByDesc(doubleChance);
  const ouMarkets = markets
    .filter(market => market.name === 'Over/Under' || market.id === '18')
    .map(market => ({ market, total: totalOf(market.specifier) }))
    .filter(item => item.total !== null)
    .sort((a, b) => Math.abs(a.total - 2.5) - Math.abs(b.total - 2.5));
  const ouItem = ouMarkets[0];
  return {
    odds,
    dc,
    ou: ouItem ? ouItem.total : 0,
    over: ouItem ? oddsOf(ouItem.market, outcome => /^Over\b/i.test(outcome.desc)) : 0,
    under: ouItem ? oddsOf(ouItem.market, outcome => /^Under\b/i.test(outcome.desc)) : 0
  };
}

function mapEvent(event, league, phase, sport) {
  const data = eventOdds(event);
  const id = Number(event.gameId) || Number(String(event.eventId || '').replace(/\D/g, ''));
  if (!id || data.odds.some(value => !value)) return null;

  const match = {
    id,
    time: formatTime(event.estimateStartTime),
    league,
    home: event.homeTeamName,
    away: event.awayTeamName,
    odds: data.odds.map(value => Number(value.toFixed(2))),
    ou: data.ou,
    over: Number(data.over.toFixed(2)),
    under: Number(data.under.toFixed(2)),
    sport,
    phase
  };
  if (Object.keys(data.dc).length) match.dc = data.dc;
  if (!data.over || !data.under) {
    match.noOu = true;
    delete match.ou;
    delete match.over;
    delete match.under;
  }
  if (phase === 'live') {
    const scores = event.gameScore || [];
    match.live = true;
    match.minute = event.playedSeconds || '';
    match.status = event.matchStatus || '';
    match.score = event.setScore || scores[scores.length - 1] || '';
  }
  return match;
}

async function scrapeSport(source) {
  const sportPage = 'https://www.sportybet.com/tz/sport/' + source.slug + '/';
  const [upcomingPayload, livePayload] = await Promise.all([
    fetchJson(upcomingUrl(source), sportPage + 'today'),
    fetchJson(liveUrl(source), sportPage + 'live_list/').catch(() => ({ data: [] }))
  ]);
  const scraped = [];
  ((upcomingPayload.data && upcomingPayload.data.tournaments) || []).forEach(tournament => {
    (tournament.events || []).forEach(event => {
      const match = mapEvent(event, tournament.name, 'today', source.name);
      if (match) scraped.push(match);
    });
  });
  const live = [];
  (Array.isArray(livePayload.data) ? livePayload.data : []).forEach(group => {
    (group.events || []).forEach(event => {
      const match = mapEvent(event, group.name, 'live', source.name);
      if (match) live.push(match);
    });
  });
  return { name: source.name, scraped, live };
}

function uniqueMatches(matches) {
  const seen = new Set();
  return matches.filter(match => {
    const key = match.id + '|' + match.sport + '|' + (match.phase || 'today');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function collectSnapshot(existing) {
  const settled = await Promise.allSettled(sportSources.map(scrapeSport));
  const sources = settled.filter(result => result.status === 'fulfilled').map(result => result.value);
  if (!sources.length) throw new Error('No sport data available');
  const scraped = sources.flatMap(source => source.scraped);
  const liveMatches = sources.flatMap(source => source.live);
  if (!scraped.length && !liveMatches.length) throw new Error('No events found in live data');

  const refreshedSports = new Set(sources.map(source => source.name));
  const preserved = (Array.isArray(existing) ? existing : []).filter(match => {
    const sport = match.sport || 'Football';
    const phase = match.phase || 'today';
    return (phase !== 'today' && phase !== 'live') || !refreshedSports.has(sport);
  });
  const matches = uniqueMatches(scraped.concat(liveMatches, preserved));
  const bySport = new Map();
  sources.forEach(source => {
    const row = bySport.get(source.name) || { sport: source.name, today: 0, live: 0 };
    row.today += source.scraped.length;
    row.live += source.live.length;
    bySport.set(source.name, row);
  });
  return {
    matches,
    updatedAt: new Date().toISOString(),
    scraped: scraped.length,
    live: liveMatches.length,
    bySport: [...bySport.values()]
  };
}

module.exports = { collectSnapshot, sportSources, fetchJson, mapEvent, scrapeSport, uniqueMatches };
