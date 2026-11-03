// Player sheet: FotMob profile (ratings, career, traits) when we know the FotMob id, ESPN for the rest.
import type { PlayerDetail, Transfer } from "../shared/types.ts";
import { espn, soft } from "./espn.ts";
import { compShort } from "./leagues.ts";
import { fmPhoto, fotmob } from "./fotmob.ts";
import { transfers as tmTransfers } from "./tm.ts";

const num = (v: any) => (v == null || v === "" || isNaN(Number(v)) ? undefined : Number(v));

export async function getPlayer(id: string, fmHint?: string, tmId?: string): Promise<PlayerDetail> {
  const espnId = id.startsWith("fm") ? undefined : id;
  const fmId = fmHint || (id.startsWith("fm") ? id.slice(2) : undefined);
  const [bio, overview, fm, moves] = await Promise.all([
    espnId ? soft(espn.athlete(espnId), "athlete") : undefined,
    espnId ? soft(espn.athleteOverview(espnId), "athlete overview") : undefined,
    fmId ? soft(fotmob.person(fmId), "fotmob player") : undefined,
    tmId ? soft(tmTransfers(tmId), "tm transfers") : undefined,
  ]);
  const a = bio?.athlete;
  if (!a && !fm) throw new Error("Player not found");

  const info = new Map<string, any>(((fm?.playerInformation ?? []) as any[]).map((i) => [i.title, i.value]));
  const mainPos = fm?.positionDescription?.positions?.find((p: any) => p.isMainPosition) ?? fm?.positionDescription?.positions?.[0];

  // Season by competition: FotMob has ratings and minutes; ESPN has shots and cards. Merge on competition name.
  const season: PlayerDetail["season"] = [];
  const fmSeason = fm?.careerHistory?.careerItems?.senior?.seasonEntries?.[0];
  for (const t of fmSeason?.tournamentStats ?? []) {
    if (t.isFriendly) continue;
    season.push({ comp: compShort(t.leagueName), apps: num(t.appearances), goals: num(t.goals), assists: num(t.assists), rating: num(t.rating?.rating) });
  }
  const st = overview?.statistics;
  const names: string[] = st?.names ?? [];
  for (const sp of st?.splits ?? []) {
    const label = compShort(String(sp.displayName ?? "").replace(/^\d{4}(-\d{2})?\s*/, ""));
    if (/friendly|nations league|world cup|qualif/i.test(sp.displayName ?? "")) continue;
    const v = (k: string) => num(sp.stats?.[names.indexOf(k)]);
    const row = season.find((r) => r.comp === label) ?? (season.push({ comp: label }), season[season.length - 1]);
    row.starts ??= v("starts");
    row.goals ??= v("totalGoals");
    row.assists ??= v("goalAssists");
    row.shots = v("totalShots");
    row.sot = v("shotsOnTarget");
    row.yc = v("yellowCards");
    row.rc = v("redCards");
  }
  const main = fm?.mainLeague?.stats as any[] | undefined;
  if (main) {
    const g = (t: string) => num(main.find((s) => s.title === t)?.value);
    const row = season.find((r) => r.comp === compShort(fm.mainLeague.leagueName));
    if (row) {
      row.minutes = g("Minutes played");
      row.starts = g("Started") ?? row.starts;
      row.rating = g("Rating") ?? row.rating;
    }
  }

  const recent: PlayerDetail["recent"] = ((fm?.recentMatches ?? []) as any[]).slice(0, 10).map((r) => {
    const mine = r.isHomeTeam ? r.homeScore : r.awayScore;
    const theirs = r.isHomeTeam ? r.awayScore : r.homeScore;
    return {
      date: r.matchDate?.utcTime,
      comp: compShort(r.leagueName),
      opponent: r.opponentTeamName,
      home: !!r.isHomeTeam,
      score: mine != null ? `${mine}-${theirs}` : undefined,
      result: mine == null ? undefined : mine > theirs ? "W" : mine < theirs ? "L" : "D",
      minutes: r.minutesPlayed,
      goals: r.goals,
      assists: r.assists,
      rating: num(r.ratingProps?.rating),
      potm: r.playerOfTheMatch,
      bench: r.onBench && !r.playedInMatch,
    };
  });

  const career: PlayerDetail["career"] = ((fm?.careerHistory?.careerItems?.senior?.teamEntries ?? []) as any[]).map((e) => ({
    club: e.team,
    from: e.startDate,
    to: e.endDate ?? undefined,
    apps: num(e.appearances),
    goals: num(e.goals),
    assists: num(e.assists),
    loan: /loan/i.test(e.transferType?.text ?? ""),
  }));
  arrivals(moves ?? [], career).forEach((t, i) => (career[i].transfer = t));
  const nat = fm?.careerHistory?.careerItems?.["national team"]?.teamEntries?.find((e: any) => !/U\d\d/.test(e.team));

  const trophies: PlayerDetail["trophies"] = [];
  for (const t of fm?.trophies?.playerTrophies ?? []) for (const tour of t.tournaments ?? []) if (tour.seasonsWon?.length) trophies.push({ title: tour.leagueName, count: tour.seasonsWon.length });
  const merged = new Map<string, number>();
  for (const t of trophies) merged.set(t.title, (merged.get(t.title) ?? 0) + t.count);

  const contract = info.get("Contract end")?.fallback?.utcTime ?? info.get("Contract end")?.dateValue;
  return {
    id,
    name: fm?.name ?? a.displayName,
    jersey: a?.jersey ?? info.get("Shirt")?.fallback,
    position: mainPos?.strPos?.label ?? a?.position?.displayName,
    positions: (fm?.positionDescription?.positions ?? []).map((p: any) => p.strPosShort?.label).filter(Boolean),
    age: a?.age ?? num(info.get("Age")?.numberValue),
    dob: a?.displayDOB ?? fm?.birthDate?.utcTime?.slice(0, 10),
    nationality: a?.citizenship ?? info.get("Country")?.fallback,
    heightCm: num(info.get("Height")?.numberValue) ?? (a?.height ? Math.round(a.height * 2.54) : undefined),
    foot: info.get("Preferred foot")?.fallback,
    photo: fmId ? fmPhoto(fmId) : undefined,
    team: fm?.primaryTeam ? { name: fm.primaryTeam.teamName } : a?.team ? { name: a.team.displayName, logo: a.team.logos?.[0]?.href } : undefined,
    marketValue: num(info.get("Market value")?.numberValue),
    contractUntil: contract,
    injury: fm?.injuryInformation ? { reason: fm.injuryInformation.name, returns: fm.injuryInformation.expectedReturn?.expectedReturnFallback ?? fm.injuryInformation.expectedReturn } : undefined,
    season,
    recent,
    career,
    international: nat ? { team: nat.team, apps: num(nat.appearances), goals: num(nat.goals) } : undefined,
    traits: fm?.traits?.items?.length ? { title: fm.traits.title, items: fm.traits.items.map((i: any) => ({ label: i.title, value: Number(i.value) })) } : undefined,
    trophies: [...merged.entries()].map(([title, count]) => ({ title, count })).sort((x, y) => y.count - x.count),
    news: ((overview?.news ?? []) as any[]).slice(0, 6).map((n) => ({ headline: n.headline, published: n.published, link: n.links?.web?.href })),
  };
}

const DAY = 86400_000;

/**
 * Pair Transfermarkt moves with FotMob career spells by start date. One move per spell, closest pairs first,
 * and loans only with loan spells, so a one-day "return" spell doesn't steal the next club's fee.
 */
function arrivals(moves: Transfer[], spells: { from?: string; to?: string; loan?: boolean }[]): (Transfer | undefined)[] {
  const pairs: { s: number; m: number; d: number }[] = [];
  spells.forEach((sp, s) => {
    if (!sp.from) return;
    const t = Date.parse(sp.from);
    moves.forEach((mv, m) => {
      const d = Math.abs(Date.parse(mv.date) - t);
      if (mv.kind !== "return" && (mv.kind === "loan") === !!sp.loan && d <= 45 * DAY) pairs.push({ s, m, d });
    });
  });
  const out: (Transfer | undefined)[] = spells.map(() => undefined);
  const used = new Set<number>();
  for (const { s, m } of pairs.sort((a, b) => a.d - b.d)) {
    if (out[s] || used.has(m)) continue;
    used.add(m);
    out[s] = moves[m];
  }
  // A loan made permanent during the spell (Mbappé to PSG): show the fee it became.
  return out.map((mv, s) => {
    if (mv?.kind !== "loan") return mv;
    const end = spells[s].to ? Date.parse(spells[s].to!) : Infinity;
    const bought = moves.find((x) => x.kind === "transfer" && x.fee && Date.parse(x.date) > Date.parse(mv.date) && Date.parse(x.date) < end - 45 * DAY);
    return bought ? { ...mv, boughtFor: bought.fee } : mv;
  });
}
