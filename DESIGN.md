# Sports Betting - AI Agent Design

## Scope
Documents the current demo-only Sports Betting dashboard: public SportyBet multi-sport odds, today/live separation, filters, picks, model stats, and a local betslip. The page title is `Sports Betting - AI Agent`; the text-only brand mark is `SPORTS BETTING` with no logo.

The runtime stack is plain HTML, CSS, and classic JavaScript with no framework, database, login, or account state. A local Node server provides static files and the same `/api/data` endpoint used by Vercel. No in-app wagering, balances, promotions, payments, or persistent server-side user state exist. The only external action is the `Bet on site` link in the betslip, which redirects to `https://sportybet.com`.

## Architecture

```text
SportyBet public APIs
         |
         v
   api/_scrape.js
         |
         v
  GET /api/data (Vercel function or local node server)
         |
         v
  browser bootstrap + 15s refresh
         |
         v
  index.html + styles.css + assets/app.min.js
         |
         v
  filters, picks, betslip, Bet Advisor, stats dialog
```

The browser never calls SportyBet directly. It calls only same-origin `/api/data`, which hides upstream URLs and headers from client code. `data.js` is intentionally empty and unused. There is no scheduled workflow, generated snapshot file, dynamic/static mode switch, or fallback data path.

## Components

| File | Responsibility |
| --- | --- |
| `server.js` | Local static server and the only data endpoint, `GET /api/data` |
| `api/data.js` | Vercel function that returns a fresh snapshot with a 15-second CDN cache |
| `api/_scrape.js` | Shared scraper used by `/api/data`; no filesystem writes or root-module imports |
| `data.js` | Intentionally empty placeholder; not loaded by the page |
| `index.html` | App shell, toolbar, sidebar, matches, insights, betslip, stats and donate dialogs |
| `styles.css` | Source design tokens, sticky document-scroller layout, responsive drawers |
| `assets/app.min.js` | Minified classic-script deploy bundle generated from `src/*.js` |
| `assets/styles.min.css` | Minified deploy stylesheet generated from `styles.css` |
| `build.js` | Regenerates minified deploy assets with `npm run build:local` |
| `package.json` | Pins local minifier devDependencies and exposes `npm run build:local`; excluded from Vercel |
| `robots.txt` | Crawler disallow and noindex hint |
| `LICENSE` | Proprietary ownership and no-copy terms |
| `src/core.js` | State, element refs, empty `MATCHES` initializer, formatting, HTML escaping |
| `src/model.js` | Odds conversion, Poisson model, groups, filters |
| `src/render.js` | Matches, picks, betslip, stats, and shared render helpers |
| `src/events.js` | Filter, tab, match, betslip, and drawer event listeners |
| `src/snapshot.js` | API-only bootstrap, status label, 15-second auto refresh |
| `src/advisor.js` | Bet Advisor answers, thread, dialog modes, and listeners |
| `src/donate.js` | Donate dialog, presets, custom amount, copy actions |
| `src/main.js` | Initial render, sticky-height sync, bootstrap call |
| `vercel.json` | Vercel Other preset, skipped build, root output, `/api/data` function, source-path 404 routes, and headers |
| `.vercelignore` | Keeps server, source, docs, minifier tooling, manifest files, and `data.js` out of Vercel |
| `SKILL.md` | Authoritative operating and verification guide |

## Data flow

1. `index.html` loads only `assets/app.min.js`.
2. `src/core.js` initializes `MATCHES` as an empty array.
3. `src/main.js` renders the empty shell and calls `bootstrap()`.
4. `bootstrap()` shows the splash and sets status to `Auto · loading`.
5. The browser calls `GET /api/data` and waits for the response.
6. `/api/data` calls `collectSnapshot([])` from `api/_scrape.js`.
7. `api/_scrape.js` fetches upcoming and live feeds for all configured sports in parallel with browser-like headers and a 6-second timeout.
8. Events are normalized into match objects, enriched for live rows, and deduplicated by `id|sport|phase`.
9. The response replaces `MATCHES`, rebuilds league filters, and rerenders.
10. The splash hides only after the first data response.
11. `setInterval` calls `/api/data` every 15 seconds and rerenders only when `updatedAt` changes.

Vercel caches `/api/data` with `public, s-maxage=15, must-revalidate`, so many visitors share one short-lived fresh response. The local server uses `no-store`.

## Scraped sports

- Football — `sr:sport:1`
- Basketball — `sr:sport:2`
- Tennis — `sr:sport:5`
- eFootball — `sr:sport:137`
- Table Tennis — `sr:sport:20`
- Cricket — `sr:sport:21`

Table Tennis and Cricket map to `Other` in the UI.

## Match model

Typical today row:

```json
{
  "id": 48945,
  "time": "23:00",
  "league": "UEFA Champions League",
  "home": "Home Team",
  "away": "Away Team",
  "odds": [1.55, 4.1, 5.2],
  "dc": {
    "Home or Draw": 1.73,
    "Draw or Away": 1.3,
    "Home or Away": 1.28
  },
  "ou": 2.5,
  "over": 2.08,
  "under": 1.73,
  "sport": "Football",
  "phase": "today"
}
```

`dc` values are scraped from SportyBet market `10` and keyed by outcome desc. The UI orders them as `1X`, `X2`, `12`. If scraped values are missing, the client derives fair fallback odds from normalized 1X2 probabilities.

Live rows add `live: true`, `minute`, `status`, and `score`. `minute` is the raw `playedSeconds` value when present, otherwise `matchStatus`, otherwise `LIVE`. Today rows do not carry a `live: false` field, and unused fields such as `period` are omitted.

Missing Over/Under odds set `noOu: true` and omit `ou`, `over`, and `under`. Two-way sports rows add an empty draw cell in the 3 Way tab so their Over/Under odd-cell aligns with Football.

## Server API

### `GET /api/data`

The only data endpoint. It returns:

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

It accepts only `GET`. Vercel returns a 15-second CDN cache; the local server returns `no-store`. If upstream scraping fails, it returns `{ "ok": false, "error": "..." }` and the browser keeps the last snapshot with an `Auto · update failed` status until the next retry.

## Probability model
- Market probabilities are normalized from `1 / odds` to remove the bookmaker overround.
- Three-way events fit Poisson lambdas against 1X2 and Over/Under probabilities, then produce score probabilities and top scorelines.
- Two-way events use a clamped logistic transform of normalized moneyline probability and a separate transform for Over/Under.
- Home/away strength sliders shift the two-way result and scale fitted three-way lambdas.
- Derived values include fair odds, edge, `EV`, and Kelly diagnostics. These are illustrative, not guarantees.

## UI structure

### Topbar
Contains the `SPORTS BETTING` mark, `SPORTYBET API` pill, update-status label, and solid green `Bet Advisor` button. At `<=1000px` it also shows the betslip toggle; the API pill and status text are hidden there. The topbar wraps at `<=640px`. There is no user chip or logo.

### Splash
Covers the first paint with the text-only `SPORTS BETTING` mark, a slim animated progress bar, and a status line. It waits for the first `/api/data` response, applies that snapshot, then hides after a short minimum display time. If the first request fails, it still hides so the retry loop and error status are visible.

### Sidebar
Holds schedule and sport navigation. On desktop it is sticky. At `<=1000px` it becomes a fixed drawer and includes the `SPORTS BETTING` mark and `SPORTYBET API` pill.

### Toolbar
Contains market tabs (`3way`, `dc`), min odds, min probability, and league filter. It is sticky below the topbar. Sport/phase navigation is in the sidebar; bet mode is in the betslip. Double chance applies only to three-way matches, so two-way rows are hidden in that view.

### Matches column
Uses the main document scroller. Date and league headers stick below the toolbar. Match rows show teams, odds controls, selection state, and, for live rows, status/time and score.

### Insights column
Displays picks and folds with a `Max folds` number input defaulting to `12`. The limit caps displayed picks, total fold odds, and the bets loaded by `Add folds`. It is sticky/full-height on wide screens and stacks below the matches on narrower screens. Detailed model stats open through each pick's `Stats` button.

### Betslip
Contains `Single`, `Multiple`, and `System` mode buttons, the bet list, stake input, totals, the `Bet on site` link, and a local-analysis disclaimer. Entries are unique by match ID, market, and selection; reselecting a line updates its odds/probability instead of duplicating it. It is sticky/full-height on desktop and a fixed drawer opened by the topbar `Betslip` toggle or bottom-right FAB on small screens.

### Donate
A topbar `Donate` button opens a compact modal stating that this software is part of the free software community. It names Heri Kaniugu, offers suggested amounts of `5 USDT`, `10 USDT`, `1000 TSHS`, and `5000 TSHS`, and shows M-Pesa `0764181161`, Mixx by Yas `0670929342`, and Binance Pay ID `61934534`. Selecting an amount highlights it and shows the matching payment route. A custom amount field can add another chip by currency keyword. Each payment option has a copy button with inline confirmation. Donations are optional, and the dialog displays details only and processes no payments.

### Bet Advisor
Opens from the solid green topbar button with a GitHub/Linear-inspired dark UI: compact header, divided metric cards, bordered question rows, and timeline-style answer cards with a green left rail. On screens `<=1000px` it is a full-screen edge-to-edge modal dialog with a backdrop; above `1000px` it docks as a fixed left-side chat panel beside the filters, below the topbar, and uses a non-modal dialog so picks and the betslip stay unobstructed.

It shows a live summary of today's local bets, FAQ-style quick questions, and a free-text ask field. Quick questions cover betslip summaries, plans, strongest and riskiest lines, live watch, value picks, bookmaker margin, and market freshness. Answers are computed from the current `MATCHES` snapshot, current filters, model diagnostics, and the local betslip. Visible advisor copy uses a first-person analyst voice and avoids demo disclaimers; the app still places no wagers. Answers recalculate after auto updates or bet changes, and new answers scroll the thread to the bottom.

## Responsive layout
The page uses a document-level scrollbar, not nested page scrolling. Topbar, toolbar, date row, and league row are sticky and stacked through `--topbar-height` and `--toolbar-height`. `syncStickyHeights()` keeps those variables aligned with measured DOM heights.

Breakpoints:
- `<=1200px`: insights panel becomes static and picks scroll within a capped area.
- `<=1000px`: sidebar and betslip become fixed drawers.
- `<=640px`: topbar and toolbar wrap.

## Visual tokens
- Body `13px`, controls about `32px`, radius `6px`; the Bet Advisor modal uses an `8px` radius and GitHub/Linear-like borders, hover states, and section dividers.
- Colors: `--bg #0d1117`, `--surface #161b22`, `--surface-2 #21262d`, `--border #30363d`, `--text #e6edf3`, `--muted #8b949e`, `--accent #3fb950`, `--accent-solid #238636`, `--danger #f85149`.
- Green scrollbar thumb on dark track.
- Range inputs use a slim rounded track, green fill, and compact green thumb; `--range-fill` is synced in JS.
- Favicon is a minimal flat black circle with a white italic `S`; no emojis or extra betting UI beyond `Bet on site`.

## Auto update
Auto update is the only fetch path. The splash waits for the first `/api/data` response, then a 15-second interval keeps refreshing. The status label always begins with `Auto`. There are no manual controls, no static snapshot mode, no dynamic mode switch, no data-file reload, and no scheduled workflow.

Failed refreshes do not clear the current snapshot; the status shows `Auto · update failed` and the next interval retries. Vercel's CDN cache can serve data up to 15 seconds old.

## Security
- Local server binds only to `127.0.0.1`, allowlists `index.html`, `favicon.svg`, `robots.txt`, and the two minified deploy assets, and rejects unknown/hidden paths and unsupported methods.
- Local server and Vercel responses include `nosniff`, `no-referrer`, frame denial, a same-origin CSP, and `X-Robots-Tag: noindex, nofollow, noarchive`; `robots.txt` and the page meta tag also disallow indexing.
- Deployment uses `framework: null`, an empty build command, and root output so Vercel does not look for a Node entrypoint. It serves committed minified assets without source maps; `/api/data` uses `api/_scrape.js` inside the function bundle; raw `src/*.js`, `styles.css`, `data.js`, and tooling return `404`.
- `LICENSE` and the betslip notice state ownership and prohibit copying or reuse without permission. These are deterrents, not access control.
- Scraped fields are escaped before `innerHTML`; no `eval` or `new Function` is used.
- No secrets are stored in the project, and no scheduled workflow exists.

## Verification
Use the authoritative workflow and commands in `SKILL.md`.

## Risks
- SportyBet API shapes and required headers can change without notice.
- Live counts and snapshot timestamps change constantly.
- Vercel function timeouts can cause intermittent failed refreshes during upstream slowness.
- CDN caching is approximate and can serve data up to 15 seconds old.
- `file://` cannot use the only fetch path.
- Model probabilities are heuristic diagnostics based on public odds.
