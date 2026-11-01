import { useState, type ReactNode } from "react";
import type { MatchDetail, MatchEvent, Side, Table, TableRow, TeamDetail } from "../../../shared/types";
import { accent, euros, kickoff, ordinal, shortDate, tenure, useTable } from "../lib";
import { tip } from "../glossary";
import { Crest, FormPills, Label, Photo, RankNote, Segmented, Term } from "./ui";
import { CardIcon } from "./Pitch";

export type CenterTab = "preview" | "story" | "stats" | "coaches" | "table" | "h2h";

export function centerTabs(m: MatchDetail): { value: CenterTab; label: string }[] {
  return [
    { value: "preview", label: m.state === "pre" ? "Preview" : "Context" },
    ...(m.state !== "pre" ? [{ value: "story" as const, label: "Story" }] : []),
    { value: "stats", label: "Stats" },
    { value: "coaches", label: "Coaches" },
    { value: "table", label: "Table" },
    { value: "h2h", label: "H2H" },
  ];
}

export function TabBody({ tab, m, teams }: { tab: CenterTab; m: MatchDetail; teams: Record<Side, TeamDetail | undefined> }) {
  switch (tab) {
    case "preview":
      return <Preview m={m} teams={teams} />;
    case "story":
      return <Story m={m} />;
    case "stats":
      return <Stats m={m} teams={teams} />;
    case "coaches":
      return <Coaches m={m} teams={teams} />;
    case "table":
      return <LeagueTable m={m} />;
    case "h2h":
      return <H2H m={m} />;
  }
}

const sideColor = (m: MatchDetail, s: Side) => accent(m[s].color, m[s].altColor);

// ---------- preview / context ----------

function stakesFor(rows: TableRow[], teamId: string): string[] {
  const me = rows.find((r) => r.teamId === teamId);
  if (!me || !rows.length) return [];
  const out: string[] = [];
  const leader = rows[0];
  if (me.rank === 1) {
    const second = rows[1];
    out.push(second ? `Top, ${me.pts - second.pts} pt${me.pts - second.pts === 1 ? "" : "s"} clear of ${second.name}` : "Top of the table");
  } else {
    out.push(`${leader.pts - me.pts} pts behind leaders ${leader.name}`);
  }
  // Zones in table order: the first is the prize (Champions League, last 16...), the last is the trap (relegation).
  const zones: { label: string; ranks: number[] }[] = [];
  for (const r of rows) {
    if (!r.zone) continue;
    const z = zones.find((x) => x.label === r.zone!.label);
    if (z) z.ranks.push(r.rank);
    else zones.push({ label: r.zone.label, ranks: [r.rank] });
  }
  const top = zones[0];
  if (top && !/relegat/i.test(top.label)) {
    const cut = Math.max(...top.ranks);
    const cutRow = rows.find((r) => r.rank === cut);
    const nextRow = rows.find((r) => r.rank === cut + 1);
    if (me.rank > cut && cutRow) out.push(`${cutRow.pts - me.pts} pts off the ${top.label} places`);
    else if (me.rank <= cut && nextRow && me.rank > 1) out.push(`${me.pts - nextRow.pts} pts above the ${top.label} cut`);
  }
  const drop = zones.find((z) => /relegat/i.test(z.label));
  if (drop) {
    const first = Math.min(...drop.ranks);
    const safe = rows.find((r) => r.rank === first - 1);
    const firstRow = rows.find((r) => r.rank === first);
    if (me.rank >= first && safe) out.push(`In the drop zone, ${safe.pts - me.pts} pts from safety`);
    else if (firstRow && me.pts - firstRow.pts <= 6) out.push(`Only ${me.pts - firstRow.pts} pts above the drop zone`);
  }
  return out;
}

function Preview({ m, teams }: { m: MatchDetail; teams: Record<Side, TeamDetail | undefined> }) {
  const table = useTable(m.league).data;
  const rows = table?.groups.flatMap((g) => g.rows) ?? [];
  return (
    <div className="grid gap-4 @2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {rows.length > 0 && (
          <section>
            <Label className="mb-1.5"><Term k="stakes">What's at stake</Term></Label>
            <div className="grid gap-2 @md:grid-cols-2">
              {(["home", "away"] as Side[]).map((s) => {
                const r = rows.find((x) => x.teamId === m[s].id);
                return (
                  <div key={s} className="rounded-lg bg-terrace/50 p-2.5" style={{ borderLeft: `3px solid ${sideColor(m, s)}` }}>
                    <div className="flex items-center gap-2 font-ui text-sm font-semibold">
                      <Crest src={m[s].logo} className="size-4" /> {m[s].short}
                      {r && <span className="ml-auto font-display text-xl font-extrabold tnum">{ordinal(r.rank)}<span className="ml-1 font-ui text-xs font-normal text-mute">{r.pts} pts</span></span>}
                    </div>
                    <ul className="mt-1 space-y-0.5 font-ui text-[14.5px] text-chalk/80">
                      {stakesFor(rows, m[s].id).map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {m.insights.length > 0 && (
          <section>
            <Label className="mb-1.5" aside="FotMob">Talking points</Label>
            <ul className="space-y-1.5">
              {m.insights.slice(0, 6).map((i, k) => (
                <li key={k} className="flex items-start gap-2 font-ui text-[15px] leading-snug text-chalk/85">
                  {i.side ? <Crest src={m[i.side].logo} className="mt-0.5 size-4" /> : <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-mute" />}
                  {i.text}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <Label className="mb-1.5" aside="all competitions"><Term k="form">Recent form</Term></Label>
          <div className="space-y-1.5">
            {(["home", "away"] as Side[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <Crest src={m[s].logo} className="size-4" />
                <span className="w-24 truncate font-ui text-[14.5px]">{m[s].short}</span>
                {teams[s] ? <FormPills results={teams[s]!.results.slice(0, 6).reverse()} /> : <span className="text-xs text-mute">…</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="space-y-4">
        <MatchFacts m={m} />
        <Absences m={m} />
      </div>
    </div>
  );
}

function MatchFacts({ m }: { m: MatchDetail }) {
  const o = m.odds;
  const facts: [string, ReactNode, string?][] = [];
  if (m.referee) {
    const r = m.referee;
    facts.push([
      "Referee",
      <span>
        {r.name}
        {r.yellowsPerGame != null && (
          <span className="ml-1.5 inline-flex items-center gap-1 text-mute tnum">
            <CardIcon /> {r.yellowsPerGame.toFixed(1)}/game
            {r.redsPerGame != null && <> · <CardIcon red /> {(r.redsPerGame * 10).toFixed(1)} per 10</>}
            {r.pensPerGame != null && <> · pens {r.pensPerGame.toFixed(2)}/game</>}
          </span>
        )}
      </span>,
      "referee",
    ]);
  }
  if (m.venueInfo) facts.push(["Venue", `${m.venueInfo.name}${m.venueInfo.city ? `, ${m.venueInfo.city}` : ""}${m.venueInfo.capacity ? ` · ${m.venueInfo.capacity.toLocaleString()} seats` : ""}${m.venueInfo.attendance ? ` · ${m.venueInfo.attendance.toLocaleString()} there` : ""}`]);
  if (m.weather) facts.push(["Weather", `${m.weather.tempC}°C, ${m.weather.desc.toLowerCase()}${m.weather.rainPct != null ? ` · ${m.weather.rainPct}% rain` : ""}${m.weather.windKmh != null ? ` · wind ${m.weather.windKmh} km/h` : ""}`]);
  if (m.state === "pre") facts.push(["Kickoff", `${new Date(m.date).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}, ${kickoff(m.date)}`]);
  return (
    <section>
      <Label className="mb-1.5">Match facts</Label>
      {o && (
        <div className="mb-2.5" {...tip("odds", `${o.provider}: ${o.raw?.home} / ${o.raw?.draw} / ${o.raw?.away}`)}>
          <div className="flex h-6 overflow-hidden rounded-md font-ui text-xs font-bold">
            {(
              [
                ["home", o.home, sideColor(m, "home")],
                ["draw", o.draw, "#56616d"],
                ["away", o.away, sideColor(m, "away")],
              ] as const
            ).map(([k, v, c]) => (
              <div key={k} className="grid place-items-center tnum" style={{ width: `${v}%`, background: c, color: "#0d1216" }}>
                {v >= 9 ? `${Math.round(v)}%` : ""}
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between font-ui text-[12px] text-mute">
            <span>{m.home.short} win</span>
            <span>Draw</span>
            <span>{m.away.short} win</span>
          </div>
          {o.overUnder != null && <div className="mt-0.5 font-ui text-[12px] text-mute"><Term k="overUnder">Goals line</Term> {o.overUnder}</div>}
        </div>
      )}
      <dl className="space-y-1">
        {facts.map(([k, v, t]) => (
          <div key={k} className="grid grid-cols-[70px_minmax(0,1fr)] gap-2 font-ui text-[14.5px]">
            <dt className="text-mute">{t ? <Term k={t}>{k}</Term> : k}</dt>
            <dd className="min-w-0 text-chalk/90">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Absences({ m }: { m: MatchDetail }) {
  const any = m.lineups.home.unavailable.length + m.lineups.away.unavailable.length;
  if (!any) return null;
  return (
    <section>
      <Label className="mb-1.5">Missing</Label>
      <div className="grid grid-cols-2 gap-3">
        {(["home", "away"] as Side[]).map((s) => (
          <ul key={s} className="space-y-1">
            {[...m.lineups[s].unavailable]
              .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0))
              .slice(0, 6)
              .map((u) => (
                <li key={u.name} className="flex items-center gap-1.5 font-ui text-[14.5px]" data-tip={`${u.reason ?? "Unavailable"}${u.returns ? `\nExpected back: ${u.returns}` : ""}${u.marketValue ? `\nValue ${euros(u.marketValue)}` : ""}`}>
                  <Photo src={u.photo} name={u.name} className="size-5" />
                  <span className="min-w-0 truncate">{u.name}</span>
                  <span className={`ml-auto shrink-0 rounded px-1 text-[11px] font-semibold ${u.status === "doubt" ? "bg-yellow/15 text-yellow" : "bg-red/15 text-red"}`}>
                    {u.status === "suspended" ? "Susp." : u.status === "doubt" ? "Doubt" : "Out"}
                  </span>
                </li>
              ))}
            {!m.lineups[s].unavailable.length && <li className="font-ui text-xs text-mute">No absences</li>}
          </ul>
        ))}
      </div>
    </section>
  );
}

// ---------- story ----------

const EVENT_LABEL: Partial<Record<MatchEvent["type"], string>> = { goal: "Goal", "pen-goal": "Penalty goal", "own-goal": "Own goal", "pen-miss": "Penalty missed", yellow: "Yellow card", "second-yellow": "Second yellow", red: "Red card", sub: "Substitution", var: "VAR" };

function EventIcon({ e }: { e: MatchEvent }) {
  if (e.type === "goal" || e.type === "pen-goal" || e.type === "own-goal") return <span className={`text-sm ${e.type === "own-goal" ? "opacity-60" : ""}`}>⚽</span>;
  if (e.type === "yellow") return <CardIcon />;
  if (e.type === "red" || e.type === "second-yellow") return <CardIcon red />;
  if (e.type === "sub") return <span className="font-ui text-xs font-bold"><span className="text-win">▲</span><span className="text-red">▼</span></span>;
  if (e.type === "var") return <span className="rounded bg-chalk/15 px-1 font-ui text-[10px] font-bold">VAR</span>;
  return <span className="text-xs">✕</span>;
}

/** Which half a minute like "45'+4'" belongs to; stoppage time stays with its half, extra time joins the second. */
const halfOf = (minute?: string) => ((parseInt(minute ?? "") || 0) <= 45 ? 1 : 2);

// Two columns, first half | second half, so a long match doesn't turn into one long scroll.
function Story({ m }: { m: MatchDetail }) {
  const [view, setView] = useState<"key" | "all">("key");
  const live = m.state === "in";
  const order = <T,>(xs: T[]) => (live ? [...xs].reverse() : xs);
  const evs = m.events.filter((e) => e.type !== "period");
  const extra = m.events.some((e) => (parseInt(e.minute ?? "") || 0) > 90 && !/^90'?\+/.test(e.minute ?? ""));
  const halves = [1, 2].map((h) => ({
    h,
    label: h === 1 ? "First half" : extra ? "Second half & extra time" : "Second half",
    evs: order(evs.filter((e) => halfOf(e.minute) === h)),
    comm: order(m.commentary.filter((c) => halfOf(c.minute) === h)),
  }));
  const started2 = m.events.some((e) => halfOf(e.minute) === 2) || m.commentary.some((c) => halfOf(c.minute) === 2);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Label>{live ? "Newest first" : "How it unfolded"}</Label>
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: "key", label: "Key events" }, { value: "all", label: "Commentary" }]} />
      </div>
      <div className="grid gap-x-5 gap-y-4 @3xl:grid-cols-2">
        {halves.map(({ h, label, evs, comm }) => (
          // Stacked on narrow screens: while live, the half being played goes on top.
          <section key={h} className={`min-w-0 ${live && h === 2 ? "order-first @3xl:order-none" : ""} ${h === 2 ? "@3xl:border-l @3xl:border-rule @3xl:pl-5" : ""}`}>
            <div className="mb-1 text-center font-ui text-[12px] font-semibold text-mute">{label}</div>
            {h === 2 && !started2 ? (
              <p className="py-4 text-center font-ui text-sm text-faint">{m.state === "post" ? "Nothing of note." : "Not started yet."}</p>
            ) : view === "key" ? (
              <KeyEvents evs={evs} />
            ) : (
              <ol className="space-y-1.5">
                {comm.map((c, i) => (
                  <li key={i} className="grid grid-cols-[42px_minmax(0,1fr)] gap-2 font-ui text-[14.5px] leading-snug">
                    <span className="text-right text-mute tnum">{c.minute}</span>
                    <span className={/goal|penalty---scored/.test(c.type ?? "") ? "font-semibold text-chalk" : "text-chalk/80"}>{c.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function KeyEvents({ evs }: { evs: MatchEvent[] }) {
  return (
    <ol className="relative">
      <span className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-rule" />
      {evs.map((e, i) => (
        <li key={i} className={`relative grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-center py-[3px] ${e.type.includes("goal") && e.type !== "pen-miss" ? "my-0.5" : ""}`} data-tip={e.detail}>
          <div className="pr-2 text-right">{e.side === "home" && <EventText e={e} align="right" />}</div>
          <div className="relative z-10 mx-auto flex flex-col items-center">
            <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1 ${e.type.includes("goal") ? "bg-chalk text-night" : "bg-terrace"}`}>
              <EventIcon e={e} />
            </span>
            <span className="font-ui text-[11.5px] text-mute tnum">{e.minute}</span>
          </div>
          <div className="pl-2">{e.side === "away" && <EventText e={e} align="left" />}</div>
        </li>
      ))}
      {!evs.length && <li className="relative py-4 text-center font-ui text-sm text-faint"><span className="bg-stand px-2">Nothing yet.</span></li>}
    </ol>
  );
}

function EventText({ e, align }: { e: MatchEvent; align: "left" | "right" }) {
  const isGoal = e.type === "goal" || e.type === "pen-goal" || e.type === "own-goal";
  return (
    <div className={`min-w-0 leading-tight ${align === "right" ? "text-right" : ""}`}>
      <div className={`truncate font-ui text-[14.5px] ${isGoal ? "font-bold" : "font-semibold"}`}>
        {e.type === "sub" ? <span className="text-win">{e.player}</span> : e.player}
        {isGoal && e.score && <span className="ml-1.5 font-display text-base font-extrabold tnum">{e.score}</span>}
      </div>
      <div className="truncate font-ui text-[12.5px] text-mute">
        {e.type === "sub" ? <>for <span className="text-red/90">{e.other}</span></> : isGoal ? (e.type === "own-goal" ? "Own goal" : e.other ? `Assist ${e.other}` : EVENT_LABEL[e.type]) : EVENT_LABEL[e.type]}
      </div>
    </div>
  );
}

// ---------- stats ----------

function Stats({ m, teams }: { m: MatchDetail; teams: Record<Side, TeamDetail | undefined> }) {
  const [view, setView] = useState<"match" | "season">(m.stats.length ? "match" : "season");
  const hc = sideColor(m, "home");
  const ac = sideColor(m, "away");
  const tipKey: Record<string, string> = { xg: "xg", bigChances: "bigChances", boxTouches: "boxTouches", duels: "duels", possessionPct: "possession", passPct: "passPct" };
  const seasonRows = (teams.home?.profile ?? []).map((p) => ({ p, q: teams.away?.profile.find((x) => x.key === p.key) })).filter((r) => r.q);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-ui text-sm font-semibold">
          <span className="size-2.5 rounded-full" style={{ background: hc }} /> {m.home.short}
        </div>
        {m.stats.length > 0 && <Segmented size="sm" value={view} onChange={setView} options={[{ value: "match", label: "This match" }, { value: "season", label: "Season" }]} />}
        <div className="flex items-center gap-2 font-ui text-sm font-semibold">
          {m.away.short} <span className="size-2.5 rounded-full" style={{ background: ac }} />
        </div>
      </div>
      {view === "match" ? (
        <div className="space-y-1.5">
          {m.stats.map((s) => {
            const total = s.home + s.away || 1;
            return (
              <div key={s.key} {...(tipKey[s.key] ? tip(tipKey[s.key]) : {})}>
                <div className="grid grid-cols-[52px_minmax(0,1fr)_52px] items-baseline font-ui text-[14.5px]">
                  <span className={`tnum ${s.home > s.away ? "font-bold text-chalk" : "text-chalk/70"}`}>{s.display?.[0] ?? s.home}</span>
                  <span className="truncate text-center text-mute">{s.label}</span>
                  <span className={`text-right tnum ${s.away > s.home ? "font-bold text-chalk" : "text-chalk/70"}`}>{s.display?.[1] ?? s.away}</span>
                </div>
                <div className="mt-0.5 flex h-1.5 gap-1">
                  <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-terrace">
                    <div className="h-full rounded-full" style={{ width: `${(s.home / total) * 100}%`, background: hc, opacity: s.home >= s.away ? 1 : 0.5 }} />
                  </div>
                  <div className="flex-1 overflow-hidden rounded-full bg-terrace">
                    <div className="h-full rounded-full" style={{ width: `${(s.away / total) * 100}%`, background: ac, opacity: s.away >= s.home ? 1 : 0.5 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : seasonRows.length ? (
        <div className="space-y-1">
          <div className="text-center font-ui text-[12px] text-faint">League season so far, with league rank</div>
          {seasonRows.map(({ p, q }) => {
            const better = p.key === "xga" || p.key === "gcpm" ? (p.value < q!.value ? "home" : "away") : p.value > q!.value ? "home" : "away";
            return (
              <div key={p.key} className="grid grid-cols-[80px_minmax(0,1fr)_80px] items-center font-ui text-[14.5px]">
                <span className="flex items-baseline gap-1.5">
                  <span className={`tnum ${better === "home" ? "font-bold" : "text-chalk/70"}`}>{p.display}</span>
                  <RankNote rank={p.rank} of={teams.home?.leagueSize} />
                </span>
                <span className="truncate text-center text-mute">{p.label}</span>
                <span className="flex items-baseline justify-end gap-1.5">
                  <RankNote rank={q!.rank} of={teams.away?.leagueSize} />
                  <span className={`tnum ${better === "away" ? "font-bold" : "text-chalk/70"}`}>{q!.display}</span>
                </span>
              </div>
            );
          })}
          {(teams.home?.squadValue || teams.away?.squadValue) && (
            <div className="grid grid-cols-[80px_minmax(0,1fr)_80px] items-center font-ui text-[14.5px]" {...tip("squadValue")}>
              <span className="tnum">{euros(teams.home?.squadValue?.total)}</span>
              <span className="text-center text-mute">Squad value</span>
              <span className="text-right tnum">{euros(teams.away?.squadValue?.total)}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="py-6 text-center font-ui text-sm text-mute">Season numbers aren't available for this competition.</p>
      )}
    </div>
  );
}

// ---------- coaches ----------

function Coaches({ m, teams }: { m: MatchDetail; teams: Record<Side, TeamDetail | undefined> }) {
  const rows = (["home", "away"] as Side[]).map((s) => ({ s, t: teams[s], c: teams[s]?.coach }));
  const trophies = (s: Side) => teams[s]?.coach?.trophies?.reduce((a, t) => a + t.count, 0) ?? 0;
  const career = (s: Side) => (teams[s]?.coach?.previous ?? []).reduce((a, p) => a + (p.games ?? 0), 0) + (teams[s]?.coach?.record?.games ?? 0);
  const duel: [string, (s: Side) => string | number | undefined, string?][] = [
    ["In charge since", (s) => tenure(teams[s]?.coach?.appointed)?.since],
    ["Record here", (s) => { const r = teams[s]?.coach?.record; return r ? `${r.w}-${r.d}-${r.l}` : undefined; }],
    ["Points per game", (s) => teams[s]?.coach?.record?.ppg?.toFixed(2), "ppg"],
    ["Career matches", (s) => career(s) || undefined],
    ["Trophies", (s) => trophies(s)],
    ["Clubs coached", (s) => (teams[s]?.coach?.previous?.length ?? 0) + 1],
    ["Usual shape", (s) => m.shape?.[s]?.usual ?? teams[s]?.coach?.formation, "formation"],
    ["Shape habits", (s) => { const f = m.shape?.[s]?.fluidity; return f ? { fixed: "Settled", variable: "Switches", fluid: "Fluid" }[f] : undefined; }],
    ["Age", (s) => teams[s]?.coach?.age],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {rows.map(({ s, c }) => (
          <div key={s} className={`flex items-center gap-2.5 ${s === "away" ? "flex-row-reverse text-right" : ""}`}>
            <Photo src={c?.photo ?? m.lineups[s].coach?.photo} name={c?.name ?? m.lineups[s].coach?.name ?? "?"} className="size-12" ring={sideColor(m, s)} />
            <div className="min-w-0">
              <div className="truncate font-display text-xl font-extrabold leading-none">{c?.name ?? m.lineups[s].coach?.name ?? "Unknown"}</div>
              <div className="truncate font-ui text-xs text-mute">{c?.nationality ?? m.lineups[s].coach?.country}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        {duel.map(([label, f, k]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] items-baseline border-b border-rule/40 py-1 font-ui text-[14.5px]">
            <span className="font-semibold tnum">{f("home") ?? "–"}</span>
            <span className="text-center text-mute">{k ? <Term k={k}>{label}</Term> : label}</span>
            <span className="text-right font-semibold tnum">{f("away") ?? "–"}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-3 @md:grid-cols-2">
        {rows.map(({ s, c }) => {
          const sh = m.shape?.[s]?.coach;
          return (
            <div key={s} className="space-y-1.5 font-ui text-[14.5px] leading-relaxed" style={{ borderLeft: `2px solid ${sideColor(m, s)}`, paddingLeft: 8 }}>
              {c?.style && <p className="text-chalk/80">{c.style}</p>}
              {sh?.in_possession && <p><span className="text-good">With the ball:</span> <span className="text-chalk/80">{sh.in_possession}</span></p>}
              {sh?.out_of_possession && <p><span className="text-bad">Without it:</span> <span className="text-chalk/80">{sh.out_of_possession}</span></p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- table ----------

function projected(table: Table, m: MatchDetail): Map<string, { pts: number; gd: number; gf: number }> {
  const out = new Map<string, { pts: number; gd: number; gf: number }>();
  if (m.state !== "in") return out;
  const hs = Number(m.home.score ?? 0), as = Number(m.away.score ?? 0);
  for (const g of table.groups) for (const r of g.rows) {
    if (r.teamId === m.home.id) out.set(r.teamId, { pts: r.pts + (hs > as ? 3 : hs === as ? 1 : 0), gd: r.gd + hs - as, gf: r.gf + hs });
    if (r.teamId === m.away.id) out.set(r.teamId, { pts: r.pts + (as > hs ? 3 : hs === as ? 1 : 0), gd: r.gd + as - hs, gf: r.gf + as });
  }
  return out;
}

function LeagueTable({ m }: { m: MatchDetail }) {
  const q = useTable(m.league);
  const t = q.data;
  if (!t) return <p className="py-6 text-center font-ui text-sm text-mute">{q.isLoading ? "Loading the table…" : "No table for this competition."}</p>;
  const proj = projected(t, m);
  const live = proj.size > 0;
  return (
    <div>
      {live && <div className="mb-1.5 font-ui text-[13px] text-mute">Live: if it ends like this. Arrows show the change.</div>}
      {t.groups.map((g, gi) => {
        const rows = live
          ? [...g.rows].map((r) => ({ ...r, ...(proj.get(r.teamId) ?? {}) })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf).map((r, i) => ({ ...r, was: r.rank, rank: i + 1 }))
          : g.rows.map((r) => ({ ...r, was: r.rank }));
        return (
          <div key={gi}>
            {g.name && <div className="mt-2 font-ui text-xs font-semibold text-mute">{g.name}</div>}
            <table className="w-full font-ui text-[14px] tnum">
              <thead>
                <tr className="text-[12px] text-faint">
                  <th className="w-6 text-right font-normal">#</th>
                  <th className="pl-2 text-left font-normal">Club</th>
                  <th className="w-7 text-right font-normal">P</th>
                  <th className="hidden w-7 text-right font-normal @sm:table-cell">W</th>
                  <th className="hidden w-7 text-right font-normal @sm:table-cell">D</th>
                  <th className="hidden w-7 text-right font-normal @sm:table-cell">L</th>
                  <th className="w-9 text-right font-normal">GD</th>
                  <th className="w-8 text-right font-normal">Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const mine = r.teamId === m.home.id ? "home" : r.teamId === m.away.id ? "away" : undefined;
                  return (
                    <tr key={r.teamId} className={mine ? "font-semibold" : "text-chalk/80"} style={mine ? { background: `color-mix(in srgb, ${sideColor(m, mine)} 16%, transparent)` } : undefined}>
                      <td className="relative py-[3px] text-right" data-tip={r.zone?.label}>
                        {r.zone && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full" style={{ background: r.zone.color }} />}
                        {r.rank}
                      </td>
                      <td className="pl-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Crest src={r.logo} className="size-4" />
                          <span className="truncate">{r.name}</span>
                          {live && r.was !== r.rank && <span className={`text-[11px] ${r.rank < r.was ? "text-good" : "text-bad"}`}>{r.rank < r.was ? "▲" : "▼"}{Math.abs(r.was - r.rank)}</span>}
                        </span>
                      </td>
                      <td className="text-right">{r.played + (live && mine ? 1 : 0)}</td>
                      <td className="hidden text-right @sm:table-cell">{r.w}</td>
                      <td className="hidden text-right @sm:table-cell">{r.d}</td>
                      <td className="hidden text-right @sm:table-cell">{r.l}</td>
                      <td className="text-right">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                      <td className="text-right font-bold">{r.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ---------- head to head ----------

function H2H({ m }: { m: MatchDetail }) {
  const all = m.h2hAllTime;
  const games = m.h2h.games;
  const won = (id: string) => games.filter((g) => g.winnerId === id).length;
  const draws = games.filter((g) => !g.winnerId).length;
  return (
    <div className="space-y-4">
      {all && (
        <section {...tip("h2h", "All-time record from FotMob.")}>
          <Label className="mb-1.5" aside={`${all.home + all.draw + all.away} meetings`}>All time</Label>
          <WDL m={m} h={all.home} d={all.draw} a={all.away} />
        </section>
      )}
      {games.length > 0 && (
        <section>
          <Label className="mb-1.5" aside={m.h2h.summary}>Last {games.length} meetings</Label>
          <WDL m={m} h={won(m.home.id)} d={draws} a={won(m.away.id)} />
          <ul className="mt-2 space-y-1">
            {games.map((g) => (
              <li key={g.id} className="grid grid-cols-[70px_minmax(0,1fr)_48px_minmax(0,1fr)] items-center gap-2 font-ui text-[14.5px]">
                <span className="text-xs text-mute">{shortDate(g.date)} {new Date(g.date).getFullYear()}</span>
                <span className={`truncate text-right ${g.winnerId === g.homeId ? "font-bold" : "text-chalk/75"}`}>{g.home}</span>
                <span className="rounded bg-terrace text-center font-bold tnum">{g.score}</span>
                <span className={`truncate ${g.winnerId === g.awayId ? "font-bold" : "text-chalk/75"}`}>{g.away}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!all && !games.length && <p className="py-6 text-center font-ui text-sm text-mute">No previous meetings on record.</p>}
    </div>
  );
}

function WDL({ m, h, d, a }: { m: MatchDetail; h: number; d: number; a: number }) {
  const t = h + d + a || 1;
  return (
    <div>
      <div className="flex h-7 overflow-hidden rounded-md font-display text-base font-extrabold text-[#0d1216]">
        <div className="grid place-items-center" style={{ width: `${(h / t) * 100}%`, background: sideColor(m, "home") }}>{h || ""}</div>
        <div className="grid place-items-center bg-[#56616d]" style={{ width: `${(d / t) * 100}%` }}>{d || ""}</div>
        <div className="grid place-items-center" style={{ width: `${(a / t) * 100}%`, background: sideColor(m, "away") }}>{a || ""}</div>
      </div>
      <div className="mt-1 flex justify-between font-ui text-[12px] text-mute">
        <span>{m.home.short} wins</span>
        <span>Draws</span>
        <span>{m.away.short} wins</span>
      </div>
    </div>
  );
}

