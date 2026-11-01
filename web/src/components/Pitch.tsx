import { useMemo, useState } from "react";
import type { Lineup, LineupPlayer, MatchDetail, Shot, Side, SquadPlayer } from "../../../shared/types";
import { accent, euros, go, minuteNum, playerHash, ratingColor, useSize } from "../lib";
import { tip } from "../glossary";
import { Kit } from "./ui";

/** Kit colors for a side: the match uniform when ESPN has it, else the club colors. */
export function kitOf(m: MatchDetail, side: Side) {
  const k = m.lineups[side].kit;
  return { color: k?.color ?? m[side].color, alt: k?.alt ?? m[side].altColor };
}

/** Pitch markings in meters (105 x 68), drawn as chalk lines. */
function Markings({ vertical }: { vertical: boolean }) {
  const s = { stroke: "rgba(236,238,234,0.42)", strokeWidth: 0.32, fill: "none" } as const;
  const g = (
    <g {...s}>
      <rect x={0.5} y={0.5} width={104} height={67} />
      <line x1={52.5} y1={0.5} x2={52.5} y2={67.5} />
      <circle cx={52.5} cy={34} r={9.15} />
      <circle cx={52.5} cy={34} r={0.5} fill="rgba(236,238,234,0.5)" />
      {[0, 1].map((i) => {
        const x = i ? 104.5 : 0.5;
        const d = i ? -1 : 1;
        return (
          <g key={i}>
            <rect x={i ? x - 16.5 : x} y={13.84} width={16.5} height={40.32} />
            <rect x={i ? x - 5.5 : x} y={24.84} width={5.5} height={18.32} />
            <circle cx={x + d * 11} cy={34} r={0.45} fill="rgba(236,238,234,0.5)" />
            <path d={`M ${x + d * 16.5} ${34 - 7.3} A 9.15 9.15 0 0 ${i ? 0 : 1} ${x + d * 16.5} ${34 + 7.3}`} />
            <rect x={i ? x : x - 1.6} y={30.34} width={1.6} height={7.32} strokeWidth={0.25} />
          </g>
        );
      })}
    </g>
  );
  return (
    <svg viewBox={vertical ? "0 0 68 105" : "0 0 105 68"} className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none">
      {vertical ? <g transform="translate(68 0) rotate(90)">{g}</g> : g}
    </svg>
  );
}

type Spot = { left: number; top: number };

/** Map a player's team-relative spot (depth x, lateral y) to screen percentages. Home attacks right (or up). */
function spot(p: LineupPlayer, side: Side, vertical: boolean): Spot {
  const depth = (p.x ?? 0.5) * 0.5; // own half only
  const lat = p.y ?? 0.5;
  if (!vertical) return side === "home" ? { left: depth * 100, top: lat * 100 } : { left: (1 - depth) * 100, top: (1 - lat) * 100 };
  return side === "home" ? { left: lat * 100, top: (1 - depth) * 100 } : { left: (1 - lat) * 100, top: depth * 100 };
}

function Ball({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden>
      <circle cx="6" cy="6" r="5.4" fill="#fff" stroke="#111" strokeWidth="0.8" />
      <path d="M6 3.2 8.4 4.9 7.5 7.7H4.5L3.6 4.9Z" fill="#111" />
    </svg>
  );
}

export function CardIcon({ red, className = "" }: { red?: boolean; className?: string }) {
  return <span className={`inline-block h-[11px] w-[8px] rounded-[1.5px] ${red ? "bg-red" : "bg-yellow"} ${className}`} aria-label={red ? "Red card" : "Yellow card"} />;
}

/** Natural positions vs today's slot, and where they've lined up lately. */
function shapeLine(p: LineupPlayer, m: MatchDetail, lineup: Lineup) {
  const side: Side = m.lineups.home === lineup ? "home" : "away";
  const info = m.shape?.[side]?.players[p.id];
  if (!info || (!info.natural.length && !info.recent.length)) return undefined;
  const parts = [
    p.slot ? `Today: ${p.slot}` : undefined,
    info.natural.length ? `natural: ${info.natural.join(", ")}` : undefined,
    info.recent.length ? `lately: ${info.recent.map((r) => `${r.slot} ×${r.count}`).join(", ")}` : undefined,
  ].filter(Boolean);
  return parts.join(" · ");
}

function playerTip(p: LineupPlayer, lineup: Lineup, m: MatchDetail, sp?: SquadPlayer) {
  const lines = [
    [sp?.position ?? p.pos, p.age ?? sp?.age ? `${p.age ?? sp?.age} yrs` : undefined, p.nationality ?? sp?.nationality].filter(Boolean).join(" · "),
    sp ? `League: ${sp.starts} starts${sp.apps > sp.starts ? ` (+${sp.apps - sp.starts} sub)` : ""} · ${sp.goals} goals · ${sp.assists} assists` : undefined,
    p.seasonRating ? `Season rating ${p.seasonRating.toFixed(2)}` : undefined,
    p.marketValue ?? sp?.marketValue ? `Value ${euros(p.marketValue ?? sp?.marketValue)}${sp?.contractUntil ? ` · contract to ${new Date(sp.contractUntil).getFullYear()}` : ""}` : undefined,
    sp?.injury ? `Fitness: ${sp.injury.status === "doubt" ? "doubtful" : "injured"}${sp.injury.returns ? ` (${sp.injury.returns})` : ""}` : undefined,
    p.confidence != null && lineup.status === "probable" ? `Started ${Math.round(p.confidence * 100)}% of recent matches (weighted)` : undefined,
    p.marks.goals.length ? `Goal${p.marks.goals.length > 1 ? "s" : ""} ${p.marks.goals.join(", ")}` : undefined,
    p.marks.assists.length ? `Assist${p.marks.assists.length > 1 ? "s" : ""} ${p.marks.assists.join(", ")}` : undefined,
    p.marks.subOut ? `Off ${p.marks.subOut}${p.replacedBy ? ` for ${[...lineup.bench].find((b) => b.id === p.replacedBy)?.name ?? ""}` : ""}` : undefined,
    p.fm?.xg != null ? `xG ${p.fm.xg.toFixed(2)}${p.fm.xa != null ? ` · xA ${p.fm.xa.toFixed(2)}` : ""}` : undefined,
    m.state !== "pre" && p.fm?.min ? `${p.fm.min} min played` : undefined,
    shapeLine(p, m, lineup),
    "Click for the full profile",
  ];
  return lines.filter(Boolean).join("\n");
}

export type SquadIndex = Record<Side, Map<string, SquadPlayer>>;

/** A player as a tactics-board piece: face in a kit-colored ring, shirt number as a badge. Falls back to a numbered disc. */
export function PlayerDisc({ p, kit, size, probable, dim }: { p: Pick<LineupPlayer, "photo" | "jersey" | "name">; kit: { color: string; alt?: string }; size: number; probable?: boolean; dim?: boolean }) {
  const [broken, setBroken] = useState(false);
  const ring = `#${kit.color.replace("#", "")}`;
  if (!p.photo || broken) return <Kit color={kit.color} alt={kit.alt} number={p.jersey} size={size} probable={probable} className={dim ? "opacity-50" : ""} />;
  const badge = Math.max(15, Math.round(size * 0.4));
  return (
    <span className={`relative inline-block shrink-0 ${dim ? "opacity-50" : ""}`} style={{ width: size, height: size }}>
      <img
        src={p.photo}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className={`counter size-full rounded-full bg-[#dfe3e6] object-cover object-top ${probable ? "counter-probable" : ""}`}
        style={{ border: `${size >= 40 ? 3 : 2}px solid ${ring}` }}
      />
      {p.jersey && (
        <span className="absolute -bottom-0.5 -left-1">
          <Kit color={kit.color} alt={kit.alt} number={p.jersey} size={badge} className="!border" />
        </span>
      )}
    </span>
  );
}

const lastName = (short: string) => short.replace(/^[A-ZÀ-Ý]\.\s*/, "");

function seasonLine(sp?: SquadPlayer) {
  if (!sp) return undefined;
  const bits = [sp.goals ? `${sp.goals}G` : "", sp.assists ? `${sp.assists}A` : ""].filter(Boolean);
  return bits.length ? bits.join(" ") : sp.apps ? `${sp.apps} apps` : undefined;
}

/** What a counter shows under the face: out-of-position tag, sub minute or the season line. */
// A cramped pitch keeps only the out-of-position tag; the rest stays in the tooltip.
function underLine(p: LineupPlayer, side: Side, m: MatchDetail, showSeason: boolean, compact: boolean, sp?: SquadPlayer) {
  const oop = m.shape?.[side]?.outOfPosition.find((o) => o.playerId === p.id);
  const line = !compact && (showSeason || m.state === "pre") ? seasonLine(sp) : undefined;
  const subOut = compact ? undefined : p.marks.subOut;
  return { oop, line, subOut, has: !!(oop || subOut || line) };
}

const NAME_PX = 14;
const BADGE_TOP = 4; // the rating badge pokes above the face
const LINE_PX = 12;
let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(t: string, px: number, weight = 600) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return t.length * px * 0.5;
  measureCtx.font = `${weight} ${px}px "Sofia Sans Semi Condensed", sans-serif`;
  return measureCtx.measureText(t).width;
}

type Placed = { key: string; side: Side; p: LineupPlayer; x: number; y: number; w: number; h: number };

/**
 * Pixel positions for all 22 counters. Starts from the formation spots, then nudges overlapping counters apart,
 * mostly sideways along their line so the shape still reads, and keeps everyone inside the touchlines.
 */
function placeCounters(m: MatchDetail, sides: Side[], vertical: boolean, pw: number, ph: number, size: number, showSeason: boolean, compact: boolean, squad: SquadIndex): Placed[] {
  const maxLabel = size * 2.3;
  const items: Placed[] = sides.flatMap((side) =>
    m.lineups[side].starters.map((p) => {
      const pos = spot(p, side, vertical);
      const extra = underLine(p, side, m, showSeason, compact, squad[side].get(p.id)).has;
      const w = Math.max(size + 18, Math.min(maxLabel, textWidth(lastName(p.short), NAME_PX) + 10));
      const h = BADGE_TOP + size + NAME_PX + 6 + (extra ? LINE_PX + 4 : 0);
      return { key: `${side}${p.id}`, side, p, x: (pos.left / 100) * pw, y: (pos.top / 100) * ph, w, h };
    }),
  );
  const GAP = 2;
  const clamp = (it: Placed) => {
    it.x = Math.min(pw - it.w / 2 - 1, Math.max(it.w / 2 + 1, it.x));
    it.y = Math.min(ph - it.h / 2 - 1, Math.max(it.h / 2 + 1, it.y));
  };
  items.forEach(clamp);
  for (let iter = 0; iter < 150; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = (a.w + b.w) / 2 + GAP - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + GAP - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // Lines run across the pitch: horizontal pitch -> lateral is y. Small depth overlaps go along depth instead.
        const lateralIsY = !vertical;
        const lat = lateralIsY ? oy : ox;
        const dep = lateralIsY ? ox : oy;
        // A goalkeeper tucked against the back line moves up a bit rather than shoving the whole line wide.
        const reach = 0.45 * Math.min(lateralIsY ? Math.min(a.w, b.w) : Math.min(a.h, b.h), 40);
        const alongDepth = dep < lat && dep <= Math.max(14, reach);
        if (lateralIsY !== alongDepth) {
          const d = (dy === 0 ? (i % 2 ? 1 : -1) : Math.sign(dy)) * (oy / 2 + 0.5);
          a.y -= d;
          b.y += d;
        } else {
          const d = (dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx)) * (ox / 2 + 0.5);
          a.x -= d;
          b.x += d;
        }
        clamp(a);
        clamp(b);
      }
    }
    if (!moved) break;
  }
  return items;
}

function Counter({ p, side, m, at, size, showSeason, compact, sp }: { p: LineupPlayer; side: Side; m: MatchDetail; at: Placed; size: number; showSeason: boolean; compact: boolean; sp?: SquadPlayer }) {
  const lineup = m.lineups[side];
  const kit = kitOf(m, side);
  const sentOff = !!p.marks.red;
  const rating = showSeason ? p.seasonRating ?? sp?.rating : p.rating;
  const probable = lineup.status === "probable";
  const { oop, line, subOut } = underLine(p, side, m, showSeason, compact, sp);
  return (
    <button
      onClick={() => go(playerHash(m.league, m.id, p.id, p.fmId))}
      className={`group absolute flex -translate-x-1/2 flex-col items-center focus-visible:outline-none ${sentOff ? "opacity-50" : ""}`}
      style={{ left: at.x, top: at.y - at.h / 2 + BADGE_TOP, width: at.w }}
      data-tip={playerTip(p, lineup, m, sp)}
      data-tip-title={`${p.jersey ? `#${p.jersey} ` : ""}${p.name}`}
    >
      <span className="relative flex transition-transform group-hover:scale-110 group-focus-visible:scale-110">
        <PlayerDisc p={p} kit={kit} size={size} probable={probable} />
        {rating != null && (
          <span className="absolute -right-2.5 -top-1 rounded px-[3px] font-ui text-[12.5px] font-bold leading-[17px] text-[#0d1216] tnum shadow" style={{ background: ratingColor(rating), opacity: showSeason ? 0.9 : 1 }}>
            {rating.toFixed(1)}
          </span>
        )}
        {(p.marks.yellow || p.marks.red) && <CardIcon red={sentOff} className="absolute -left-1 -top-0.5 rotate-[-12deg] shadow" />}
        {p.marks.goals.length + p.marks.ownGoals.length > 0 && (
          <span className="absolute -bottom-0.5 -right-2 flex">
            {p.marks.goals.map((g) => <Ball key={g} className="-ml-1 size-3.5 drop-shadow" />)}
            {p.marks.ownGoals.map((g) => <Ball key={`o${g}`} className="-ml-1 size-3.5 opacity-60 drop-shadow" />)}
          </span>
        )}
        {p.marks.assists.length > 0 && (
          <span className="absolute -right-3 top-1/2 rounded-full bg-chalk px-1 font-ui text-[11px] font-bold leading-[15px] text-night">A{p.marks.assists.length > 1 ? p.marks.assists.length : ""}</span>
        )}
        {p.potm && <span className="absolute -left-2.5 top-1/3 text-[14.5px] text-yellow drop-shadow" aria-label="Player of the match">★</span>}
      </span>
      <span className="mt-0.5 max-w-full truncate rounded px-1 font-ui text-[14px] font-semibold leading-tight text-chalk [text-shadow:0_1px_2px_rgba(0,0,0,.95)] group-hover:bg-black/40">
        {lastName(p.short)}
      </span>
      {oop ? (
        <span className="font-ui text-[12px] font-semibold leading-tight text-yellow [text-shadow:0_1px_2px_rgba(0,0,0,.9)]" data-tip={oop.kind === "flank" ? `Usually plays on the other flank (${oop.natural.join(", ")})` : `Out of position: usually ${oop.natural.join(", ")}`}>
          at {oop.slot}
        </span>
      ) : subOut ? (
        <span className="font-ui text-[12px] leading-tight text-red [text-shadow:0_1px_2px_rgba(0,0,0,.9)]">▼ {subOut}</span>
      ) : line ? (
        <span className="font-ui text-[12px] leading-tight text-chalk/75 tnum [text-shadow:0_1px_2px_rgba(0,0,0,.9)]">{line}</span>
      ) : null}
      {probable && p.confidence != null && (
        <span className="mt-0.5 h-[3px] w-7 overflow-hidden rounded-full bg-black/40" {...tip("confidence")}>
          <span className="block h-full rounded-full bg-chalk/80" style={{ width: `${Math.round(p.confidence * 100)}%` }} />
        </span>
      )}
    </button>
  );
}

/** The bench beside the pitch: who's next in, who came on and when. */
function Dugout({ m, side, squad, showSeason, horizontal }: { m: MatchDetail; side: Side; squad: SquadIndex; showSeason: boolean; horizontal?: boolean }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const l = m.lineups[side];
  const kit = kitOf(m, side);
  const bench = [...l.bench].sort((a, b) => Number(!!b.marks.subIn) - Number(!!a.marks.subIn) || (b.seasonRating ?? 0) - (a.seasonRating ?? 0));
  const ROWH = 41;
  // Vertical dugout: as many rows as fit. Horizontal strip: chips wrap into at most two rows.
  const perRow = horizontal ? Math.max(1, Math.floor((w + 6) / 160)) : 1;
  const fit = horizontal ? perRow * 2 : Math.max(0, Math.floor((h - 4) / ROWH));
  const shown = fit < bench.length ? bench.slice(0, Math.max(0, fit - 1)) : bench;
  const rest = bench.slice(shown.length);
  const title = l.status === "official" ? "Bench" : l.status === "probable" ? "Next in line" : "";
  if (!bench.length) return <div />;
  return (
    <div className={`flex min-h-0 flex-col ${horizontal ? "" : "h-full"}`}>
      <div className={`mb-1 flex items-center gap-1.5 font-ui text-[13.5px] font-semibold text-mute ${side === "away" && !horizontal ? "flex-row-reverse" : ""}`}>
        <span className="size-2 rounded-full" style={{ background: `#${kit.color}`, boxShadow: "0 0 0 1px rgba(255,255,255,.35)" }} />
        {title}
      </div>
      <div ref={ref} className={horizontal ? "grid grid-cols-[repeat(auto-fill,minmax(154px,1fr))] gap-1.5" : "min-h-0 flex-1 overflow-hidden"}>
        {shown.map((p) => {
          const sp = squad[side].get(p.id);
          const played = !!p.marks.subIn;
          const live = m.state !== "pre" && !showSeason;
          const rating = live ? p.rating : p.seasonRating ?? sp?.rating;
          return (
            <button
              key={p.id}
              onClick={() => go(playerHash(m.league, m.id, p.id, p.fmId))}
              className={`flex shrink-0 items-center gap-2 rounded-md px-1 text-left hover:bg-terrace ${horizontal ? "min-w-0 bg-night/40 py-0.5" : "w-full"} ${side === "away" && !horizontal ? "flex-row-reverse text-right" : ""} ${m.state !== "pre" && !played && !showSeason ? "opacity-55" : ""}`}
              style={horizontal ? undefined : { height: ROWH }}
              data-tip={playerTip(p, l, m, sp)}
              data-tip-title={`${p.jersey ? `#${p.jersey} ` : ""}${p.name}`}
            >
              <PlayerDisc p={p} kit={kit} size={31} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-ui text-[14.5px] font-semibold">{lastName(p.short)}</span>
                <span className="block truncate font-ui text-[12.5px] text-mute tnum">
                  {played ? <span className="text-win">▲ {p.marks.subIn}{p.replaces ? ` for ${lastName([...l.starters].find((s) => s.id === p.replaces)?.short ?? "")}` : ""}</span> : seasonLine(sp) ?? sp?.position ?? p.role}
                  {p.marks.goals.length > 0 && " ⚽"}
                  {p.marks.yellow && <CardIcon red={!!p.marks.red} className="ml-1 !h-[9px] !w-[6px] align-[-1px]" />}
                </span>
              </span>
              {rating != null && (live ? played : true) && <span className="shrink-0"><RatingChip value={rating} /></span>}
            </button>
          );
        })}
        {rest.length > 0 && (
          <div className={`font-ui text-[13.5px] text-mute ${side === "away" && !horizontal ? "text-right" : ""}`} data-tip={rest.map((r) => r.name).join("\n")} style={{ height: horizontal ? 30 : ROWH, lineHeight: `${horizontal ? 30 : ROWH}px` }}>
            +{rest.length} more
          </div>
        )}
      </div>
    </div>
  );
}

function RatingChip({ value }: { value: number }) {
  return <span className="rounded px-[3px] font-ui text-[12px] font-bold leading-[16px] text-[#0d1216] tnum" style={{ background: ratingColor(value) }}>{value.toFixed(1)}</span>;
}

function ShotDot({ s, m, vertical }: { s: Shot; m: MatchDetail; vertical: boolean }) {
  // Shots come normalised toward the opponent goal; home attacks right/up.
  const fx = s.x / 100;
  const fy = s.y / 100;
  const pos = !vertical
    ? s.side === "home" ? { left: fx * 100, top: fy * 100 } : { left: (1 - fx) * 100, top: (1 - fy) * 100 }
    : s.side === "home" ? { left: fy * 100, top: (1 - fx) * 100 } : { left: (1 - fy) * 100, top: fx * 100 };
  const color = accent(m[s.side].color, m[s.side].altColor);
  const d = 8 + Math.sqrt(s.xg ?? 0.06) * 26;
  const filled = s.outcome === "goal" || s.outcome === "on";
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        ...{ left: `${pos.left}%`, top: `${pos.top}%`, width: d, height: d },
        background: s.outcome === "goal" ? "#fff" : filled ? color : "transparent",
        border: `2px solid ${s.outcome === "goal" ? color : color}`,
        opacity: s.outcome === "blocked" ? 0.55 : 0.92,
        boxShadow: s.outcome === "goal" ? `0 0 0 3px ${color}55` : undefined,
      }}
      data-tip={`${s.minute} ${s.player ?? ""}\n${{ goal: "Goal", on: "On target (saved)", off: "Off target", blocked: "Blocked" }[s.outcome]}${s.xg != null ? ` · ${s.xg.toFixed(2)} xG` : ""}${s.text && s.text.length < 60 ? `\n${s.text}` : ""}`}
    />
  );
}

export type PitchMode = "lineups" | "shots" | "bench";

export function Pitch({ m, mode, showSeason, squad, dugouts = true }: { m: MatchDetail; mode: PitchMode; showSeason: boolean; squad: SquadIndex; dugouts?: boolean }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const vertical = w > 0 && w / Math.max(h, 1) < 1.05;
  const hasBench = dugouts && m.lineups.home.bench.length + m.lineups.away.bench.length > 0;
  // Dugouts sit beside the pitch when there's room (wide screens), otherwise in a strip underneath.
  const dug = Math.round(Math.min(210, Math.max(160, w * 0.16)));
  // The drawing may stretch ~10% off the real 105x68 so the players get the room that's there.
  const fitPitch = (bw: number, bh: number) => {
    const [lo, hi] = vertical ? [68 / 105 / 1.1, (68 / 105) * 1.1] : [105 / 68 / 1.1, (105 / 68) * 1.1];
    const ph = Math.min(bh, bw / lo);
    const pw = Math.min(bw, ph * hi);
    return { pw, ph };
  };
  // Side dugouts show the whole bench; take them unless they'd shrink the pitch noticeably vs a strip underneath.
  const STRIP = 104; // two rows of bench chips under the pitch
  const side = hasBench && !vertical && fitPitch(w - 2 * dug - 16, h).ph >= fitPitch(w, h - STRIP).ph * 0.86;
  const strip = hasBench && !side;
  const stripH = strip ? (vertical ? 0 : STRIP) : 0;
  const { pw, ph } = side ? fitPitch(w - 2 * dug - 16, h) : fitPitch(w, h - stripH - (strip && !vertical ? 6 : 0));
  // Faces as big as the pitch allows, but a back five plus names must still fit across it.
  const across = vertical ? pw : ph;
  const along = vertical ? ph : pw;
  const compact = across / 5.3 - NAME_PX - LINE_PX - 14 < 34;
  const size = Math.round(Math.max(28, Math.min(60, across / 7.1, along / 10.8, across / 5.3 - NAME_PX - (compact ? 0 : LINE_PX) - 14)));
  const hasXI = (s: Side) => m.lineups[s].starters.length >= 11 && m.lineups[s].starters.every((p) => p.x != null);
  const xi = (["home", "away"] as Side[]).filter(hasXI);
  const placed = useMemo(
    () => (mode === "lineups" && pw > 0 ? placeCounters(m, xi, vertical, pw, ph, size, showSeason, compact, squad) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, xi.join(), vertical, pw, ph, size, showSeason, compact, squad, mode],
  );

  const pitch = (
    <div className="turf relative shrink-0 overflow-hidden rounded-lg ring-1 ring-black/40" style={{ width: pw, height: ph, ["--stripe-dir" as string]: vertical ? "180deg" : "90deg" }}>
      <Markings vertical={vertical} />
      {mode === "lineups" && (
        <>
          {placed.map((c) => <Counter key={c.key} p={c.p} side={c.side} m={m} at={c} size={size} showSeason={showSeason} compact={compact} sp={squad[c.side].get(c.p.id)} />)}
          {(["home", "away"] as Side[]).filter((s) => !hasXI(s)).map((s) => <NoLineup key={s} side={s} vertical={vertical} />)}
        </>
      )}
      {mode === "shots" && (
        <>
          {m.shots.map((s, i) => <ShotDot key={i} s={s} m={m} vertical={vertical} />)}
          {!m.shots.length && <div className="absolute inset-0 grid place-items-center font-ui text-[17px] text-chalk/70">No shots yet</div>}
        </>
      )}
    </div>
  );

  if (mode === "bench") {
    return (
      <div ref={ref} className="grid h-full min-h-0 w-full grid-cols-2 gap-3 py-1">
        <Dugout m={m} side="home" squad={squad} showSeason={showSeason} />
        <Dugout m={m} side="away" squad={squad} showSeason={showSeason} />
      </div>
    );
  }

  return (
    <div ref={ref} className="relative h-full min-h-0 w-full">
      {w > 0 && side && (
        <div className="grid h-full items-center gap-2" style={{ gridTemplateColumns: `${dug}px minmax(0,1fr) ${dug}px` }}>
          <div className="h-full min-h-0 py-1"><Dugout m={m} side="home" squad={squad} showSeason={showSeason} /></div>
          <div className="grid place-items-center">{pitch}</div>
          <div className="h-full min-h-0 py-1"><Dugout m={m} side="away" squad={squad} showSeason={showSeason} /></div>
        </div>
      )}
      {w > 0 && !side && (
        <div className="flex h-full flex-col items-center gap-1.5">
          <div className="grid min-h-0 w-full flex-1 place-items-center">{pitch}</div>
          {strip && !vertical && (
            <div className="grid w-full shrink-0 grid-cols-2 gap-3">
              <Dugout m={m} side="home" squad={squad} showSeason={showSeason} horizontal />
              <Dugout m={m} side="away" squad={squad} showSeason={showSeason} horizontal />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoLineup({ side, vertical }: { side: Side; vertical: boolean }) {
  const pos = !vertical ? { left: side === "home" ? "25%" : "75%", top: "50%" } : { left: "50%", top: side === "home" ? "75%" : "25%" };
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/35 px-3 py-2 text-center font-ui text-[14.5px] text-chalk/80" style={pos}>
      Lineup not known yet
    </div>
  );
}

/** Pressure by minute as a mirrored bar strip, with goals marked. Home above the line, away below. */
export function Momentum({ m, height = 46 }: { m: MatchDetail; height?: number }) {
  const data = m.momentum;
  if (!data.length) return null;
  const maxMin = Math.max(90, data[data.length - 1].minute);
  const hc = accent(m.home.color, m.home.altColor);
  const ac = accent(m.away.color, m.away.altColor);
  const mid = height / 2;
  const goals = m.events.filter((e) => e.type === "goal" || e.type === "pen-goal" || e.type === "own-goal");
  const reds = m.events.filter((e) => e.type === "red" || e.type === "second-yellow");
  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${maxMin} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-label="Momentum">
        <line x1={0} x2={maxMin} y1={mid} y2={mid} stroke="rgba(236,238,234,.18)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        <line x1={45} x2={45} y1={0} y2={height} stroke="rgba(236,238,234,.14)" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        {data.map((d) => {
          const v = (d.value / 10) * (mid - 2);
          return <rect key={d.minute} x={d.minute + 0.12} width={0.76} y={v > 0 ? mid - v : mid} height={Math.abs(v)} fill={v > 0 ? hc : ac} opacity={0.85} />;
        })}
      </svg>
      {goals.map((g, i) => (
        <span
          key={i}
          className="absolute -translate-x-1/2"
          style={{ left: `${(minuteNum(g.minute) / maxMin) * 100}%`, top: g.side === "home" ? 0 : undefined, bottom: g.side === "away" ? 0 : undefined }}
          data-tip={`${g.minute} ${g.player ?? ""} (${g.score})`}
        >
          <Ball className="size-3 drop-shadow" />
        </span>
      ))}
      {reds.map((r, i) => (
        <span key={`r${i}`} className="absolute -translate-x-1/2" style={{ left: `${(minuteNum(r.minute) / maxMin) * 100}%`, top: r.side === "home" ? 2 : undefined, bottom: r.side === "away" ? 2 : undefined }} data-tip={`${r.minute} red card: ${r.player}`}>
          <CardIcon red />
        </span>
      ))}
    </div>
  );
}
