// A club as seen from one match: squad with season numbers, coach, form across all competitions,
// fixture load, season profile with league ranks. ESPN is the backbone; FotMob and Transfermarkt enrich.
import type { Coach, FixtureRow, SquadPlayer, TeamDetail } from "../shared/types.ts";
import { TTL, cached, espn, mapLimit, soft } from "./espn.ts";
import { compShort, leagueById, slugForCompetition } from "./leagues.ts";
import { FM_LEAGUE, fmPhoto, fotmob, matchPerson, similar } from "./fotmob.ts";
import { findClub, squad as tmSquad } from "./tm.ts";
import { getTable } from "./standings.ts";
import { coachLore, lore } from "./lore.ts";

const DAY = 86400_000;

function fixtureRow(e: any, teamId: string): FixtureRow | undefined {
  const c = e.competitions?.[0];
  if (!c) return undefined;
  const me = c.competitors.find((x: any) => String(x.team?.id ?? x.id) === teamId);
  const opp = c.competitors.find((x: any) => x !== me);
  if (!me || !opp) return undefined;
  const state = c.status?.type?.state === "post" ? "post" : c.status?.type?.state === "in" ? "in" : "pre";
  const sc = (x: any) => (typeof x.score === "object" ? x.score?.displayValue : x.score);
  const mine = Number(sc(me)), theirs = Number(sc(opp));
  const comp = e.league?.name ?? e.league?.abbreviation ?? e.seasonType?.name ?? "";
  return {
    id: String(e.id),
    date: e.date,
    league: e.league?.slug ?? slugForCompetition(comp) ?? "",
    comp: compShort(e.league?.abbreviation === "LALIGA" ? "LaLiga" : comp),
    opponent: { id: String(opp.team.id), name: opp.team.shortDisplayName ?? opp.team.displayName, abbr: opp.team.abbreviation, logo: opp.team.logos?.[0]?.href ?? `https://a.espncdn.com/i/teamlogos/soccer/500/${opp.team.id}.png` },
    home: me.homeAway === "home",
    state,
    score: state === "pre" || isNaN(mine) ? undefined : `${mine}-${theirs}`,
    // Shootouts: ESPN marks the winner even when the score is level.
    result: state !== "post" || isNaN(mine) ? undefined : mine > theirs ? "W" : mine < theirs ? "L" : me.winner ? "W" : opp.winner ? "L" : "D",
  };
}

export type RecentPlayer = { id: string; name: string; short: string; jersey?: string; pos?: string; place?: number; starter: boolean; subIn: boolean };
export type RecentXI = { matchId: string; date: string; comp: string; opponent: string; formation?: string; players: RecentPlayer[] };

/** Starting XIs from the club's last few matches in any competition; drives "recent starts", formations and the probable XI. */
export function recentLineups(teamId: string, results: FixtureRow[], n = 6): Promise<RecentXI[]> {
  const done = results.filter((r) => r.state === "post" && r.league).slice(0, n);
  return cached(`recent-xi:${teamId}:${done.map((d) => d.id).join(",")}`, TTL.long, () =>
    mapLimit(done, 3, async (r) => {
      const s = await soft(espn.summary(r.league, r.id, TTL.day), `summary ${r.id}`);
      const ro = (s?.rosters ?? []).find((x: any) => String(x.team?.id) === teamId);
      if (!ro) return undefined;
      const players: RecentPlayer[] = (ro.roster ?? []).map((p: any) => ({
        id: String(p.athlete.id),
        name: p.athlete.displayName,
        short: p.athlete.shortName,
        jersey: p.jersey,
        pos: p.position?.abbreviation,
        place: Number(p.formationPlace) || undefined,
        starter: !!p.starter,
        subIn: !!p.subbedIn,
      }));
      return { matchId: r.id, date: r.date, comp: r.comp, opponent: r.opponent.name, formation: ro.formation as string | undefined, players } as RecentXI;
    }).then((xs) => xs.filter((x): x is RecentXI => !!x)),
  );
}

const roleOf = (abbr = ""): SquadPlayer["role"] => (abbr.startsWith("G") ? "G" : abbr.startsWith("D") ? "D" : abbr.startsWith("F") ? "F" : "M");

function statMap(a: any) {
  const m: Record<string, number> = {};
  for (const c of a.statistics?.splits?.categories ?? []) for (const s of c.stats ?? []) m[s.name] = Number(s.value ?? 0);
  return m;
}

/** How central a player is to this team right now, 0..100. Blends playing time, recent starts, output and quality signals. */
function importance(p: SquadPlayer, maxApps: number, recentN: number) {
  const share = maxApps ? Math.min(1, p.starts / maxApps) : 0;
  const recent = recentN ? (p.recentStarts ?? 0) / recentN : 0;
  const output = Math.min(1, (p.goals + p.assists * 0.7) / Math.max(4, maxApps * 0.6));
  const rating = p.rating ? Math.max(0, Math.min(1, (p.rating - 6.4) / 1.2)) : 0.3;
  const value = p.marketValue ? Math.min(1, Math.log10(p.marketValue / 1e6 + 1) / 2.2) : 0.2;
  // Injured stars still matter: value and rating keep them ranked even with no recent minutes.
  return Math.round(100 * (0.3 * share + 0.25 * recent + 0.12 * output + 0.15 * rating + 0.18 * value));
}

async function fmTeamId(name: string, hint?: string): Promise<number | undefined> {
  if (hint && Number(hint)) return Number(hint);
  return cached(`fm-team-search:${name}`, TTL.day, async () => {
    const r = await fetch(`https://www.fotmob.com/api/data/search/suggest?term=${encodeURIComponent(name)}`).then((x) => x.json());
    const teams = (r?.[0]?.suggestions ?? []).filter((s: any) => s.type === "team" && !/\(W\)|U\d\d|Castilla|II\b|B$/.test(s.name));
    const best = teams.find((t: any) => similar(t.name, name) >= 0.85) ?? teams[0];
    return best ? Number(best.id) : undefined;
  });
}

async function coachFrom(fmTeam: any): Promise<Coach | undefined> {
  const member = (fmTeam?.squad?.squad ?? []).find((g: any) => g.title === "coach")?.members?.[0];
  if (!member) return undefined;
  const person = await soft(fotmob.person(member.id), "fotmob coach");
  const entries: any[] = person?.careerHistory?.careerItems?.coach?.teamEntries ?? [];
  const active = entries.find((e) => e.active) ?? entries[0];
  const cs = person?.coachStats;
  const hist: any[] = cs?.historicalCareerEntries ?? [];
  const current = cs?.activeCareerEntry;
  // FotMob splits a second spell at the same club into its own entry; the active one has the current numbers.
  const record = current?.matches ? { games: current.matches, w: current.wins, d: current.draws, l: current.losses, ppg: current.matches ? (current.wins * 3 + current.draws) / current.matches : undefined } : undefined;
  const trophies: Coach["trophies"] = [];
  for (const t of person?.trophies?.coachTrophies ?? []) {
    for (const tour of t.tournaments ?? []) {
      if (!tour.seasonsWon?.length) continue;
      trophies.push({ title: `${tour.leagueName} (${t.teamName})`, count: tour.seasonsWon.length, years: tour.seasonsWon.join(", ") });
    }
  }
  trophies.sort((a, b) => b.count - a.count);
  return {
    name: member.name,
    photo: fmPhoto(member.id),
    nationality: member.cname,
    age: member.age,
    appointed: active?.startDate,
    record,
    previous: hist
      .filter((h) => !(h.teamId === current?.teamId && !h.endDate))
      .map((h) => ({ club: h.teamName, from: h.startDate?.utcTime, to: h.endDate?.utcTime, games: h.matches, ppg: h.pointsPerGame }))
      .filter((h) => h.games),
    trophies,
    source: "FotMob",
  };
}

export async function getTeam(matchLeague: string, id: string, opts: { fm?: string; at?: string } = {}): Promise<TeamDetail> {
  const teamRes = await espn.team(matchLeague, id);
  const t = teamRes.team;
  // In Europe or a cup, the club's own league says more: squad stats, table position, values, season profile.
  const league: string = /^[a-z]{3}\.\d$/.test(t.leagueAbbrev ?? "") ? t.leagueAbbrev : matchLeague;
  const [roster, results, fixtures, table, news] = await Promise.all([
    soft(espn.roster(league, id), "roster"),
    soft(espn.results(id), "results"),
    soft(espn.fixtures(id), "fixtures"),
    soft(getTable(league), "table"),
    soft(espn.teamNews(league, id), "news"),
  ]);
  const at = opts.at ? Date.parse(opts.at) : Date.now();

  const past = ((results?.events ?? []) as any[]).map((e) => fixtureRow(e, id)).filter((r): r is FixtureRow => !!r && r.state === "post").sort((a, b) => b.date.localeCompare(a.date));
  const upcoming = ((fixtures?.events ?? []) as any[]).map((e) => fixtureRow(e, id)).filter((r): r is FixtureRow => !!r && r.state !== "post").sort((a, b) => a.date.localeCompare(b.date));

  const fmId = await soft(fmTeamId(t.displayName, opts.fm), "fotmob team id");
  const [fmTeam, recent, tm] = await Promise.all([
    fmId ? soft(fotmob.team(fmId), "fotmob team") : undefined,
    soft(recentLineups(id, past), "recent lineups"),
    soft(findClub(league, t.displayName), "tm club"),
  ]);
  const [coach, tmPlayers] = await Promise.all([soft(coachFrom(fmTeam), "coach"), tm ? soft(tmSquad(tm.club.id), "tm squad") : undefined]);

  // ---- squad ----
  const recentN = recent?.length ?? 0;
  const startCount = new Map<string, number>();
  for (const r of recent ?? []) for (const p of r.players) if (p.starter) startCount.set(p.id, (startCount.get(p.id) ?? 0) + 1);
  const fmMembers: any[] = (fmTeam?.squad?.squad ?? []).filter((g: any) => g.title !== "coach").flatMap((g: any) => g.members ?? []);
  const fmPeople = fmMembers.map((m) => ({ ...m, jersey: m.shirtNumber != null ? String(m.shirtNumber) : undefined }));

  const squad: SquadPlayer[] = ((roster?.athletes ?? []) as any[]).map((a) => {
    const s = statMap(a);
    const fm = matchPerson(fmPeople, a.displayName, a.jersey);
    const tp = tmPlayers ? matchPerson(tmPlayers, a.displayName, a.jersey) : undefined;
    const apps = s.appearances ?? 0;
    const injured = fm?.injured || fm?.injury;
    const p: SquadPlayer = {
      id: String(a.id),
      name: a.displayName,
      short: a.shortName ?? a.displayName,
      jersey: a.jersey,
      role: roleOf(a.position?.abbreviation),
      position: tp?.position ?? fm?.positionIdsDesc,
      age: a.age ?? fm?.age,
      nationality: a.citizenship ?? fm?.cname,
      flag: a.flag?.href,
      photo: fm ? fmPhoto(fm.id) : undefined,
      heightCm: fm?.height ?? tp?.heightCm,
      apps,
      starts: apps - (s.subIns ?? 0),
      goals: s.totalGoals ?? 0,
      assists: s.goalAssists ?? 0,
      shots: s.totalShots ?? 0,
      sot: s.shotsOnTarget ?? 0,
      yc: s.yellowCards ?? 0,
      rc: s.redCards ?? 0,
      saves: s.saves,
      conceded: s.goalsConceded,
      marketValue: tp?.marketValue ?? fm?.transferValue,
      contractUntil: tp?.contractUntil,
      injury: injured ? { status: /doubt|few days|day-to-day/i.test(fm.injury?.expectedReturn ?? "") ? "doubt" : "out", reason: "Injury", returns: fm.injury?.expectedReturn } : undefined,
      recentStarts: startCount.get(String(a.id)) ?? 0,
      rating: fm?.rating || undefined,
      importance: 0,
      fmId: fm?.id ? Number(fm.id) : undefined,
      tmId: tp?.id,
    };
    return p;
  });
  const maxApps = Math.max(1, ...squad.map((p) => p.apps));
  for (const p of squad) p.importance = importance(p, maxApps, recentN);
  squad.sort((a, b) => b.importance - a.importance);

  // ---- standing, profile ----
  const rows = table?.groups.flatMap((g) => g.rows) ?? [];
  const standingRow = rows.find((r) => r.teamId === id);
  const form = past.filter((r) => r.league === league).slice(0, 5).map((r) => r.result).reverse().join("");
  const profileKeys: Record<string, [string, string, (v: number) => string]> = {
    "Expected goals": ["xg", "xG for", (v) => v.toFixed(1)],
    "xG conceded": ["xga", "xG against", (v) => v.toFixed(1)],
    "Goals per match": ["gpm", "Goals per match", (v) => v.toFixed(1)],
    "Goals conceded per match": ["gcpm", "Conceded per match", (v) => v.toFixed(1)],
    "Average possession": ["poss", "Possession", (v) => `${v.toFixed(0)}%`],
    "Clean sheets": ["cs", "Clean sheets", (v) => String(v)],
    "Big chances": ["bc", "Big chances", (v) => String(v)],
    "Shots on target per match": ["sotpm", "On target per match", (v) => v.toFixed(1)],
  };
  const fmLeagueMatches = fmTeam?.stats?.primaryLeagueId && String(fmTeam.stats.primaryLeagueId) === String(FM_LEAGUE[league] ?? "");
  const profile = fmLeagueMatches
    ? ((fmTeam.stats.teams ?? []) as any[])
        .filter((x) => profileKeys[x.header])
        .map((x) => {
          const [key, label, fmt] = profileKeys[x.header];
          const v = Number(x.participant?.value ?? 0);
          return { key, label, value: v, display: fmt(v), rank: x.participant?.rank };
        })
    : [];

  // ---- fixture load (relative to the match being viewed) ----
  const before = past.filter((r) => Date.parse(r.date) < at - 3 * 3600_000);
  const after = upcoming.filter((r) => Date.parse(r.date) > at + 3 * 3600_000);
  const last = before[0];
  const next = after[0];

  const venueStats = new Map<string, any>((fmTeam?.overview?.venue?.statPairs ?? []) as [string, any][]);
  const l = lore(t.displayName);
  return {
    id,
    league,
    leagueName: leagueById(league).short,
    name: t.displayName,
    short: t.shortDisplayName ?? t.displayName,
    abbr: t.abbreviation,
    logo: t.logos?.[0]?.href ?? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`,
    color: (t.color ?? "556070").replace("#", ""),
    altColor: (t.alternateColor ?? "ffffff").replace("#", ""),
    standing: standingRow ? { ...standingRow, form, of: rows.length } : undefined,
    coach: coach ? { ...coach, style: coachLore(coach.name)?.style, knownFor: coachLore(coach.name)?.known_for, formations: formationCounts(recent ?? []), formation: formationCounts(recent ?? [])[0]?.formation } : undefined,
    squad,
    results: past.slice(0, 10),
    fixtures: upcoming.slice(0, 8),
    load: {
      last,
      next,
      daysRest: last ? Math.floor((at - Date.parse(last.date)) / DAY) : undefined,
      daysToNext: next ? Math.floor((Date.parse(next.date) - at) / DAY) : undefined,
      last30: before.filter((r) => at - Date.parse(r.date) <= 30 * DAY).length,
    },
    squadValue: tm ? { total: tm.club.value, rank: tm.valueRank, avgAge: tm.club.avgAge } : undefined,
    lore: l,
    news: ((news?.articles ?? []) as any[]).slice(0, 8).map((a) => ({ headline: a.headline, description: a.description, published: a.published, link: a.links?.web?.href, image: a.images?.[0]?.url })),
    profile,
    leagueSize: rows.length || undefined,
    venue: fmTeam?.overview?.venue?.widget?.name
      ? { name: fmTeam.overview.venue.widget.name, city: fmTeam.overview.venue.widget.city, capacity: venueStats.get("Capacity"), opened: venueStats.get("Opened") }
      : undefined,
    honours: ((fmTeam?.history?.trophyList ?? []) as any[])
      .filter((x) => x.won > 0)
      .map((x) => ({ title: x.name, count: Number(x.won), last: String(x.seasonsWon ?? "").split(",")[0] || undefined }))
      .sort((a, b) => b.count - a.count),
    fmId,
    tmId: tm?.club.id,
    recentXIs: (recent ?? []).map((r) => ({ matchId: r.matchId, date: r.date, comp: r.comp, opponent: r.opponent, formation: r.formation, starters: r.players.filter((p) => p.starter).map((p) => p.id) })),
  };
}

function formationCounts(recent: { formation?: string }[]) {
  const m = new Map<string, number>();
  for (const r of recent) if (r.formation) m.set(r.formation, (m.get(r.formation) ?? 0) + 1);
  return [...m.entries()].map(([formation, count]) => ({ formation, count })).sort((a, b) => b.count - a.count);
}
