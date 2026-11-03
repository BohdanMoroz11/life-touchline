# Data sources

Three unofficial, keyless sources, combined on the server. Each can change without notice; if something breaks, `curl` the URL and look at the shape. ESPN is the backbone: if FotMob or Transfermarkt fail, pages still render (enrichment is wrapped in `soft()`).

Tested from the Hetzner box in Oct 2026: SofaScore (403), FBref (Cloudflare), the Transfermarkt website (AWS WAF challenge) and Understat's old HTML are blocked or gone. Understat's JSON API (`/getLeagueData/La_liga/2026` with `X-Requested-With: XMLHttpRequest`) works but isn't used: FotMob covers xG including the Champions League.

## ESPN (`server/espn.ts`)

Base: `https://site.api.espn.com/apis/site/v2/sports/soccer/{league}`. League slugs: `esp.1`, `eng.1`, `ger.1`, `uefa.champions` (also `ita.1`, `fra.1`, `uefa.europa`, `esp.copa_del_rey`, ...). The season year is the **start** year (`2026` = 2026-27), unlike the NBA.

| Endpoint | Used for |
|---|---|
| `/scoreboard?dates=YYYYMMDD` | Match list. No date range support (400); without a date it falls back to the latest matchday, so we fetch day-1, day, day+1 and filter on the browser's local day. `competitions[0].details` has goals and cards. |
| `/summary?event={id}` | Match page: `header` (status/score), `rosters` (lineups: `formation`, `formationPlace`, position codes, `subbedIn/Out`, per-player match stats), `keyEvents` (goals, cards, subs, VAR), `commentary` (every event, shots with `fieldPositionX/Y`), `boxscore` (team stats), `pickcenter` (moneylines incl. draw), `seasonseries` (last 5 meetings), `lastFiveGames`, `standings`. No referee, no injuries, no xG. |
| `/teams/{id}` | Colors, logo, `leagueAbbrev` (the club's domestic league; used for team context in European/cup matches). |
| `/teams/{id}/roster` | Squad with season stats **in that league** (apps, sub apps, goals, assists, shots, cards, saves). Coach data is wrong (lists old coaches): never use it. No headshots exist for soccer. |
| `/all/teams/{id}/schedule[?fixture=true]` | Results / upcoming fixtures across every competition. |
| `/news?team={id}` | Club news. |
| `https://site.api.espn.com/apis/v2/sports/soccer/{league}/standings` | Table with zone notes (`note.description`, `note.color`, sometimes `##hex`). |
| `https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/{id}[/overview]` | Player bio; per-competition season splits. |

Position codes are relative to the formation (`LM`/`RM` are the holding midfielders in a 4-2-3-1), so `server/formation.ts` places players from Opta slot tables (`formationPlace`) and only uses the codes for left/right.

## FotMob (`server/fotmob.ts`)

Base `https://www.fotmob.com/api/data/` (the old `/api/matchDetails` paths are dead). No headers needed. League ids: LaLiga 87, EPL 47, Bundesliga 54, UCL 42.

| Endpoint | Used for |
|---|---|
| `/matches?date=YYYYMMDD` | Find FotMob's match id for an ESPN match (kickoff within 3h + fuzzy team names, `findMatchId`). |
| `/matchDetails?matchId=` | `content.lineup` (`lineupType`: `unavailable` → `predicted` 1-3 days out → `standard`; starters with `horizontalLayout` x/y, `performance.rating/seasonRating`, `marketValue`; `coach`; `unavailable[]` with expected return), `playerStats` (rating, xG, xA, minutes), `shotmap.shots` (x 0-105, y 0-68, xG), `momentum.main.data` (±100, positive = home), `stats.Periods.All` (xG, big chances...), `matchFacts.infoBox` (referee with season stats, stadium capacity), `weather`, `insights`, `h2h.summary`, `playerOfTheMatch`, `general.leagueRoundName`. |
| `/teams?id=` | `fixtures.allFixtures.fixtures` (recent match ids for formation history), squad `positionIds`/`positionIdsDesc` (natural positions, e.g. `34,32` = `CB,RB`; also how position ids were mapped), squad (injuries, ratings, values, DOB, height), coach id, `history.trophyList` (honours), `overview.venue`, `stats.teams` (season stats with league ranks: xG, xGA, possession...). |
| `/playerData?id=` | Players: career, per-competition season stats with ratings, recent matches, traits (percentiles), trophies, contract end, market value. Coaches: `careerHistory` (clubs with dates), `coachStats` (W/D/L per club), `trophies.coachTrophies`. |
| `/search/suggest?term=` | FotMob team id when a match didn't give one. |
| `/leagues?id=` → `stats.players[].fetchAllUrl` | League-wide player lists (`https://data.fotmob.com/stats/{league}/season/{season}/{stat}.json`, gzipped; `TopLists[0].StatList` with `ParticiantId` [sic], `TeamId`, `StatValue`, `Rank`). Team leaders and league ranks (`server/leaders.ts`). Rating and per-90 lists have a minutes threshold. |

Photos: `https://images.fotmob.com/image_resources/playerimages/{fotmobId}.png` (players and coaches).

Players are paired across providers by shirt number + surname (`matchPerson`); first names alone never count.

## Transfermarkt internal API (`server/tm.ts`)

`https://tmapi-alpha.transfermarkt.technology`, no headers. List endpoints batch with `ids[]=`. Used for contracts, joined dates, squad values and transfer fees.

| Endpoint | Used for |
|---|---|
| `/competition/{ES1,GB1,L1,IT1,FR1,...}/table` + `/clubs?ids[]=` | Clubs of a league with squad value (`averageMarketValue × squadSize`); also how ESPN names map to TM ids (fuzzy). |
| `/club/{id}/squad` + `/players?ids[]=` | Contract until, market value, joined date, foot, height, position. `displayName` is often `""`; fall back to `name` (which can be the full legal name). All clubs' squads = league-wide value ranks (cached a day). |
| `/transfer/history/player/{id}` | Career moves with fee, market value at the time and type (`STANDARD`, `ACTIVE_LOAN_TRANSFER`, `RETURNED_FROM_PREVIOUS_LOAN`, `INTERNAL_TRANSFER`; free = fee content "Free Transfer"). Paired with FotMob career spells by start date, one move per spell, loans with loan spells. |

## Hand-written (`data/`)

`lore.json` (club identity, history, rivals, legends; keyed by ESPN club name) and `coaches.json` (style, known for; keyed by FotMob coach name). Written Oct 2026 for the 80 clubs in the four competitions; histories stop around mid-2025.
