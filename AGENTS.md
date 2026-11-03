# AGENTS.md

Context for coding agents (and future me). Read this before changing things.

## What this is

A personal "second screen" for watching football: pick a match, get one dashboard with everything about both clubs and the game. Sibling of `~/projects/nba-tracker` (Courtside), but its own design. The owner cares about **UI/UX**, not the code. It's an MVP built on unofficial data sources; things are allowed to break, but the page should degrade gracefully.

Competitions: LaLiga, Premier League, Bundesliga, Champions League (one line each in `server/leagues.ts`; same ESPN API for all).

## Stack

- **Server**: Node + Express, TypeScript run directly with `tsx`. `server/`
- **Frontend**: React 18 + Vite + Tailwind v4 + TanStack Query. `web/`
- **Shared types**: `shared/types.ts`, the contract between server and UI. Change it first when adding data.
- Hash routing in `web/src/lib.ts`: `#/`, `#/d/YYYYMMDD`, `#/m/:league/:id`, `#/m/:league/:id/p/:espnId~:fotmobId`.
- See Deployment below. Outside the container, the API defaults to `127.0.0.1:5190` (Courtside uses 5180).

## Layout

```
server/
  index.ts      routes: /api/matches, /api/match/:league/:id, /api/team/:league/:id?fm=&at=, /api/table/:league, /api/player/:id?fm=&tm=, /api/leaders/:league?fm=&tm=
  espn.ts       ESPN URLs, fetch + in-memory TTL cache (cached()), mapLimit, soft() for optional sources
  match.ts      scoreboard -> match cards; summary -> MatchDetail (lineups, events, stats, shots, momentum estimate, odds, h2h)
  enrich.ts     FotMob over the match: ratings, photos, xG, momentum, shot map with xG, referee, weather, injuries, insights
  probable.ts   probable XI from recent ESPN lineups minus FotMob's unavailable list
  formation.ts  formation slot tables -> pitch coordinates
  team.ts       club context: squad (ESPN stats + FotMob + TM), coach (FotMob career), fixtures, load, season profile
  player.ts     player sheet (FotMob profile + ESPN splits + TM transfer fees on the career)
  leaders.ts    team leaders with league ranks (FotMob league stat lists, TM values across the league)
  fotmob.ts tm.ts standings.ts leagues.ts lore.ts data.ts (match orchestration)
data/lore.json, data/coaches.json   hand-written club and coach notes
web/src/
  lib.ts        query hooks, router, formatting, color helpers (accent/tint/onColor/ratingColor)
  glossary.ts   hover explainers; new stat or term = new entry
  styles.css    tokens (@theme) and the few custom classes (turf, counter, flash, goal-lift)
  components/   MatchesPage, MatchPage (header + 3 layouts), Pitch (photo counters, dugouts, shot map, momentum),
                ClubPanel (club header, coach card, load, profile, absences, leaders, fixtures, squad modal), CenterTabs
                (Preview/Story/Stats/Coaches/Table/H2H), PlayerModal, CoachModal, ClubModal, ui
docs/data-sources.md   every endpoint we use and its gotchas
```

## Data notes

- See `docs/data-sources.md`. ESPN is the backbone (ids, events). FotMob and Transfermarkt are enrichment, always via `soft()` so a failure doesn't break the page.
- ESPN soccer season year = start year (`2026` = 2026-27).
- ESPN's roster `coach` field is wrong; coaches come from FotMob only.
- Cross-provider pairing (`matchPerson`): shirt number + surname. Never match on a shared first name (that bug removed half a squad from the probable XI once).
- FotMob's lineup geometry is used when it matches all 11 ESPN starters (it reads real shapes better: ESPN called the Oct 2026 Clásico 4-3-3 v 4-4-2, FotMob 4-2-3-1 v 4-2-3-1).
- Probable XI: FotMob's own prediction when `lineupType === "predicted"` (only 1-3 days before), else ours: strongest of the last 3 XIs, unavailable players swapped for the most regular starter in the same role (roles from starts, then the squad list). Confidence = weighted share of recent starts.
- For European/cup matches, team context (squad stats, standing, values, profile) uses the club's domestic league (`team.leagueAbbrev`), labelled "in Serie A".
- **Formation context** (`server/shape.ts`, UI `Shape.tsx` behind the formation label in the pitch bar): ESPN vs FotMob formation (flag when they differ; the pitch uses FotMob's), formations in the last 6 FotMob lineups (fluidity: settled ≥80% one shape, switches ≥50%, else fluid), out-of-position starters (today's FotMob slot vs the player's natural positions from the FotMob squad, compared by position family so CM↔CDM isn't flagged; "at RB" tag on the pitch), and in-game reshapes inferred from substitutions across lines (extra centre-back = maybe a back five, striker for a midfielder = two up front) and red cards, using the score at that minute. In/out-of-possession shapes and roles are hand-written per coach in `data/coaches.json` (`shapes`, with a confidence level). FotMob position ids map is `POSITIONS` in `fotmob.ts`.
- Momentum: FotMob's when available, else our estimate from ESPN commentary (labelled as an estimate).
- Caching: all in memory; live data 15 s, teams 30 min–6 h, FotMob people 24 h.

## Design

Direction: **"tactics board under floodlights"**. Graphite night base (`night`, `stand`, `terrace`), chalk text, the **pitch is the one bold element** (mown stripes, chalk lines, kit-colored counters with shirt numbers). Card colors are the only semantic accents: yellow = doubtful/yellow card, red = out/red card. Clubs bring their own colors via `accent()` (text/strokes on dark) and `tint()` (washes). Fonts: Sofia Sans Extra Condensed (display: scores, names, numbers), Sofia Sans Semi Condensed (UI/data), Sofia Sans (prose).

- **The match page never scrolls** (owner's #1 rule). Detail goes into tabs, popovers and modals; tab bodies may scroll internally.
- Football convention: **home on the left** (and at the bottom of a vertical pitch).
- Layouts by window width (`useWidth`): ≥1500 wide = home | centre | away (side columns kept lean, 340px min, so the centre gets the room); ≥1000 medium = centre | club panel with home/away switch; narrow = tab bar (Pitch, Home, Away, centre tabs) with a vertical pitch. Below 1200px the benches move behind a "Bench" toggle instead of dugouts.
- **The pitch is the squad view** (owner's call: don't list the XI twice). Counters are player photos in a kit-colored ring with the shirt number as a badge (`PlayerDisc`), plus rating, events and a season G/A line. The bench lives in **dugouts** beside the pitch (`Dugout`), or in a two-row strip under it when side dugouts would shrink the pitch too much, or behind a "Bench" view on narrow screens.
- Counters never overlap: `placeCounters` starts from the formation spots and nudges colliding counters apart (sideways along their line, or a little along the pitch), inside the touchlines. Box sizes are measured from the real name widths. On a cramped pitch (`compact`) the season/sub line under the name is dropped (it's in the tooltip); if counters still clash, faces shrink a step at a time until they don't. Shirt-number badges are ~half the face size so numbers stay readable.
- Type sizes were tuned by the owner: Tailwind's named sizes are 1.1x (`--text-*` in `styles.css`), arbitrary `text-[Npx]` values are already scaled, and the pitch, pitch bar and benches run at about 1.21x.
- The Story tab is two columns, first half | second half (stacked on narrow, the half in play on top).
- Club panels hold what the pitch doesn't: coach, load, season profile, then Missing and a tab row (Players / Results / Fixtures) that is **identical on both sides** (one shared choice, so you compare like with like; bodies scroll inside). Missing sits above the tabs when the column is tall enough, else it becomes the first tab. Never let the two columns show different sections. The full squad table is a modal ("Full squad").
- Players tab = leader boards (leader with photo, next three, league rank; scrolls inside). "All leaders" / the Leaders button open the full per-team lists for every stat with team and league rank. The player sheet shows the same ranks ("Rankings", and next to market value). Falls back to the old four ESPN cards when FotMob/TM leaders are missing.
- Club panels use container queries (`@container`) so columns appear as they widen.
- Main grids need `grid-rows-[minmax(0,1fr)]`, or a tall panel grows the row past the viewport.
- One numbers toggle (This match / Season) drives pitch badges and squad columns; it defaults to the match once it has started.
- Every stat/term gets a hover explainer (`tip()` / `<Term>`). Tooltips are the app-wide `data-tip` layer; don't use `title=`.
- Motion: only the goal lift on the score (`goal-lift`) and the flash on changed live numbers.
- Check at 1920×1080, 1600×950, 1440×900, 1280×720, 390×760. `document.documentElement.scrollHeight` must equal the viewport height on the match page.

## Conventions

- Small files, functional components, Tailwind inline, minimal comments explaining *why*.
- Run `npm run typecheck` and `npm run build` before committing.
- To eyeball UI: `npm start`, then screenshot with Playwright.

## Ideas for later

- Coach head-to-head record (FotMob has no direct endpoint; could be derived from h2h matches + coach tenures).
- Season xG trend sparkline per club (FotMob team fixtures have per-match xG).
- League top scorers / assists race popover.
- Live "if it ends now" for the other matches in the same matchday.
- Copa del Rey / FA Cup / DFB-Pokal on the match list (just add to `LEAGUES`).
- Persisted cache if sources get slow.

<!-- platform:start -->
## Deployment

Live at https://football.bohdanmoroz.com, behind the shared hub login. Do not add auth to this app.

- The `football-tracker` container mounts this repo's primary checkout and runs `npm run live`. Caddy reaches it at `football-tracker:3000`. No host port is published.
- There is no build or deploy step. Files changed in the primary checkout go live automatically, so `main` there is production.
- Worktree changes are not live until merged into the primary checkout's `main`. If merged on GitHub, run `git pull` in the primary checkout.
- Preview in a worktree with `npm run dev`. Don't use the primary checkout for experiments.
- If dependencies change, once they're on `main` run `npm install` in the primary checkout, on the host, then `docker restart football-tracker`.
- If `compose.yml` changes, run `docker compose up -d` in the primary checkout.
- Logs: `docker logs -f football-tracker`.
- Never use root or an Alpine image: files and `node_modules` are shared with the host.
- Routing, login and the app list belong to the `hub` repo. Don't change them from here.
<!-- platform:end -->
