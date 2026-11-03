// Transfermarkt's internal JSON API (tmapi). The website itself is behind a bot wall from servers, but this
// API answers without headers. Used for what nobody else has: contracts, joined dates and squad values.
import type { Transfer } from "../shared/types.ts";
import { TTL, cached, getJson, mapLimit } from "./espn.ts";
import { norm, similar } from "./fotmob.ts";

const API = "https://tmapi-alpha.transfermarkt.technology";
const COMP: Record<string, string> = { "esp.1": "ES1", "eng.1": "GB1", "ger.1": "L1", "ita.1": "IT1", "fra.1": "FR1", "ned.1": "NL1", "por.1": "PO1", "bel.1": "BE1", "tur.1": "TR1", "sco.1": "SC1" };

const get = (path: string, ttl = TTL.day) => getJson<any>(`${API}${path}`, ttl).then((r) => r.data);
const ids = (key: string, list: (string | number)[]) => list.map((i) => `${key}[]=${i}`).join("&");

type TmClub = { id: string; name: string; short: string; size: number; avgAge?: number; value: number };

/** Every club in a league with its squad value; also the basis for matching ESPN teams to TM ids. */
export function leagueClubs(league: string): Promise<TmClub[]> {
  const comp = COMP[league];
  if (!comp) return Promise.resolve([]);
  return cached(`tm-league:${comp}`, TTL.day, async () => {
    const table = await get(`/competition/${comp}/table`);
    const clubIds: string[] = (table?.tables?.[0]?.clubs ?? []).map((c: any) => String(c.clubId));
    const clubs: any[] = await get(`/clubs?${ids("ids", clubIds)}`);
    return clubs.map((c) => {
      const sd = c.squadDetails ?? {};
      return {
        id: String(c.id),
        name: c.name,
        short: c.baseDetails?.shortName ?? c.name,
        size: sd.squadSize ?? 0,
        avgAge: sd.averageAge,
        value: (sd.averageMarketValue?.value ?? 0) * (sd.squadSize ?? 0),
      };
    });
  });
}

export async function findClub(league: string, name: string) {
  const clubs = await leagueClubs(league);
  let best: TmClub | undefined;
  let score = 0;
  for (const c of clubs) {
    const s = Math.max(similar(c.name, name), similar(c.short, name));
    if (s > score) (best = c), (score = s);
  }
  if (!best || score < 0.5) return undefined;
  const ranked = [...clubs].sort((a, b) => b.value - a.value);
  return { club: best, valueRank: ranked.indexOf(best) + 1, of: clubs.length };
}

export type TmPlayer = { id: string; name: string; jersey?: string; contractUntil?: string; joined?: string; marketValue?: number; foot?: string; heightCm?: number; position?: string; formerClubs?: string; portrait?: string };

export function squad(clubId: string): Promise<TmPlayer[]> {
  return cached(`tm-squad:${clubId}`, TTL.day, async () => {
    const sq = await get(`/club/${clubId}/squad`);
    const playerIds: string[] = sq?.playerIds ?? (sq?.squad ?? []).map((p: any) => p.playerId);
    if (!playerIds.length) return [];
    const players: any[] = await get(`/players?${ids("ids", playerIds)}`);
    return players.map((p) => {
      const a = p.attributes ?? {};
      const cur = (p.clubAssignments ?? []).find((x: any) => x.type === "current");
      return {
        id: String(p.id),
        // displayName is often an empty string, not missing.
        name: p.displayName || p.name,
        jersey: cur?.shirtNumber != null ? String(cur.shirtNumber) : undefined,
        contractUntil: a.contractUntil ?? undefined,
        joined: cur?.start ?? undefined,
        marketValue: p.marketValueDetails?.current?.value ?? undefined,
        foot: a.preferredFoot?.name ?? undefined,
        heightCm: a.height ? Math.round(a.height * 100) : undefined,
        position: a.position?.name ?? a.positionGroupName,
        formerClubs: a.formerClubsNote ?? undefined,
        portrait: p.portraitUrl,
      };
    });
  });
}


/** Every player in a league (all clubs' squads), for league-wide value ranks. Slow the first time, so cached for a day. */
export function leaguePlayers(league: string): Promise<(TmPlayer & { clubId: string })[]> {
  return cached(`tm-league-players:${league}`, TTL.day, async () => {
    const clubs = await leagueClubs(league);
    const squads = await mapLimit(clubs, 4, (c) => squad(c.id).then((ps) => ps.map((p) => ({ ...p, clubId: c.id }))).catch(() => []));
    return squads.flat();
  });
}

/** A player's moves, newest first. */
export function transfers(playerId: string): Promise<Transfer[]> {
  return cached(`tm-transfers:${playerId}`, TTL.day, async () => {
    const d = await get(`/transfer/history/player/${playerId}`);
    return ((d?.history?.terminated ?? []) as any[]).map((x) => {
      const type: string = x.typeDetails?.type ?? "";
      const fee = x.details?.fee;
      const kind: Transfer["kind"] = /LOAN_TRANSFER/.test(type) ? "loan" : /RETURNED/.test(type) ? "return" : /INTERNAL/.test(type) ? "youth" : /free/i.test(fee?.compact?.content ?? "") ? "free" : "transfer";
      return { date: x.details?.date, kind, fee: kind === "free" ? 0 : fee?.value || undefined, marketValue: x.details?.marketValue?.value || undefined };
    });
  });
}
