---
name: sports-betting-agent
description: Use when maintaining the Sports Betting - AI Agent demo under C:\Agents\Build\Betting\Sports, including SportyBet scraping, filters, updates, layout, and verification.
---

# Sports Betting - AI Agent

## Purpose
Maintain a compact demo-only dashboard for public SportyBet football odds. The app separates today and live events, derives model probabilities, highlights picks, and shows a local betslip. The page title is `Sports Betting - AI Agent`; the brand mark is text-only `SPORTS BETTING` with no logo.

## Boundaries
- Demo only. Never place wagers or automate betting.
- The only external action is the `Bet on site` link in the betslip, which redirects to `https://sportybet.com`.
- No balances, promotions, authentication, payments, private data scraping, frameworks, build step, or database.
- Bet Advisor speaks as a market analyst, avoids demo disclaimers in visible copy, and gives FAQ-style answers, betslip summaries, and plans from the current snapshot; it places no wagers.
- Donate dialog states the software is part of the free software community, names Heri Kaniugu, offers `5 USDT`, `10 USDT`, `1000 TSHS`, and `5000 TSHS` presets plus a custom amount field
, and shows M-Pesa
 `0764181161`, Mixx by Yas `0670929342`, and Binance Pay ID `61934534` with copy actions; it does not process payments.
- Keep the preview server on port `8765`.

## Files
- `server.js`: static server and update endpoints; reuses `scrape.js`.
- `api/data.js`: Vercel GET endpoint that returns a fresh snapshot and uses a 15-second CDN cache.
- `api/_scrape.js`: Vercel-safe shared scraper used by `/api/data`; no filesystem writes or root-module imports.
- `scrape.js`: shared scraper and atomic `data.js` writer; run directly with `node scrape.js`.
- `.github/workflows/update-data.yml`: scheduled GitHub Actions scrape and commit of `data.js`.
- `vercel.json`: Vercel static hosting config with source-path 404 routes, security headers, and `data.js` set to `no-cache`; Vercel does not build from source.
- `.nojekyll`: prevents GitHub Pages from ignoring static files.
- `.gitignore`: excludes browser artifacts, logs, local Vercel state, and temp snapshots.
- `.vercelignore`: keeps source, server, root scraper, docs, minifier tooling, and manifest files out of the static deployment; `vercel.json` blocks direct source paths.
- `assets/app.min.js`: minified classic-script bundle generated from `src/*.js`; no source map.
- `assets/styles.min.css`: minified stylesheet generated from `styles.css`; no source map.
- `build.js`: regenerates both deploy assets from local npm devDependencies with `node build.js`.
- `package.json`: pins local minifier devDependencies and exposes `npm run build:local`; it is excluded from Vercel.
- `robots.txt`: disallows indexing; `index.html` also sends `noindex,nofollow,noarchive`.
- `LICENSE`: proprietary ownership and no-copy terms.
- `data.js`: generated `window.SNAPSHOT_UPDATED_AT = '...'; window.MATCHES = [...]` snapshot; window assignments allow repeated script loads.
- `index.html`: app shell, toolbar, sidebar, matches, insights, betslip, stats and donate dialogs.
- `favicon.svg`: minimal flat black circle with a white `S`.
- `styles.css`: design tokens, sticky document-scroller layout, responsive drawers, advisor modal/chat-panel modes.
- `src/core.js`: state, element refs, mode detection, formatting, HTML escaping.
- `src/model.js`: odds conversion, Poisson model, groups, filters.
- `src/render.js`: matches, picks, betslip, stats, and shared render helpers.
- `src/events.js`: filter, tab, match, betslip, and drawer listeners.
- `src/snapshot.js`: status label, dynamic auto update, static polling, bootstrap.
- `src/advisor.js`: Bet Advisor answers, thread, dialog modes, listeners.
- `src/donate.js`: Donate dialog, presets, custom amount, copy actions.
- `src/main.js`: initial render, sticky-height sync, bootstrap call.
- `DESIGN.md`: current-state architecture and UI design.
- `SKILL.md`: this operating guide.

## Data sources

### Upcoming events
`https://www.sportybet.com/api/tz/factsCenter/pcUpcomingEvents?sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100&pageNum=1&todayGames=true&timeline=6.4`

Referer: `https://www.sportybet.com/tz/sport/football/today`

### Live events
`https://www.sportybet.com/api/tz/factsCenter/liveOrPrematchEvents?sportId=sr%3Asport%3A1`

Referer: `https://www.sportybet.com/tz/sport/football/live_list/`

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

## Server endpoints
- `GET /api/bootstrap`: waits for the startup scrape and returns `{ ok, scraped, live, total, updatedAt }` or `{ ok: false, error }`.
- `GET /api/data`: fetches all configured sports in parallel and returns `{ ok, updatedAt, matches, total, scraped, live, bySport }`; Vercel caches this for 15 seconds.
- `POST /api/update-data`: fetches all configured sports in parallel, maps events, rewrites `data.js`, and returns `{ ok, scraped, live, total, updatedAt }`.
- `GET /api/status`: returns `{ ok, updating }` so the client can skip a POST while a scrape is running.
- `GET /api/last-update`: returns `{ ok, updatedAt }` from the `data.js` mtime.

Write `data.js` atomically: write `data.js.tmp`, then rename it over `data.js`. Restart the server after any `server.js` or `scrape.js` edit.

## Hosting modes
- Dynamic mode is active on local `http:` origins. It calls `/api/bootstrap`, `/api/status`, `/api/update-data`, and `/api/last-update`.
- Static mode is automatic on `https:` and `file:` origins. On HTTP/HTTPS it first polls `/api/data` every 15 seconds and merges fresh today and live matches into `MATCHES` without a redeploy; on `file://` it polls `data.js?t=...` with script injection.
- `?api=1` forces dynamic mode on a secure origin. `?static=1` forces static mode on a local HTTP server.
- Scheduled GitHub Actions run every 15 minutes by default; GitHub Pages serves that committed snapshot, while Vercel also has the 15-second `/api/data` path.
- Deployed pages expose `assets/app.min.js`, `assets/styles.min.css`, and `/api/data`; raw `src/`, `styles.css`, `scrape.js`, and tooling are blocked by Vercel 404 routes and the local server. The API function uses `api/_scrape.js` inside the function bundle. Commit regenerated assets before deploying; Vercel does not build them. Indexing is discouraged with `robots.txt`, meta robots, and `X-Robots-Tag`.
- Snapshot scraper fetches all sidebar sports: Football (`sr:sport:1`), Basketball (`sr:sport:2`), Tennis (`sr:sport:5`), eFootball (`sr:sport:137`), Table Tennis (`sr:sport:20`), and Cricket (`sr:sport:21`). Table Tennis and Cricket map to `Other`.

## Mapping rules
- Upcoming events: `payload.data.tournaments[].events[]`.
- Live events: `payload.data[].events[]`.
- League: tournament group `name`.
- ID: numeric `gameId`, falling back to digits from `eventId`.
- Time: `estimateStartTime` shifted by UTC+3 and formatted `HH:MM`.
- Teams: `homeTeamName` and `awayTeamName`.
- Primary odds prefer Winner incl. overtime (`id === '219'`), then Winner (`id === '186'`), then 1X2 (`id === '1'`). Keep `Draw` only when that market has it; otherwise store two-way `Home`/`Away` odds.
- Double chance: market `id === '10'` or `name === 'Double Chance'`; store scraped odds by outcome desc as `dc` for `Home or Draw`, `Draw or Away`, and `Home or Away`.
- Over/Under: market `id === '18'` or `name === 'Over/Under'`, line closest to `2.5`.
- Missing Over/Under odds set `noOu: true` and omit `ou`, `over`, and `under`.
- Live rows add `phase: 'live'`, `live: true`, `minute` from `playedSeconds`, `status` from `matchStatus`, and `score` from `setScore` or the last `gameScore`.

Do not emit unused fields such as `period`.

## App state
- `minOdds: 1.3`
- `minProb: 60`
- `league: 'all'`
- `sport: 'Football'`
- `phase: 'today'`
- `market: '3way'`
- `betMode: 'single'`
- `maxFolds: 12`

Double chance applies only to three-way matches; two-way matches are hidden in that view. In the 3 Way & O/U tab, two-way sports rows add an empty draw cell so the Over/Under odd-cell aligns in the same column as Football.

Picks, high-odds badges, and folds require both `odds >= minOdds` and `prob * 100 >= minProb`. The High probability picks panel has a `Max folds` number input, default `12`, range `1-100`; it caps displayed picks, fold odds, and `Add folds`.

A betslip entry is unique by match ID, market, and selection. Clicking the same line again refreshes its odds/probability instead of adding a duplicate; `Add folds` also skips repeated keys.

Auto update is enabled in both modes after bootstrap. Dynamic mode calls the update API every `15 * 1000` ms; static mode polls `data.js` every `15 * 1000` ms with script injection and rerenders when the timestamp changes. The topbar shows only the current update status; there are no manual or auto-toggle buttons.

## Workflow
1. Read existing files before editing and preserve the vanilla stack.
2. For API changes, inspect browser network payloads without loading large JSON bodies into context.
3. Update `server.js` mapping first, then client rendering.
4. Run `npm run build:local` after any `src/*.js` or `styles.css` edit, then commit the regenerated `assets/` files.
5. Restart the server after server-side edits.
6. Trigger `POST /api/update-data` and confirm `ok: true`.
7. Reload the browser with a fresh query string.
8. Verify filters, odds selection, betslip, stats dialog, Bet Advisor summaries and plans, auto update, and mobile drawers.
9. Run syntax and ID checks.

## Verification
- Confirm port `8765` is listening.
- `curl.exe -sS "http://127.0.0.1:8765/api/bootstrap"` must return `ok: true` after startup.
- `curl.exe -sS -X POST "http://127.0.0.1:8765/api/update-data"`
- `node --check "C:\Agents\Build\Betting\Sports\server.js"`
- `node --check "C:\Agents\Build\Betting\Sports\scrape.js"`
- `Get-ChildItem "C:\Agents\Build\Betting\Sports\src\*.js" | ForEach-Object { node --check $_.FullName }`
- `node --check "C:\Agents\Build\Betting\Sports\data.js"`
- Run an HTML ID versus `getElementById` consistency check.
- Browser console errors at `error` level must be zero.
- Security checks: `curl.exe -sS -I "http://127.0.0.1:8765/"` must show `127.0.0.1`-bound server security headers; `/server.js`, `/scrape.js`, `/SKILL.md`, and `/.github/workflows/update-data.yml` must return `404`; `POST` to a static file must return `405`.
- Confirm no secret-like strings exist in source files and no `.playwright-mcp` artifacts remain.
- Donate dialog must open, show five amount presets, show all three payment IDs, and copy each value.
- Bet Advisor must open, answer quick questions, scroll new answers into view, recalculate after bets change, and show today's stake/return summary. At `<=1000px` it must be a full-screen modal dialog; above `1000px` it must be a non-modal left-side chat panel beside the filters.
- Splash must cover first paint, wait for startup data, then hide with no console errors.
- Static mode check: open `http://127.0.0.1:8765/?static=1`, confirm no `/api/*` requests, status starts with `Static`, splash hides, and zero console errors. Confirm repeated `data.js?t=...` script loads and a changed `SNAPSHOT_UPDATED_AT` rerenders without a reload.
- `node scrape.js` must write `data.js` with a fresh `SNAPSHOT_UPDATED_AT`.
- Check no horizontal overflow at `390`, `900`, `1024`, `1280`, and `1440` widths.

## Visual conventions
Use the existing document-scroller/sticky layout and design tokens in `styles.css`; see `DESIGN.md` for structure. Keep the text-only `SPORTS BETTING` mark, no logo, no emojis, and no betting UI beyond `Bet on site`. Sticky offsets come from `syncStickyHeights()`; drawers appear at `<=1000px`.

## Security
- The local server binds to `127.0.0.1` only and allowlists `index.html`, `styles.css`, `data.js`, `favicon.svg`, and the eight ordered `src/*.js` files.
- Hidden files, docs, scraper/server source, and unknown paths return `404`; unsupported methods return `405`.
- Local server and Vercel set `nosniff`, `no-referrer`, `DENY` framing, and a strict same-origin CSP.
- Scraped fields are HTML-escaped before `innerHTML`; snapshots load through script elements with no `eval` or `new Function`.
- No secrets are stored in the project; the scheduled workflow uses the built-in `GITHUB_TOKEN` with `contents: write`.

## Caveats
- SportyBet API shapes and headers can change without notice.
- Minimal requests can return CloudFront `403`; use the browser-like headers above.
- Live counts and snapshot timestamps change constantly; do not assert exact counts.
- Auto update can rewrite `data.js` during verification.
- GitHub Actions scheduled runs can be delayed; static freshness is approximate, not real-time.
- Allow a `ResizeObserver` tick or reload before asserting sticky offsets after a viewport change.
- Model probabilities are heuristic diagnostics, not guarantees.
