import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { League, LeaderBoard, MatchCard, MatchDetail, PlayerDetail, Table, TeamDetail, TeamLeaders } from "../../shared/types";

// ---------- data ----------

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${r.status})`);
  }
  return r.json();
}

export type MatchesDay = { date: string; leagues: { league: League; matches: MatchCard[] }[] };

const localYmd = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

export const useMatches = (date: string) =>
  useQuery({
    queryKey: ["matches", date],
    queryFn: async () => {
      const day = await get<MatchesDay>(`/api/matches?date=${date}`);
      // The server sends a three-day window; keep the viewer's local day.
      return { ...day, leagues: day.leagues.map((l) => ({ ...l, matches: l.matches.filter((m) => localYmd(m.date) === date) })) };
    },
    refetchInterval: (q) => (q.state.data?.leagues.some((l) => l.matches.some((m) => m.state === "in")) ? 20_000 : 60_000),
  });

export const useMatch = (league: string, id: string) =>
  useQuery({
    queryKey: ["match", league, id],
    queryFn: () => get<MatchDetail>(`/api/match/${league}/${id}`),
    refetchInterval: (q) => {
      const m = q.state.data;
      if (m?.state === "in") return 15_000;
      // Around kickoff (lineups land ~1h before), check often so nothing is missed.
      if (m?.state === "pre" && Date.parse(m.date) - Date.now() < 75 * 60_000) return 30_000;
      return 5 * 60_000;
    },
  });

export const useTeam = (league?: string, id?: string, fm?: number, at?: string) =>
  useQuery({
    queryKey: ["team", league, id, at],
    queryFn: () => get<TeamDetail>(`/api/team/${league}/${id}?${new URLSearchParams({ ...(fm ? { fm: String(fm) } : {}), ...(at ? { at } : {}) })}`),
    enabled: !!league && !!id,
    staleTime: 15 * 60_000,
  });

export const useTable = (league?: string) =>
  useQuery({
    queryKey: ["table", league],
    queryFn: () => get<Table>(`/api/table/${league}`),
    enabled: !!league,
    staleTime: 5 * 60_000,
  });

export const usePlayer = (id?: string, fm?: string, tm?: string, ready = true) =>
  useQuery({
    queryKey: ["player", id, fm, tm],
    queryFn: () => get<PlayerDetail>(`/api/player/${id}?${new URLSearchParams({ ...(fm ? { fm } : {}), ...(tm ? { tm } : {}) })}`),
    enabled: !!id && ready,
    staleTime: 30 * 60_000,
  });

/** Team leaders with league ranks, for the club's own league. */
export const useLeaders = (team?: TeamDetail) =>
  useQuery({
    queryKey: ["leaders", team?.league, team?.fmId, team?.tmId],
    queryFn: () => get<TeamLeaders>(`/api/leaders/${team!.league}?${new URLSearchParams({ ...(team!.fmId ? { fm: String(team!.fmId) } : {}), ...(team!.tmId ? { tm: team!.tmId } : {}) })}`),
    enabled: !!team && !!(team.fmId || team.tmId),
    staleTime: 30 * 60_000,
  });

export function leaderValue(b: LeaderBoard, v: number) {
  return b.format === "eur" ? euros(v) ?? "–" : b.format === "dec2" ? v.toFixed(2) : b.format === "dec1" ? v.toFixed(1) : String(Math.round(v));
}

// ---------- routing (hash based, no dependency) ----------
// #/                         today's matches
// #/d/20261025               matches on a day
// #/m/esp.1/401882832        match page
// #/m/esp.1/401882832/p/ID~FM  match page with a player sheet open (ESPN id ~ FotMob id)

export type Route =
  | { page: "matches"; date?: string }
  | { page: "match"; league: string; id: string; player?: { id: string; fm?: string } };

function parse(hash: string): Route {
  const m = hash.match(/^#\/m\/([\w.]+)\/(\w+)(?:\/p\/(\w+)(?:~(\d+))?)?/);
  if (m) return { page: "match", league: m[1], id: m[2], player: m[3] ? { id: m[3], fm: m[4] } : undefined };
  const d = hash.match(/^#\/d\/(\d{8})/);
  return { page: "matches", date: d?.[1] };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const go = (hash: string) => {
  location.hash = hash;
};

export const playerHash = (league: string, matchId: string, id: string, fm?: number | string) => `#/m/${league}/${matchId}/p/${id}${fm ? `~${fm}` : ""}`;

// ---------- formatting ----------

export function euros(n?: number) {
  if (!n) return undefined;
  if (n >= 1e9) return `€${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `€${n >= 1e8 ? Math.round(n / 1e6) : (n / 1e6).toFixed(1).replace(/\.0$/, "")}m`;
  return `€${Math.round(n / 1e3)}k`;
}

export const kickoff = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });

export function dayLabel(ymd: string) {
  const d = new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T12:00:00`);
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}

export function shiftDay(ymd: string, days: number) {
  const d = new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "since Jun 2026 · 4 months" style tenure. */
export function tenure(iso?: string) {
  if (!iso) return undefined;
  const start = new Date(iso);
  const months = Math.max(0, Math.round((Date.now() - start.getTime()) / (30.44 * 86400_000)));
  const span = months < 1 ? "new" : months < 18 ? `${months} month${months === 1 ? "" : "s"}` : `${(months / 12).toFixed(1).replace(/\.0$/, "")} years`;
  return { since: start.toLocaleDateString([], { month: "short", year: "numeric" }), span, months };
}

export const yearsUntil = (iso?: string) => (iso ? new Date(iso).getFullYear() : undefined);

export function relDays(n?: number) {
  if (n == null) return undefined;
  if (n <= 0) return "today";
  if (n === 1) return "1 day";
  return `${n} days`;
}

/** Minute string from ESPN ("45'+3'") to a number for placement on a timeline. */
export function minuteNum(m: string) {
  const [base, add] = m.replace(/'/g, "").split("+");
  return Number(base) + (Number(add) || 0) * 0.1;
}

/** Same person across providers? Accent-insensitive, surname-based ("Vinicius Junior" = "Vinícius Júnior"). */
export function samePerson(a: string, b: string) {
  const n = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").trim().split(/\s+/);
  const ta = n(a), tb = n(b);
  if (ta.join(" ") === tb.join(" ")) return true;
  const la = ta[ta.length - 1], lb = tb[tb.length - 1];
  return (lb.length > 2 && ta.includes(lb) && (ta.length === 1 || tb.length === 1 || ta[0][0] === tb[0][0])) || (la.length > 2 && tb.includes(la) && ta[0][0] === tb[0][0]);
}

// ---------- colors ----------

function lum(hex: string) {
  const h = hex.replace("#", "").padEnd(6, "0");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A club color readable as text/strokes on the dark background: lightened until it has ~3:1 contrast. */
export function accent(primary: string, alt?: string) {
  let base = primary.replace("#", "");
  // Near-white primaries (Real Madrid) read as chalk; keep them, they're already readable.
  if (lum(base) > 0.6 && alt && lum(alt) < 0.5) return `#${base}`;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(base.slice(i, i + 2), 16));
  for (let t = 0; t <= 0.8; t += 0.05) {
    const hex = [r, g, b].map((c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, "0")).join("");
    if (lum(hex) >= 0.14) return `#${hex}`;
  }
  return "#aab4c3";
}

/** Background tint for club-colored surfaces: the raw color, lifted if near-black, darkened if near-white. */
export function tint(primary: string) {
  const l = lum(primary);
  if (l < 0.012) return "#2a3442";
  if (l > 0.7) return "#3a4350";
  return `#${primary.replace("#", "")}`;
}

/** Text color that reads on top of a solid swatch. */
export const onColor = (hex: string) => (lum(hex) > 0.4 ? "#10161c" : "#ffffff");

export function ratingColor(r?: number) {
  if (r == null) return undefined;
  if (r >= 8) return "#3ea6ff";
  if (r >= 7) return "#3ecf8e";
  if (r >= 6) return "#f2a93b";
  return "#e8505b";
}

export const resultColor = (r?: string) => (r === "W" ? "var(--color-win)" : r === "L" ? "var(--color-loss)" : "var(--color-draw)");

/** Track an element's size, so layouts can fit content to the viewport instead of scrolling. */
export function useSize<T extends HTMLElement>() {
  const [el, ref] = useState<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [ref, size] as const;
}

/** Viewport-independent width breakpoints, measured on the page root (the app often lives in a side window). */
export function useWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}
