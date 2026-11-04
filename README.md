# Touchline

> ⚡ Vibe coded: agents wrote it, I steered. Maintained to the standard of "works on my machine".

<img width="1466" height="833" alt="image" src="https://github.com/user-attachments/assets/9f0328cb-2ee7-4dfa-bb62-b64f043408e5" />

A personal second screen for watching football. Pick a match and get one dashboard (no scrolling) with everything about both clubs and the game. Covers **LaLiga, Premier League, Bundesliga and the Champions League**.

**Header**
- Score or kickoff countdown in your timezone, with goalscorers and red cards under each club.
- Live minute and "updated Xs ago". The score lifts when a goal goes in.
- Win/draw/win chances from the odds.

**The pitch** (centre)
- Both XIs on a tactics board in their real formation geometry: player faces in kit-colored rings with shirt numbers, plus season goals and assists.
- The benches sit in dugouts beside the pitch, showing who came on and when.
- Rating badges and markers for goals, assists, cards, substitutions and player of the match.
- Before lineups are out it shows a **probable XI**: FotMob's prediction, or our own built from recent starting XIs minus injured and suspended players. A bar under each player shows how often they've started lately.
- A **shot map** with dots sized by xG, and a **momentum** strip with goals marked.
- **Formation story**: click a formation to see:
  - whether ESPN and FotMob agree on it
  - the shapes the team used in its last six matches, and how settled or fluid it is
  - how the coach's team shifts with and without the ball
  - players out of position today (also tagged on the pitch)
  - likely shape changes during the match

**Club columns** (one per club)
- Club strip: position and points, form across all competitions, plus a **Club** modal with history, honours, fixtures and news.
- **Coach card**: tenure, W/D/L, points per game and usual formation. It opens a coach profile with tactical style, career by club with PPG, and trophies.
- **Fixture load**: days of rest, last result, next match and competition.
- **Season profile** with league ranks: xG for and against, goals, possession, clean sheets, big chances.
- **Missing players** with the reason and expected return date.
- **Season leaders** with photos: top scorer, most assists, best rated, most valuable.
- **Recent results** and what comes after this match.
- A **Full squad** table showing rating, goals, assists, appearances, value and contract. Once the game starts, the table switches to match numbers.

**Centre tabs**
- **Preview/Context**: what's at stake in the table, talking points, form, referee card rates, venue, weather, and who's missing.
- **Story**: key-event timeline or full commentary.
- **Stats**: this match, or the season with ranks.
- **Coaches**: a head-to-head duel.
- **Table**: live "if it ends like this", with position changes.
- **H2H**: recent meetings and the all-time record.

**Player sheet**: per-competition season stats with ratings, percentile traits vs same position, recent matches, career, trophies, value, contract and news.

**Everywhere**: hover explainers on every stat and term.

**Responsive**: three columns on a wide screen; pitch plus a switchable club panel on a laptop; tabs and a vertical pitch in a narrow side window or on a phone.

## Run it

Needs Node 22+.

```bash
npm install
npm start          # builds the frontend, serves everything on http://127.0.0.1:5190
```

The live version runs in a container at https://football.bohdanmoroz.com, behind the shared login from the [hub](https://github.com/BohdanMoroz11/hub) repo. Files changed in the primary checkout go live automatically.

Development: `npm run dev` (Vite on :5183 with hot reload, API on :5190). `PORT`/`HOST` override the API address.

## How it works

- **ESPN**'s public JSON API is the backbone: matches, lineups, events, commentary, stats, tables, squads.
- **FotMob**'s web API adds ratings, xG, momentum, shot maps, predicted lineups, injuries, referee stats, weather, coaches' careers and player photos.
- **Transfermarkt**'s internal API adds contracts and squad values.
- All three are unofficial, keyless and cached in memory. If FotMob or Transfermarkt fail, the page still works from ESPN.
- Endpoint details are in [docs/data-sources.md](docs/data-sources.md).
- Club histories and coaching styles are hand-written in `data/`.

See [AGENTS.md](AGENTS.md) for architecture, design rules and ideas.
