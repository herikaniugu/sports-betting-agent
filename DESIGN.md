# Sports Betting - AI Agent Design

## Scope
Documents the current demo-only Sports Betting dashboard: public SportyBet football odds, today/live separation, filters, picks, and model stats. The page title is `Sports Betting - AI Agent`; the text-only brand mark is `SPORTS BETTING` with no logo.

The stack is plain HTML, CSS, JavaScript, and a Node server with no framework, build step, database, login, or account state. No in-app wagering, balances, promotions, payments, or persistent server-side user state. The only external action is the `Bet on site` link in the betslip, which redirects to `https://sportybet.com`.

## Architecture

```text
SportyBet public APIs
        |
        v
   scrape.js -> data.js snapshot
        |              |
        v              v
 server.js APIs   GitHub Actions cron
        |              |
        v              v
Node on :8765   GitHub Pages / Vercel static
        \              /
         v            v
     index.html + styles.css + src/*.js
                |
                v
 filters, picks, betslip, Bet Advisor, stats dialog
```

The browser does not call SportyBet directly. `scrape.js` uses browser-like headers and writes a local snapshot; the local server refreshes it every 15 seconds, Vercel exposes `GET /api/data`, and the scheduled workflow commits it for static hosting.

## Components

| File | Responsibility |
| --- | --- |
| `server.js` | Static server and update endpoints; reuses `scrape.js` |
| `api/data.js` | Vercel GET endpoint that returns a fresh snapshot with a 15-second CDN cache |
| `api/_scrape.js` | Vercel-safe shared scraper used by `/api/data`; no filesystem writes or root-module imports |
| `scrape.js` | Shared multi-sport scraper and atomic `data.js` writer; also runs as a CLI |
| `.github/workflows/update-data.yml` | Scheduled scrape and committed snapshot refresh for static hosting |
| `data.js` | Generated `window.SNAPSHOT_UPDATED_AT = '...'; window.MATCHES = [...]` snapshot |
| `index.html` | App shell, toolbar, sidebar, matches, insights, betslip, stats dialog |
| `styles.css` | Source design tokens, sticky document-scroller layout, responsive drawers |
| `assets/app.min.js` | Minified classic-script deploy bundle generated from `src/*.js` |
| `assets/styles.min.css` | Minified deploy stylesheet generated from `styles.css` |
| `build.js` | Regenerates minified deploy assets with `node build.js` |
| `package.json` | Pins local minifier devDependencies and exposes `npm run build:local`; excluded from Vercel |
| `robots.txt` | Crawler disallow and noindex hint |
| `LICENSE` | Proprietary ownership and no-copy terms |
| `src/core.js` | State, element refs, mode detection, formatting, HTML escaping |
| `src/model.js` | Odds conversion, Poisson model, groups, filters |
| `src/render.js` | Matches, picks, betslip, stats, and shared render helpers |
| `src/events.js` | Filter, tab, match, betslip, and drawer event listeners |
| `src/snapshot.js` | Status label, dynamic auto update, static polling, bootstrap |
| `src/advisor.js` | Bet Advisor answers, thread, dialog modes, and listeners |
| `src/donate.js` | Donate dialog, presets, custom amount, copy actions |
| `src/main.js` | Initial render, sticky-height sync, bootstrap call |
| `vercel.json` | Vercel Other preset (`framework: null`), skipped build, root output, `/api/data` function config, source-path 404 routes, and headers |
| `.nojekyll` | Keeps all static files intact on GitHub Pages |
| `.gitignore` | Excludes local browser artifacts, logs, Vercel state, and temp snapshots |
| `.vercelignore` | Prevents server, root scraper, docs, and local tooling from being published by Vercel |
| `SKILL.md` | Authoritative operating and verification guide |

## Data flow

Exact URLs, headers, and referers are in `SKILL.md` and `scrape.js`.

1. `scrape.js` fetches upcoming and live feeds for all configured sports in parallel.
2. Events are normalized into match objects and optionally enriched with live fields.
3. Snapshot plus `SNAPSHOT_UPDATED_AT` is written to `data.js.tmp`, then renamed to `data.js`.
4. Dynamic mode: `server.js` starts the first scrape at boot, the splash waits on `/api/bootstrap`, then the client reloads cache-busted `data.js`.
5. Dynamic mode: every 15 seconds the client checks `/api/status`, calls `POST /api/update-data` when idle, and rerenders without a page reload.
6. Static file mode: GitHub Actions runs `node scrape.js` on a schedule and commits `data.js`; GitHub Pages serves the committed files.
7. Static Vercel mode: the browser fetches `GET /api/data` every 15 seconds; the function reuses `scrape.js` and returns fresh today and live matches, while the client preserves other phases and rerenders in place.
8. Static `file://` mode: the browser polls `data.js?t=...` with script injection every 15 seconds and rerenders when `SNAPSHOT_UPDATED_AT` changes.

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

## Server API (dynamic mode)

### `GET /api/bootstrap`
Waits for the first scrape started with the server process. Returns the same shape as `/api/update-data`, or `{ "ok": false, "error": "..." }` if the startup scrape fails. The client uses this to hold the splash until data is ready, falling back to the cached snapshot when needed.

### `POST /api/update-data`
Fetches and maps both feeds, rewrites the snapshot, and returns:

```json
{
  "ok": true,
  "scraped": "<number>",
  "live": "<number>",
  "total": "<number>",
  "updatedAt": "<ISO timestamp>"
}
```

### `GET /api/last-update`
Returns:

```json
{
  "ok": true,
  "updatedAt": "<ISO timestamp>"
}
```

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
Covers the first paint with the text-only `SPORTS BETTING` mark, a slim animated progress bar, and a status line. In dynamic mode it waits for `/api/bootstrap`, applies the fresh snapshot, and hides after a short minimum display time; if startup scraping fails, it falls back to the cached `data.js` snapshot with a cached-snapshot status. In static mode it uses the committed snapshot immediately and hides with a static-snapshot status.

### Sidebar
Holds schedule and sport navigation. On desktop it is sticky. At `<=1000px` it becomes a fixed drawer and includes the `SPORTS BETTING` mark and `SPORTYBET API` pill.

### Toolbar
Contains market tabs (`3way`, `dc`), min odds, min probability, and league filter. It is sticky below the topbar. Sport/phase navigation is in the sidebar; bet mode is in the betslip. Double chance applies only to three-way matches, so two-way rows are hidden in that view. Two-way sports rows include an empty draw cell in `3way` so their Over/Under odd-cell matches Football's column and width.

### Matches column
Uses the main document scroller. Date and league headers stick below the toolbar. Match rows show teams, odds controls, selection state, and, for live rows, status/time and score.

### Insights column
Displays picks and folds with a `Max folds` number input defaulting to `12`. The limit caps displayed picks, total fold odds, and the bets loaded by `Add folds`. It is sticky/full-height on wide screens and stacks below the matches on narrower screens. Detailed model stats open through each pick's `Stats` button.

### Betslip
Contains `Single`, `Multiple`, and `System` mode buttons, the bet list, stake input, totals, the `Bet on site` link, and a local-analysis disclaimer. Entries are unique by match ID, market, and selection; reselecting a line updates its odds/probability instead of duplicating it. It is sticky/full-height on desktop and a fixed drawer opened by the topbar `Betslip` toggle or bottom-right FAB on small screens.

### Donate
A topbar `Donate` button opens a compact modal stating that this software is part of the free software community. It names Heri Kaniugu, offers suggested amounts of `5 USDT`, `10 USDT`, `1000 TSHS`, and `5000 TSHS`, and shows three payment options
: M-Pesa `0764181161`, Mixx by Yas `0670929342`, and Binance Pay ID `61934534`. Selecting an amount highlights it and shows the matching payment route. A custom amount field can add another chip by currency keyword. Each payment option has a copy button with inline confirmation.
 Donations are optional, and the dialog displays details only and processes no payments.

### Bet Advisor
Opens from the solid green topbar button with a GitHub/Linear-inspired dark UI: compact header, divided metric cards, bordered question rows, and timeline-style answer cards with a green left rail. On screens `<=1000px` it is a full-screen edge-to-edge modal dialog with a backdrop; above `1000px` it docks as a fixed left-side chat panel beside the filters, below the topbar, and uses a non-modal dialog so picks and the betslip stay unobstructed.
 It shows a live summary of today's local bets (count, stake, potential return, average market chance), FAQ-style quick questions, and a free-text ask field. Quick questions cover betslip summaries, plans, strongest and riskiest lines, live watch, value picks, bookmaker margin, and market freshness. Answers use titled sections with numbered or bulleted lines instead of pipe-separated text, and are computed from the current `MATCHES` snapshot, current filters, model diagnostics, and the local betslip. Visible advisor copy uses a first-person analyst voice and avoids demo disclaimers; the app still places no wagers. Answers recalculate after auto updates or bet changes, and new answers scroll the thread to the bottom.

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
- Favicon is a minimal flat black circle with a white `S`; no emojis or extra betting UI beyond `Bet on site`.

## Auto update
In dynamic mode auto update is enabled after splash bootstrap. Every 15 seconds it checks `GET /api/status`, calls `POST /api/update-data` when idle, reloads cache-busted `data.js`, replaces `MATCHES`, rebuilds league options, rerenders without a page reload, and refreshes any open Bet Advisor answers. Delaying the timer until bootstrap completes and checking server status avoids overlapping scrapes and 409 console errors.

`STATIC_MODE` is selected automatically on `https:` and `file:` origins; `?api=1` forces dynamic mode on a secure origin and `?static=1` forces static mode on a local HTTP server. Static HTTP/HTTPS deployments first try `GET /api/data` every 15 seconds and merge the fresh today and live matches into the current snapshot; Vercel serves this through `api/data.js` with a 15-second CDN cache. If the API is unavailable, the client falls back to polling `data.js?t=...` with script injection, which also works from `file://` and rerenders only when `SNAPSHOT_UPDATED_AT` changes. A scheduled workflow and local `node scrape.js` runs still refresh the committed snapshot for non-Vercel static hosts.

## Security
- Local server binds only to `127.0.0.1`, allowlists `index.html`, `data.js`, `favicon.svg`, `robots.txt`, and the two minified deploy assets, and rejects unknown/hidden paths and unsupported methods.
- Local server and Vercel responses include `nosniff`, `no-referrer`, frame denial, a same-origin CSP, and `X-Robots-Tag: noindex, nofollow, noarchive`; `robots.txt` and the page meta tag also disallow indexing.
- Deployment uses `framework: null`, an empty build command, and root output so Vercel does not look for a Node entrypoint; it serves committed minified assets without source maps, `/api/data` uses `api/_scrape.js` inside the function bundle, and raw `src/*.js`, `styles.css`, `scrape.js`, and tooling return `404` via Vercel routes and the local server.
- `LICENSE` and the betslip notice state ownership and prohibit copying or reuse without permission. These are deterrents, not access control.
- Scraped fields are escaped before `innerHTML`; data snapshots load through script elements without dynamic evaluation.
- The scheduled workflow uses the built-in `GITHUB_TOKEN`; no credentials are stored in the project.

## Verification
Use the authoritative workflow and commands in `SKILL.md`.

## Risks
- SportyBet API shapes and required headers can change without notice.
- Live counts and snapshot timestamps change constantly.
- Model probabilities are heuristic diagnostics based on public odds.
