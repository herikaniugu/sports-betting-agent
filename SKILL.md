---
name: sports-betting-agent
description: Use when maintaining the Sports Betting - AI Agent demo under C:\Agents\Build\Betting\Sports, including the /api/data live snapshot, filters, updates, layout, and verification.
---

# Sports Betting - AI Agent

## Purpose
Maintain a compact demo-only dashboard for public SportyBet multi-sport odds. The app separates today and live events, derives model probabilities, highlights picks, and shows a local betslip. The page title is `Sports Betting - AI Agent`; the brand mark is text-only `SPORTS BETTING` with no logo.

## Boundaries
- Demo only. Never place wagers or automate betting.
- The only external action is the `Bet on site` link in the betslip, which redirects to `https://sportybet.com`.
- No balances, promotions, authentication, payments, private data scraping, runtime framework, or database.
- Local minification is only for generating deploy assets; Vercel performs no build.
- Bet Advisor speaks as a market analyst, avoids demo disclaimers in visible copy, and gives FAQ-style answers, betslip summaries, and plans from the current snapshot; it places no wagers.
- Donate dialog states the software is part of the free software community, names Heri Kaniugu, offers `5 USDT`, `10 USDT`, `1000 TSHS`, and `5000 TSHS` presets plus a custom amount field, and shows M-Pesa `0764181161`, Mixx by Yas `0670929342`, and Binance Pay ID `61934534` with copy actions; it does not process payments.
- Keep the preview server on port `8765`.

## Files
- `server.js`: local static server plus the only data endpoint, `GET /api/data`.
- `api/data.js`: Vercel function that returns a fresh snapshot with a 15-second CDN cache.
- `api/_scrape.js`: shared scraper used by `/api/data`; no filesystem writes or root-module imports.
- `vercel.json`: forces Vercel's Other preset with `framework: null`, skips the build command, serves the root directory, configures `/api/data`, blocks source paths, and adds security headers.
- `.vercelignore`: keeps server, source, docs, minifier tooling, manifest files, and `data.js` out of the Vercel deployment.
- `assets/app.min.js`: minified classic-script bundle generated from `src/*.js`; no source map.
- `assets/styles.min.css`: minified stylesheet generated from `styles.css`; no source map.
- `build.js`: regenerates both deploy assets from local npm devDependencies with `npm run build:local`.
- `package.json`: pins local minifier devDependencies and exposes `npm run build:local`; it is excluded from Vercel.
- `robots.txt`: disallows indexing; `index.html` also sends `noindex,nofollow,noarchive`.
- `LICENSE`: proprietary ownership and no-copy terms.
- `data.js`: intentionally empty placeholder; it is not loaded by the page and not used for data.
- `index.html`: app shell, toolbar, sidebar, matches, insights, betslip, stats and donate dialogs.
- `favicon.svg`: minimal flat black circle with a white `S`.
- `styles.css`: design tokens, sticky document-scroller layout, responsive drawers, advisor modal/chat-panel modes.
- `src/core.js`: state, element refs, empty `MATCHES` initializer, formatting, HTML escaping.
- `src/model.js`: odds conversion, Poisson model, groups, filters, parlay combinations.
- `src/render.js`: matches, picks, parlays, betslip, stats, and shared render helpers.
- `src/events.js`: filter, tab, match, betslip, and drawer listeners.
- `src/snapshot.js`: API-only bootstrap, status label, 15-second auto refresh.
- `src/advisor.js`: Bet Advisor answers, thread, dialog modes, listeners.
- `src/donate.js`: Donate dialog, presets, custom amount, copy actions.
- `src/main.js`: initial render, sticky-height sync, bootstrap call.
- `DESIGN.md`: current-state architecture and UI design.
- `SKILL.md`: this operating guide.

## Data sources
The scraper fetches all sidebar sports: Football (`sr:sport:1`), Basketball (`sr:sport:2`), Tennis (`sr:sport:5`), eFootball (`sr:sport:137`), Table Tennis (`sr:sport:20`), and Cricket (`sr:sport:21`). Table Tennis and Cricket map to `Other`.

### Upcoming events
Pattern:

```text
https://www.sportybet.com/api/tz/factsCenter/pcUpcomingEvents?sportId=<id>&marketId=<ids>&pageSize=100&pageNum=1&todayGames=true&timeline=<value>
```

Football example:

```text
https://www.sportybet.com/api/tz/factsCenter/pcUpcomingEvents?sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100&pageNum=1&todayGames=true&timeline=6.4
```

Referer pattern: `https://www.sportybet.com/tz/sport/<slug>/today`

### Live events
Pattern:

```text
https://www.sportybet.com/api/tz/factsCenter/liveOrPrematchEvents?sportId=<id>
```

Football example:

```text
https://www.sportybet.com/api/tz/factsCenter/liveOrPrematchEvents?sportId=sr%3Asport%3A1
```

Referer pattern: `https://www.sportybet.com/tz/sport/<slug>/live_list/`

### Required request headers
- `accept: */*`
- `accept-language: en`
- `clientid: web`
- `content-type: application/x-www-form-urlencoded; charset=UTF-8`
- `operid: 2`
- `platform: web`
- `referer`: matching referer above
- `sec-ch-ua: "Chromium";v="159", "Not/A)Brand";v="8"`
- `sec-ch-ua-mobile: ?0`
- `sec-ch-ua-platform: "Windows"`
- `user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/159.0.0.0 Safari/537.36`

Each request has a 6-second timeout. Sports are fetched together with `Promise.allSettled`; one failing sport does not fail the whole snapshot.

## Only data endpoint
`GET /api/data` fetches all configured sports in parallel and returns:

```json
{
  "ok": true,
  "updatedAt": "<ISO timestamp>",
  "matches": [],
  "total": 0,
  "scraped": 0,
  "live": 0,
  "bySport": []
}
```

Vercel sends `Cache-Control: public, s-maxage=15, must-revalidate`. The local server sends `no-store`.

No other data endpoints exist. There is no bootstrap endpoint, status endpoint, update endpoint, data-file reload, scheduled workflow, or generated snapshot write.

## Fetch lifecycle
- `index.html` loads only `assets/app.min.js`; it does not load `data.js`.
- `src/core.js` initializes `MATCHES` as an empty array.
- `src/main.js` renders the empty shell, then calls `bootstrap()`.
- `src/snapshot.js` keeps the splash visible and sets status to `Auto · loading`.
- `bootstrap()` awaits the first `GET /api/data` before hiding the splash.
- The first response replaces `MATCHES`, rebuilds league filters, and rerenders.
- `setInterval` calls `/api/data` every `15 * 1000` ms after bootstrap.
- The status label always starts with `Auto`.
- If a refresh fails, status becomes `Auto · update failed`; the next 15-second retry continues.
- `file://` is not supported because the only fetch path is same-origin `/api/data`.

## Mapping rules
- Upcoming events: `payload.data.tournaments[].events[]`, phase `today`.
- Live events: `payload.data[].events[]`, phase `live`.
- League: tournament or live group `name`.
- ID: numeric `gameId`, falling back to digits from `eventId`.
- Time: `estimateStartTime` shifted by UTC+3 and formatted `HH:MM`.
- Teams: `homeTeamName` and `awayTeamName`.
- Primary odds prefer Winner incl. overtime (`id === '219'`), then Winner (`id === '186'`), then 1X2 (`id === '1'`). Keep `Draw` only when that market has it; otherwise store two-way `Home`/`Away` odds.
- Double chance: market `id === '10'` or `name === 'Double Chance'`; store scraped odds by outcome desc as `dc` for `Home or Draw`, `Draw or Away`, and `Home or Away`.
- Over/Under: market `id === '18'` or `name === 'Over/Under'`, line closest to `2.5`.
- Missing Over/Under odds set `noOu: true` and omit `ou`, `over`, and `under`.
- Live rows add `live: true`, `minute` from `playedSeconds`, `status` from `matchStatus`, and `score` from `setScore` or the last `gameScore`.
- Duplicate key is `id|sport|phase`.
- Do not emit unused fields such as `period`.

## App state
- `minOdds: 1.3`
- `minProb: 60`
- `league: 'all'`
- `sport: 'Football'`
- `phase: 'today'`
- `market: '3way'`
- `betMode: 'single'`
- `maxFolds: 12`
- `insightTab: 'picks'`
- `parlayLegs: 3`

The Over / Under tab hides matches without O/U lines. In the 3 Way / 2 Way tab, two-way sports rows add an empty draw cell so Home and Away align under the 1 and 2 columns.

The insights column switches between `High Probability Picks` and `Betslip Generator` tabs. Picks and folds require both `odds >= minOdds` and `prob * 100 >= minProb`. The High Probability Picks tab has a `Max folds` number input, default `12`, range `1-100`; it caps displayed picks, fold odds, and `Add folds`. Its Betslip Generator has a `Legs` number input defaulting to `3` (range `2-10`), builds combinations from up to 12 qualifying picks, ranks them by combined model edge, shows the top 5 with an `X% hit probability` label from normalized market probabilities, and loads a chosen combination into the multiple betslip. Each pick has an `Add` button after `Stats`; it hides once that line is in the betslip and reappears when the line is removed there.

A betslip entry is unique by match ID, market, and selection. Clicking the same line again refreshes its odds/probability instead of adding a duplicate; `Add folds` also skips repeated keys. Betslip totals start with a `Hit Probability` label from stored market probabilities: average in Single mode, all-leg product in Multiple mode, and at-least-all-but-one probability in System mode.

## Workflow
1. Read existing files before editing and preserve the vanilla stack.
2. For endpoint changes, inspect browser network payloads without loading large JSON bodies into context.
3. Change `api/_scrape.js` for upstream fetching or mapping; change `src/snapshot.js` for refresh behavior.
4. Run `npm run build:local` after any `src/*.js` or `styles.css` edit, then commit the regenerated `assets/` files.
5. Restart the local server after server-side edits.
6. Verify `GET /api/data` returns `ok: true`.
7. Reload the browser with a fresh query string.
8. Verify filters, odds selection, betslip, stats dialog, Bet Advisor summaries and plans, auto update, and mobile drawers.
9. Run syntax and ID checks.

## Verification
- Confirm port `8765` is listening.
- `curl.exe -sS "http://127.0.0.1:8765/api/data"` must return `ok: true`.
- `node --check "C:\Agents\Build\Betting\Sports\server.js"`
- `node --check "C:\Agents\Build\Betting\Sports\api\data.js"`
- `node --check "C:\Agents\Build\Betting\Sports\api\_scrape.js"`
- `Get-ChildItem "C:\Agents\Build\Betting\Sports\src\*.js" | ForEach-Object { node --check $_.FullName }`
- Run an HTML ID versus `getElementById` consistency check.
- Browser console errors at `error` level must be zero.
- First load must show the splash, then `Auto · last updated ...` after the first `/api/data` response.
- Network must show repeated `/api/data` requests every 15 seconds and no `data.js`, `/api/bootstrap`, `/api/status`, `/api/update-data`, or `/api/last-update` requests.
- Security checks: `GET /server.js`, `/api/_scrape.js`, `/src/core.js`, `/SKILL.md`, `/DESIGN.md`, `/data.js`, and `/.github/...` must return `404`; `POST` to a static file must return `405`.
- Confirm no secret-like strings exist in source files and no `.playwright-mcp` artifacts remain.
- Donate dialog must open, show four amount presets, show all three payment IDs, and copy each value.
- Bet Advisor must open, answer quick questions, scroll new answers into view, recalculate after bets change, and show today's stake/return summary. At `<=1000px` it must be a full-screen modal dialog; above `1000px` it must be a non-modal left-side chat panel beside the filters.
- Check no horizontal overflow at `390`, `900`, `1024`, `1280`, and `1440` widths.

## Visual conventions
Use the existing document-scroller/sticky layout and design tokens in `styles.css`; see `DESIGN.md` for structure. Keep the text-only `SPORTS BETTING` mark, no logo, no emojis, and no betting UI beyond `Bet on site`. Sticky offsets come from `syncStickyHeights()`; drawers appear at `<=1000px`.

## Security
- The local server binds to `127.0.0.1` only and allowlists `index.html`, `favicon.svg`, `robots.txt`, and the two minified deploy assets.
- Hidden files, docs, scraper/server source, `data.js`, and unknown paths return `404`; unsupported methods return `405`.
- Local server and Vercel set `nosniff`, `no-referrer`, `DENY` framing, and a strict same-origin CSP.
- Scraped fields are HTML-escaped before `innerHTML`; no `eval` or `new Function` is used.
- No secrets are stored in the project, and no scheduled workflow exists.

## Caveats
- SportyBet API shapes and headers can change without notice.
- Minimal requests can return CloudFront `403`; use the browser-like headers above.
- Live counts and snapshot timestamps change constantly; do not assert exact counts.
- CDN caching is approximate; `s-maxage=15` means the cached response can be up to 15 seconds old.
- Vercel function timeouts can fail during upstream slowness; the UI keeps retrying every 15 seconds.
- `file://` cannot fetch `/api/data`; use the local server or Vercel.
- Allow a `ResizeObserver` tick or reload before asserting sticky offsets after a viewport change.
- Model probabilities are heuristic diagnostics, not guarantees.
