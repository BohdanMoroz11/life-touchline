import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Absentee, FixtureRow, LineupPlayer, MatchDetail, Side, SquadPlayer, TeamDetail } from "../../../shared/types";
import { accent, euros, go, kickoff, ordinal, playerHash, relDays, resultColor, samePerson, shortDate, tenure, tint, useSize, yearsUntil } from "../lib";
import { tip } from "../glossary";
import { Crest, FormPills, Kit, Modal, Photo, RankNote, Rating, Term } from "./ui";
import { CardIcon, kitOf } from "./Pitch";
import { CoachModal } from "./CoachModal";
import { ClubModal } from "./ClubModal";

export type NumbersMode = "match" | "season";

export function ClubPanel({ m, side, team, mode }: { m: MatchDetail; side: Side; team?: TeamDetail; mode: NumbersMode }) {
  const [coachOpen, setCoachOpen] = useState(false);
  const [clubOpen, setClubOpen] = useState(false);
  const [squadOpen, setSquadOpen] = useState(false);
  const ref = m[side];
  const color = accent(ref.color, ref.altColor);
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-stand ring-1 ring-rule @container" style={{ ["--team" as string]: color }}>
      <ClubHeader m={m} side={side} team={team} onClub={() => setClubOpen(true)} />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-3 pb-3 pt-2.5">
        <div className="grid shrink-0 gap-2.5 @lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <CoachCard m={m} side={side} team={team} onOpen={() => setCoachOpen(true)} />
          <LoadCard team={team} />
        </div>
        <FitStack>
          {team && team.profile.length > 0 && <Profile team={team} />}
          <Missing m={m} side={side} team={team} />
          {team && <Leaders m={m} side={side} team={team} />}
          {team && <Results team={team} />}
          {team && team.fixtures.length > 1 && <Upcoming team={team} m={m} />}
        </FitStack>
        <button onClick={() => setSquadOpen(true)} disabled={!team} className="shrink-0 rounded-lg py-1.5 font-ui text-[14.5px] font-semibold text-chalk/85 ring-1 ring-rule hover:bg-terrace disabled:opacity-40">
          Full squad{team ? ` · ${team.squad.length} players` : ""}
        </button>
      </div>
      {squadOpen && <SquadModal m={m} side={side} team={team} mode={mode} onClose={() => setSquadOpen(false)} />}
      {coachOpen && team?.coach && <CoachModal team={team} shape={m.shape?.[side]} onClose={() => setCoachOpen(false)} />}
      {clubOpen && team && <ClubModal team={team} m={m} onClose={() => setClubOpen(false)} />}
    </section>
  );
}

function ClubHeader({ m, side, team, onClub }: { m: MatchDetail; side: Side; team?: TeamDetail; onClub: () => void }) {
  const ref = m[side];
  const st = team?.standing;
  const results = team?.results.slice(0, 5).reverse() ?? [];
  return (
    <header className="relative shrink-0 overflow-hidden border-b border-rule px-3 py-2.5">
      {/* A wash of the club color from the crest side: identity without decoration. */}
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `linear-gradient(100deg, ${tint(ref.color)} 0%, transparent 65%)` }} />
      <div className="relative flex items-center gap-3">
        <Crest src={ref.logo} className="size-11 drop-shadow" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="truncate font-display text-[28.5px] font-extrabold leading-none tracking-tight">{ref.name}</h2>
            <span className="font-ui text-xs text-mute">{side === "home" ? "Home" : "Away"}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-[14.5px] text-chalk/80">
            {st ? (
              <span className="tnum" data-tip={`${st.w} wins, ${st.d} draws, ${st.l} losses · goals ${st.gf}-${st.ga}${st.zone ? `\nZone: ${st.zone.label}` : ""}`}>
                <b className="font-semibold text-chalk">{ordinal(st.rank)}</b>{team!.league !== m.league && <span className="text-mute"> in {team!.leagueName}</span>} · {st.pts} pts · {st.w}-{st.d}-{st.l}
                {st.zone && <span className="ml-1.5 inline-block size-2 rounded-full align-middle" style={{ background: st.zone.color }} />}
              </span>
            ) : (
              ref.record && <span className="tnum">{ref.record}</span>
            )}
            {results.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Term k="form" className="text-mute">Form</Term>
                <FormPills results={results} size="sm" />
              </span>
            )}
          </div>
        </div>
        <button onClick={onClub} disabled={!team} className="shrink-0 rounded-lg px-2.5 py-1 font-ui text-[14.5px] font-semibold text-chalk/90 ring-1 ring-rule hover:bg-terrace disabled:opacity-40">
          Club
        </button>
      </div>
    </header>
  );
}

function CoachCard({ m, side, team, onOpen }: { m: MatchDetail; side: Side; team?: TeamDetail; onOpen: () => void }) {
  const c = team?.coach;
  const fallback = m.lineups[side].coach;
  const name = c?.name ?? fallback?.name;
  if (!name) return <div className="rounded-lg bg-terrace/50 p-2.5 font-ui text-xs text-mute">Coach unknown</div>;
  const t = tenure(c?.appointed);
  const r = c?.record;
  return (
    <button onClick={onOpen} disabled={!c} className="flex min-w-0 items-center gap-2.5 rounded-lg bg-terrace/60 p-2 text-left ring-1 ring-transparent transition-colors hover:ring-rule disabled:cursor-default">
      <Photo src={c?.photo ?? fallback?.photo} name={name} className="size-11" ring="var(--team)" />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate font-ui text-[16.5px] font-bold">{name}</div>
        <div className="truncate font-ui text-xs text-mute">
          {[c?.nationality ?? fallback?.country, (c?.age ?? fallback?.age) ? `${c?.age ?? fallback?.age}` : undefined].filter(Boolean).join(", ")}
          {t && <> · <span {...tip("tenure")}>since {t.since}</span></>}
        </div>
        {r && (
          <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap font-ui text-xs tnum text-chalk/85">
            <span className="text-win">{r.w}W</span>
            <span className="text-draw">{r.d}D</span>
            <span className="text-loss">{r.l}L</span>
            {r.ppg != null && (
              <span className="text-mute" {...tip("ppg")}>
                · {r.ppg.toFixed(2)} ppg
              </span>
            )}
            {(m.shape?.[side]?.usual ?? c?.formation) && <span className="ml-auto rounded bg-night/60 px-1 text-[12px] text-chalk/80" data-tip="Most used shape in recent matches">{m.shape?.[side]?.usual ?? c?.formation}</span>}
          </div>
        )}
      </div>
    </button>
  );
}

function LoadCard({ team }: { team?: TeamDetail }) {
  if (!team) return <div className="h-[60px] animate-pulse rounded-lg bg-terrace/40" />;
  const { last, next, daysRest, daysToNext, last30 } = team.load;
  const tired = daysRest != null && daysRest < 4;
  return (
    <div className="min-w-0 rounded-lg bg-terrace/60 p-2 font-ui text-xs leading-snug" {...tip("load", `${last30} matches in the last 30 days.`)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-mute">Rest</span>
        <span className={`font-semibold tnum ${tired ? "text-yellow" : "text-chalk"}`}>{daysRest != null ? relDays(daysRest) : "–"}</span>
      </div>
      {last && (
        <div className="truncate text-chalk/75">
          {last.result && <span className="font-semibold" style={{ color: last.result === "W" ? "var(--color-win)" : last.result === "L" ? "var(--color-loss)" : "var(--color-draw)" }}>{last.result} {last.score}</span>} {last.home ? "vs" : "at"} {last.opponent.name}
          <span className="text-mute"> · {last.comp}</span>
        </div>
      )}
      {next && (
        <div className="mt-0.5 truncate text-chalk/75">
          <span className="text-mute">Next</span> {next.home ? "vs" : "at"} {next.opponent.name}
          <span className="text-mute"> · {next.comp} in {relDays(daysToNext)}</span>
        </div>
      )}
    </div>
  );
}

const SHORT: Record<string, string> = { xg: "xG for", xga: "xG against", gpm: "Scored / game", gcpm: "Conceded / game", poss: "Possession", cs: "Clean sheets", bc: "Big chances", sotpm: "On target / game" };

function Profile({ team }: { team: TeamDetail }) {
  const order = ["xg", "xga", "gpm", "gcpm", "poss", "cs", "bc", "sotpm"];
  const items = order.map((k) => team.profile.find((p) => p.key === k)).filter((p): p is NonNullable<typeof p> => !!p);
  const tipKey: Record<string, string> = { xg: "xg", xga: "xga", poss: "possession", cs: "cleanSheets", bc: "bigChances" };
  return (
    <div className="grid shrink-0 grid-cols-4 gap-x-2 gap-y-1.5 @lg:grid-cols-8">
      {items.map((p) => (
        <div key={p.key} className="min-w-0 rounded-md bg-night/40 px-1.5 py-1" {...(tipKey[p.key] ? tip(tipKey[p.key], `League season so far. Rank ${p.rank ?? "–"} of ${team.leagueSize ?? 20}.`) : { "data-tip": `${p.label}, league season so far. Rank ${p.rank ?? "–"} of ${team.leagueSize ?? 20}.` })}>
          <div className="truncate font-ui text-[11.5px] text-mute">{SHORT[p.key] ?? p.label}</div>
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-display text-lg font-bold leading-none tnum">{p.display}</span>
            <RankNote rank={p.rank} of={team.leagueSize ?? 20} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- squad list ----------

type Row =
  | { kind: "head"; label: string; aside?: string }
  | { kind: "player"; lp?: LineupPlayer; sp?: SquadPlayer; out?: Absentee; group: "xi" | "bench" | "out" | "squad" }
  | { kind: "more"; count: number; label: string };

const ROW = 42;

function squadRows(m: MatchDetail, side: Side, team?: TeamDetail): Row[] {
  const lineup = m.lineups[side];
  const byId = new Map(team?.squad.map((p) => [p.id, p]) ?? []);
  const xi = lineup.starters.map((lp) => ({ lp, sp: byId.get(lp.id) }));
  // Subs who came on go first on the bench.
  const bench = [...lineup.bench].sort((a, b) => Number(!!b.marks.subIn) - Number(!!a.marks.subIn)).map((lp) => ({ lp, sp: byId.get(lp.id) }));
  const out = lineup.unavailable.map((u) => ({ out: u, sp: team?.squad.find((s) => samePerson(s.name, u.name)) }));
  const used = new Set([...lineup.starters, ...lineup.bench].map((p) => p.id));
  const rest = (team?.squad ?? []).filter((p) => !used.has(p.id) && !lineup.unavailable.some((u) => samePerson(u.name, p.name))).map((sp) => ({ sp }));
  const rows: Row[] = [];
  const add = (label: string, list: { lp?: LineupPlayer; sp?: SquadPlayer; out?: Absentee }[], group: "xi" | "bench" | "out" | "squad", aside?: string) => {
    if (!list.length) return;
    rows.push({ kind: "head", label, aside });
    for (const r of list) rows.push({ kind: "player", ...r, group });
  };
  if (xi.length >= 11) {
    add(lineup.status === "official" ? "Starting XI" : "Probable XI", xi, "xi", lineup.formation);
    add(lineup.status === "official" ? "Bench" : "Next in line", bench, "bench");
    add("Unavailable", out, "out");
    add(lineup.status === "official" ? "Not in the squad" : "Rest of the squad", rest, "squad");
  } else {
    add("Unavailable", out, "out");
    add("Squad by importance", rest, "squad");
  }
  return rows;
}

function SquadModal({ m, side, team, mode, onClose }: { m: MatchDetail; side: Side; team?: TeamDetail; mode: NumbersMode; onClose: () => void }) {
  const kit = kitOf(m, side);
  const rows = squadRows(m, side, team);
  return (
    <Modal label="Full squad" onClose={onClose} className="sm:w-[min(820px,96vw)]">
      <div className="scroll-thin min-h-0 overflow-auto p-4 pt-12 @container" style={{ ["--team" as string]: accent(m[side].color, m[side].altColor) }}>
        <h3 className="mb-2 flex items-center gap-2 font-display text-3xl font-extrabold"><Crest src={m[side].logo} className="size-7" />{m[side].name} squad</h3>
        <SquadHeader mode={mode} m={m} />
        {rows.map((r, i) =>
          r.kind === "head" ? (
            <div key={i} className="mt-3 flex justify-between border-b border-rule/60 pb-0.5 font-ui text-xs font-semibold text-mute">
              <span {...(r.label.startsWith("Probable") ? tip("probable", m.lineups[side].basis) : {})}>{r.label}</span>
              {r.aside && <span className="font-normal">{r.aside}</span>}
            </div>
          ) : r.kind === "player" ? (
            <PlayerRow key={i} r={r} m={m} side={side} kit={kit} mode={mode} />
          ) : null,
        )}
      </div>
    </Modal>
  );
}

/** Stacks sections in priority order and drops whole sections that don't fit, so nothing is cut in half. */
function FitStack({ children }: { children: ReactNode }) {
  const [ref, { h }] = useSize<HTMLDivElement>();
  const items = Children.toArray(children).filter(Boolean);
  const [heights, setHeights] = useState<number[]>([]);
  const measure = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    const hs = [...el.children].map((c) => (c as HTMLElement).offsetHeight);
    if (hs.join() !== heights.join()) setHeights(hs);
  });
  let used = 0;
  const show = items.map((_, i) => {
    const need = (heights[i] ?? 0) + (i ? 10 : 0);
    if (used + need > h) return false;
    used += need;
    return true;
  });
  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-hidden">
      {/* Invisible copy at natural height, for measuring. */}
      <div ref={measure} aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0">
        {items.map((c, i) => <div key={i}>{c}</div>)}
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((c, i) => (show[i] ? <div key={i}>{c}</div> : null))}
      </div>
    </div>
  );
}

function Leaders({ m, side, team }: { m: MatchDetail; side: Side; team: TeamDetail }) {
  const sq = team.squad;
  if (!sq.length) return null;
  const maxApps = Math.max(1, ...sq.map((p) => p.apps));
  const top = <K extends keyof SquadPlayer>(k: K, min = 1, filter: (p: SquadPlayer) => boolean = () => true) =>
    [...sq].filter((p) => filter(p) && Number(p[k] ?? 0) >= min).sort((a, b) => Number(b[k] ?? 0) - Number(a[k] ?? 0))[0];
  const cards = [
    { label: "Top scorer", p: top("goals"), v: (p: SquadPlayer) => String(p.goals), unit: "goals" },
    { label: "Most assists", p: top("assists"), v: (p: SquadPlayer) => String(p.assists), unit: "assists" },
    { label: "Best rated", p: top("rating", 0.1, (p) => p.apps >= maxApps * 0.4), v: (p: SquadPlayer) => p.rating!.toFixed(2), unit: "avg rating" },
    { label: "Most valuable", p: top("marketValue", 1), v: (p: SquadPlayer) => euros(p.marketValue)!, unit: "value" },
  ].filter((c) => c.p);
  const lp = (id: string) => [...m.lineups[side].starters, ...m.lineups[side].bench].find((x) => x.id === id);
  return (
    <section>
      <div className="mb-1.5 font-ui text-[13px] font-semibold text-mute">This season · {team.leagueName}</div>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <button key={c.label} onClick={() => go(playerHash(m.league, m.id, c.p!.id, lp(c.p!.id)?.fmId))} className="flex min-w-0 items-center gap-2.5 rounded-lg bg-terrace/50 p-2 text-left hover:bg-terrace" {...(c.label === "Best rated" ? tip("seasonRating") : c.label === "Most valuable" ? tip("marketValue") : {})}>
            <Photo src={c.p!.photo} name={c.p!.name} className="size-11" ring="var(--team)" />
            <div className="min-w-0 leading-tight">
              <div className="font-ui text-[12px] text-mute">{c.label}</div>
              <div className="truncate font-ui text-[15px] font-bold">{c.p!.short}</div>
              <div className="font-display text-xl font-extrabold leading-none tnum">{c.v(c.p!)} <span className="font-ui text-[12px] font-normal text-mute">{c.unit}</span></div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

const MAX_MISSING = 4;

function Missing({ m, side, team }: { m: MatchDetail; side: Side; team?: TeamDetail }) {
  const list = m.lineups[side].unavailable;
  // FotMob's match list when we have it; otherwise injuries flagged on the squad.
  const items = list.length
    ? list.map((u) => ({ name: u.name, photo: u.photo, status: u.status, reason: u.reason, returns: u.returns, pos: team?.squad.find((s) => samePerson(s.name, u.name))?.position, id: team?.squad.find((s) => samePerson(s.name, u.name))?.id, fm: u.fmId, value: u.marketValue }))
    : (team?.squad ?? []).filter((p) => p.injury).map((p) => ({ name: p.name, photo: p.photo, status: p.injury!.status, reason: p.injury!.reason, returns: p.injury!.returns, pos: p.position, id: p.id, fm: undefined, value: p.marketValue }));
  const sorted = [...items].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <section>
      <div className="mb-1.5 flex justify-between font-ui text-[13px] font-semibold text-mute">
        <span>Missing</span>
        {items.length > 0 && <span className="font-normal">{items.length}</span>}
      </div>
      {items.length ? (
        <ul className="space-y-1">
          {sorted.slice(0, MAX_MISSING).map((u) => (
            <li key={u.name}>
              <button onClick={() => (u.id || u.fm) && go(playerHash(m.league, m.id, u.id ?? `fm${u.fm}`, u.fm))} className="flex w-full items-center gap-2.5 rounded-md px-1 py-0.5 text-left hover:bg-terrace/70">
                <Photo src={u.photo} name={u.name} className="size-8" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate font-ui text-[14.5px] font-semibold">{u.name}</span>
                  <span className="block truncate font-ui text-[12px] text-mute">{[u.pos, u.reason, u.returns && `back: ${u.returns}`].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={`shrink-0 rounded px-1.5 font-ui text-[11.5px] font-semibold leading-[16px] ${u.status === "doubt" ? "bg-yellow/15 text-yellow" : "bg-red/15 text-red"}`}>
                  {u.status === "suspended" ? "Suspended" : u.status === "doubt" ? "Doubtful" : "Out"}
                </span>
              </button>
            </li>
          ))}
          {sorted.length > MAX_MISSING && (
            <li className="px-1 font-ui text-[13px] text-mute" data-tip={sorted.slice(MAX_MISSING).map((u) => `${u.name}${u.returns ? ` (back: ${u.returns})` : ""}`).join("\n")}>
              +{sorted.length - MAX_MISSING} more
            </li>
          )}
        </ul>
      ) : (
        <p className="font-ui text-[14.5px] text-chalk/70">No injuries or suspensions reported.</p>
      )}
    </section>
  );
}

function FixtureLine({ r, upcoming }: { r: FixtureRow; upcoming?: boolean }) {
  return (
    <li className="grid grid-cols-[46px_44px_minmax(0,1fr)_auto] items-center gap-2 font-ui text-[14px]">
      <span className="text-mute tnum">{shortDate(r.date)}</span>
      <span className="truncate text-faint">{r.comp}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="text-faint">{r.home ? "vs" : "at"}</span>
        <Crest src={r.opponent.logo} className="size-4" />
        <span className="truncate">{r.opponent.name}</span>
      </span>
      {upcoming ? <span className="text-mute tnum">{kickoff(r.date)}</span> : <span className="rounded px-1.5 font-bold tnum text-[#0d1216]" style={{ background: resultColor(r.result) }}>{r.score}</span>}
    </li>
  );
}

function Results({ team }: { team: TeamDetail }) {
  return (
    <section>
      <div className="mb-1 font-ui text-[13px] font-semibold text-mute">Recent results</div>
      <ul className="space-y-1">{team.results.slice(0, 5).map((r) => <FixtureLine key={r.id} r={r} />)}</ul>
    </section>
  );
}

function Upcoming({ team, m }: { team: TeamDetail; m: MatchDetail }) {
  const next = team.fixtures.filter((f) => f.id !== m.id).slice(0, 3);
  if (!next.length) return null;
  return (
    <section>
      <div className="mb-1 font-ui text-[13px] font-semibold text-mute">After this</div>
      <ul className="space-y-1">{next.map((r) => <FixtureLine key={r.id} r={r} upcoming />)}</ul>
    </section>
  );
}

// Columns appear as the panel widens (container queries), like a broadcast graphic that grows.
const COLS = "grid grid-cols-[22px_36px_minmax(0,1fr)_34px_30px_30px] @sm:grid-cols-[22px_36px_minmax(0,1fr)_34px_30px_30px_38px] @md:grid-cols-[22px_36px_minmax(0,1fr)_34px_30px_30px_38px_52px] @lg:grid-cols-[22px_36px_minmax(0,1fr)_34px_30px_30px_38px_52px_44px] items-center gap-x-2";

function SquadHeader({ mode, m }: { mode: NumbersMode; m: MatchDetail }) {
  const live = mode === "match" && m.state !== "pre";
  return (
    <div className={`${COLS} shrink-0 pb-0.5 font-ui text-[11.5px] text-faint`}>
      <span />
      <span />
      <span />
      <span className="text-center" {...tip(live ? "rating" : "seasonRating")}>{live ? "Rtg" : "Avg"}</span>
      <span className="text-right" data-tip={live ? "Goals in this match" : "League goals this season"}>G</span>
      <span className="text-right" data-tip={live ? "Assists in this match" : "League assists this season"}>A</span>
      <span className="hidden text-right @sm:block" data-tip={live ? "Minutes played" : "League starts (and sub appearances) this season"}>{live ? "Min" : "Apps"}</span>
      <span className="hidden text-right @md:block" {...(live ? tip("xg") : tip("marketValue"))}>{live ? "xG" : "Value"}</span>
      <span className="hidden text-right @lg:block" {...(live ? { "data-tip": "Chances created" } : tip("contract"))}>{live ? "KP" : "Until"}</span>
    </div>
  );
}

/** FotMob's minutes when it has them, else from the clock and substitutions (FotMob lags early in a match). */
function minutesPlayed(lp: LineupPlayer, m: MatchDetail) {
  if (lp.fm?.min) return lp.fm.min;
  const now = m.state === "post" ? 90 : Math.floor((m.clockSeconds ?? 0) / 60);
  const num = (x?: string) => (x ? parseInt(x, 10) : undefined);
  const start = lp.starter ? 0 : num(lp.marks.subIn);
  if (start == null) return undefined;
  const end = num(lp.marks.subOut) ?? num(lp.marks.red) ?? now;
  return Math.max(0, end - start) || undefined;
}

function PlayerRow({ r, m, side, kit, mode }: { r: Extract<Row, { kind: "player" }>; m: MatchDetail; side: Side; kit: { color: string; alt?: string }; mode: NumbersMode }) {
  const { lp, sp, out } = r;
  const name = lp?.name ?? sp?.name ?? out?.name ?? "";
  const jersey = lp?.jersey ?? sp?.jersey;
  const photo = lp?.photo ?? sp?.photo ?? out?.photo;
  const id = lp?.id ?? sp?.id;
  const fm = lp?.fmId ?? out?.fmId;
  const live = mode === "match" && m.state !== "pre";
  const injury = out ?? (sp?.injury && r.group !== "xi" ? { status: sp.injury.status, reason: sp.injury.reason, returns: sp.injury.returns } : undefined);
  const marks = lp?.marks;
  const didNotPlay = live && r.group === "bench" && !marks?.subIn;
  const role = lp?.role ?? sp?.role ?? out?.role;
  const posLabel = sp?.position ?? lp?.pos ?? role;
  const rating = live ? lp?.rating : lp?.seasonRating ?? sp?.rating ?? out?.seasonRating;
  const cells = live
    ? [marks ? marks.goals.length || "" : "", marks ? marks.assists.length || "" : "", lp ? minutesPlayed(lp, m) ?? "" : "", lp?.fm?.xg != null ? lp.fm.xg.toFixed(2) : "", lp?.fm?.chances ?? ""]
    : [sp?.goals || (sp ? "" : ""), sp?.assists || "", sp ? `${sp.starts}${sp.apps > sp.starts ? `(${sp.apps - sp.starts})` : ""}` : "", euros(sp?.marketValue ?? lp?.marketValue ?? out?.marketValue) ?? "", yearsUntil(sp?.contractUntil) ?? ""];
  const open = () => id && go(playerHash(m.league, m.id, id, fm));
  return (
    <button
      onClick={open}
      disabled={!id && !fm}
      className={`${COLS} w-full rounded text-left hover:bg-terrace/70 ${didNotPlay || r.group === "out" ? "opacity-60" : ""}`}
      style={{ height: ROW }}
      data-tip={[
        posLabel,
        sp?.age ? `${sp.age} yrs${sp.nationality ? `, ${sp.nationality}` : ""}` : undefined,
        injury ? `${injury.reason ?? "Unavailable"}${injury.returns ? ` · back: ${injury.returns}` : ""}` : undefined,
        sp?.recentStarts != null ? `Started ${sp.recentStarts} of the last ${m.state === "pre" ? "few" : "recent"} matches` : undefined,
        lp?.confidence != null && r.group !== "out" ? `Recent starts share: ${Math.round(lp.confidence * 100)}%` : undefined,
      ].filter(Boolean).join("\n")}
      data-tip-title={name}
    >
      <Kit color={kit.color} alt={kit.alt} number={jersey} size={20} className="!text-[11px]" />
      <Photo src={photo} name={name} className="size-9" />
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-ui text-[14.5px] font-semibold leading-none">{name}</span>
        {marks?.goals.map((g) => <span key={g} className="shrink-0 text-[11px]" data-tip={`Goal ${g}`}>⚽</span>)}
        {marks?.yellow && !marks.red && <CardIcon className="shrink-0" />}
        {marks?.red && <CardIcon red className="shrink-0" />}
        {marks?.subIn && <span className="shrink-0 font-ui text-[11.5px] text-win tnum">▲{marks.subIn}</span>}
        {marks?.subOut && <span className="shrink-0 font-ui text-[11.5px] text-red tnum">▼{marks.subOut}</span>}
        {lp?.potm && <span className="shrink-0 text-[12px] text-yellow" {...tip("potm")}>★</span>}
        {injury && (
          <span className={`shrink-0 rounded px-1 font-ui text-[11px] font-semibold leading-[14px] ${injury.status === "doubt" ? "bg-yellow/15 text-yellow" : "bg-red/15 text-red"}`}>
            {injury.status === "suspended" ? "Susp." : injury.status === "doubt" ? "Doubt" : "Out"}
          </span>
        )}
        <span className="hidden truncate font-ui text-[12px] text-faint @md:inline">{posLabel}</span>
      </span>
      <span className="text-center">{rating ? <Rating value={rating} /> : null}</span>
      {cells.map((c, i) => (
        <span key={i} className={`text-right font-ui text-[14px] tnum ${i >= 2 ? (i === 2 ? "hidden @sm:block" : i === 3 ? "hidden @md:block" : "hidden @lg:block") : ""} ${i < 2 && c ? "font-bold" : "text-chalk/75"}`}>
          {c}
        </span>
      ))}
    </button>
  );
}

