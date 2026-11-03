// Team leaders with league ranks: FotMob's league-wide stat lists filtered to one club, plus Transfermarkt values.
import type { LeaderBoard, LeaderRow, TeamLeaders } from "../shared/types.ts";
import { TTL, cached, getJson, soft } from "./espn.ts";
import { FM_LEAGUE, fmPhoto } from "./fotmob.ts";
import { leagueById } from "./leagues.ts";
import { leaguePlayers } from "./tm.ts";

// FotMob list key -> how we show it. Order is the order of the boards.
const BOARDS: Record<string, Omit<LeaderBoard, "key" | "rows" | "leagueSize" | "source">> = {
  goals: { label: "Goals", unit: "goals", format: "int" },
  goal_assist: { label: "Assists", unit: "assists", format: "int" },
  _goals_and_goal_assist: { label: "Goals + assists", unit: "G+A", format: "int" },
  rating: { label: "Rating", unit: "avg", format: "dec2" },
  expected_goals: { label: "xG", unit: "xG", format: "dec1" },
  expected_assists: { label: "xA", unit: "xA", format: "dec1" },
  total_att_assist: { label: "Chances created", unit: "chances", format: "int" },
  big_chance_created: { label: "Big chances created", unit: "big chances", format: "int" },
  won_contest: { label: "Dribbles per 90", unit: "per 90", format: "dec1" },
  defensive_contributions: { label: "Defensive actions per 90", unit: "per 90", format: "dec1" },
  mins_played: { label: "Minutes", unit: "min", format: "int" },
  clean_sheet: { label: "Clean sheets", unit: "clean sheets", format: "int" },
};

type FmRow = { ParticiantId: number; ParticipantName: string; TeamId: number; StatValue: number; Rank: number };

/** One league's stat lists, keyed by FotMob stat name. */
function leagueLists(league: string): Promise<Record<string, FmRow[]>> {
  const id = FM_LEAGUE[league];
  if (!id) return Promise.resolve({});
  return cached(`fm-league-lists:${league}`, TTL.medium, async () => {
    const l = await getJson<any>(`https://www.fotmob.com/api/data/leagues?id=${id}`, TTL.long);
    const out: Record<string, FmRow[]> = {};
    await Promise.all(
      ((l?.stats?.players ?? []) as any[])
        .filter((s) => BOARDS[s.name] && s.fetchAllUrl)
        .map(async (s) => {
          const d = await soft(getJson<any>(s.fetchAllUrl, TTL.medium), `fotmob list ${s.name}`);
          out[s.name] = d?.TopLists?.[0]?.StatList ?? [];
        }),
    );
    return out;
  });
}

/** Competition ranking: ties share a rank. */
const rankIn = (values: number[], v: number) => 1 + values.filter((x) => x > v).length;

export async function getLeaders(league: string, teamFm?: number, tmClub?: string): Promise<TeamLeaders> {
  const [lists, tm] = await Promise.all([soft(leagueLists(league), "fotmob lists"), tmClub ? soft(leaguePlayers(league), "tm league players") : undefined]);
  const boards: LeaderBoard[] = [];
  if (teamFm) {
    for (const [key, meta] of Object.entries(BOARDS)) {
      const all = lists?.[key];
      if (!all?.length) continue;
      const mine = all.filter((r) => r.TeamId === teamFm && r.StatValue > 0);
      if (!mine.length) continue;
      const vals = mine.map((r) => r.StatValue);
      const rows: LeaderRow[] = mine
        .sort((a, b) => b.StatValue - a.StatValue)
        .map((r) => ({ name: r.ParticipantName, fmId: r.ParticiantId, photo: fmPhoto(r.ParticiantId), value: r.StatValue, teamRank: rankIn(vals, r.StatValue), leagueRank: r.Rank }));
      boards.push({ key, ...meta, source: "FotMob", leagueSize: all.length, rows });
    }
  }
  if (tm?.length && tmClub) {
    const valued = tm.filter((p) => p.marketValue);
    const allVals = valued.map((p) => p.marketValue!);
    const mine = valued.filter((p) => p.clubId === tmClub).sort((a, b) => b.marketValue! - a.marketValue!);
    const teamVals = mine.map((p) => p.marketValue!);
    const rows = mine.map((p) => ({ name: p.name, tmId: p.id, photo: p.portrait, value: p.marketValue!, teamRank: rankIn(teamVals, p.marketValue!), leagueRank: rankIn(allVals, p.marketValue!) }));
    // Value goes fourth, after the scoring boards and rating: it's the one people ask about.
    if (rows.length) boards.splice(Math.min(4, boards.length), 0, { key: "value", label: "Market value", unit: "value", format: "eur", source: "Transfermarkt", leagueSize: valued.length, rows });
  }
  return { league, leagueName: leagueById(league).short, boards };
}
