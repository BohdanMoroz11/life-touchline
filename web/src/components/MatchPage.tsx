import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MatchDetail, Side, TeamDetail } from "../../../shared/types";
import { accent, go, kickoff, ordinal, tint, useMatch, useTeam, useWidth } from "../lib";
import { tip } from "../glossary";
import { Crest, ErrorNote, Flash, Segmented, Spinner, Term } from "./ui";
import { Momentum, Pitch, type PitchMode, type SquadIndex } from "./Pitch";
import { ClubPanel, type ClubSection, type NumbersMode } from "./ClubPanel";
import { TabBody, centerTabs, type CenterTab } from "./CenterTabs";
import { PlayerModal } from "./PlayerModal";
import { FormationButton } from "./Shape";

// A fixed-viewport dashboard: the page never scrolls. Detail lives in tabs, popovers and modals.
export function MatchPage({ league, id, player }: { league: string; id: string; player?: { id: string; fm?: string } }) {
  const q = useMatch(league, id);
  const m = q.data;
  const home = useTeam(league, m?.home.id, m?.fm?.teamIds.home, m?.date);
  const away = useTeam(league, m?.away.id, m?.fm?.teamIds.away, m?.date);
  const w = useWidth();
  const [numbers, setNumbers] = useState<NumbersMode | null>(null);
  const [tab, setTab] = useState<CenterTab | null>(null);
  const [panelSide, setPanelSide] = useState<Side>("home");
  const [narrowTab, setNarrowTab] = useState<string>("pitch");
  const [pitchMode, setPitchMode] = useState<PitchMode>("lineups");
  const [clubSection, setClubSection] = useState<ClubSection>("players");

  useEffect(() => {
    setNumbers(null);
    setTab(null);
  }, [id]);
  useEffect(() => {
    if (m) document.title = `${m.home.abbr} ${m.state === "pre" ? "v" : `${m.home.score}-${m.away.score}`} ${m.away.abbr} · Touchline`;
  }, [m]);

  const squad: SquadIndex = useMemo(
    () => ({ home: new Map(home.data?.squad.map((p) => [p.id, p]) ?? []), away: new Map(away.data?.squad.map((p) => [p.id, p]) ?? []) }),
    [home.data, away.data],
  );

  if (q.isLoading) return <Spinner label="Loading the match" />;
  if (q.error || !m) return <ErrorNote error={q.error} what="this match" />;

  const teams: Record<Side, TeamDetail | undefined> = { home: home.data, away: away.data };
  const mode: NumbersMode = numbers ?? (m.state === "pre" ? "season" : "match");
  const activeTab: CenterTab = tab ?? (m.state === "pre" ? "preview" : "story");
  const tabs = centerTabs(m);
  const layout = w >= 1500 ? "wide" : w >= 1000 ? "medium" : "narrow";
  // Below ~1200px the dugouts would squeeze the pitch, so the benches get their own view instead.
  const benchView = layout === "narrow" || w < 1200;
  const shownPitchMode: PitchMode = pitchMode === "bench" && !benchView ? "lineups" : pitchMode;
  const numbersToggle =
    m.state !== "pre" ? (
      <Segmented size="sm" value={mode} onChange={setNumbers} options={[{ value: "match", label: "This match", title: "Ratings and numbers from this match" }, { value: "season", label: "Season", title: "Season averages and totals" }]} />
    ) : null;

  const panel = (s: Side) =>
    teams[s] || !(s === "home" ? home : away).isLoading ? (
      <ClubPanel m={m} side={s} team={teams[s]} mode={mode} section={clubSection} onSection={setClubSection} />
    ) : (
      <div className="h-full rounded-xl bg-stand ring-1 ring-rule"><Spinner label={`Loading ${m[s].name}`} /></div>
    );

  const center = (withTabs: boolean) => (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex min-h-0 flex-[2.1_1_0] flex-col rounded-xl bg-stand p-2 ring-1 ring-rule">
        <PitchBar m={m} mode={shownPitchMode} setMode={setPitchMode} benchTab={benchView} />
        <div className="min-h-0 flex-1 py-1.5">
          <Pitch m={m} mode={shownPitchMode} showSeason={mode === "season"} squad={squad} dugouts={!benchView} />
        </div>
        {m.momentum.length > 0 && (
          <div className="shrink-0 px-1">
            <div className="flex items-center justify-between font-ui text-[12.5px] text-faint">
              <Term k={m.momentumSource === "fotmob" ? "momentum" : "momentumEstimate"}>Momentum</Term>
              {m.xg && <span {...tip("xg")} className="tnum">xG {m.xg.home.toFixed(2)} – {m.xg.away.toFixed(2)}</span>}
            </div>
            <Momentum m={m} height={40} />
          </div>
        )}
      </div>
      {withTabs && (
        <div className="flex min-h-0 flex-[1_1_0] flex-col rounded-xl bg-stand ring-1 ring-rule @container">
          <div className="flex shrink-0 items-center gap-2 border-b border-rule px-2 py-1.5">
            <Segmented size="sm" value={activeTab} onChange={setTab} options={tabs} />
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-auto p-3">
            <TabBody tab={activeTab} m={m} teams={teams} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header m={m} updatedAt={q.dataUpdatedAt} toggle={layout !== "narrow" ? numbersToggle : null} />
      {layout === "wide" && (
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(340px,0.75fr)_minmax(720px,2.5fr)_minmax(340px,0.75fr)] grid-rows-[minmax(0,1fr)] gap-2 p-2">
          {panel("home")}
          {center(true)}
          {panel("away")}
        </main>
      )}
      {layout === "medium" && (
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.85fr)_minmax(300px,1fr)] grid-rows-[minmax(0,1fr)] gap-2 p-2">
          {center(true)}
          <div className="flex min-h-0 flex-col gap-2">
            <Segmented
              className="self-start"
              value={panelSide}
              onChange={setPanelSide}
              options={(["home", "away"] as Side[]).map((s) => ({ value: s, label: <span className="flex items-center gap-1.5"><Crest src={m[s].logo} className="size-4" />{m[s].short}</span> }))}
            />
            <div className="min-h-0 flex-1">{panel(panelSide)}</div>
          </div>
        </main>
      )}
      {layout === "narrow" && (
        <>
          <nav className="scroll-thin flex shrink-0 items-center gap-2 overflow-x-auto px-2 py-1.5">
            <Segmented
              size="sm"
              value={narrowTab}
              onChange={setNarrowTab}
              options={[
                { value: "pitch", label: "Pitch" },
                ...(["home", "away"] as Side[]).map((s) => ({ value: s, label: <span className="flex items-center gap-1"><Crest src={m[s].logo} className="size-3.5" />{m[s].abbr}</span> })),
                ...tabs,
              ]}
            />
            {numbersToggle}
          </nav>
          <main className="min-h-0 flex-1 px-2 pb-2">
            {narrowTab === "pitch" && center(false)}
            {(narrowTab === "home" || narrowTab === "away") && panel(narrowTab)}
            {tabs.some((t) => t.value === narrowTab) && (
              <div className="scroll-thin h-full overflow-auto rounded-xl bg-stand p-3 ring-1 ring-rule @container">
                <TabBody tab={narrowTab as CenterTab} m={m} teams={teams} />
              </div>
            )}
          </main>
        </>
      )}
      {player && <PlayerModal id={player.id} fm={player.fm} m={m} teams={teams} onClose={() => go(`#/m/${league}/${id}`)} />}
    </div>
  );
}

function PitchBar({ m, mode, setMode, benchTab }: { m: MatchDetail; mode: PitchMode; setMode: (v: PitchMode) => void; benchTab?: boolean }) {
  const side = (s: Side) => {
    const l = m.lineups[s];
    const status =
      l.status === "official" ? (
        <span className="flex items-center gap-1 text-good" {...tip("official")}><span className="size-1.5 rounded-full bg-good" />Official</span>
      ) : l.status === "probable" ? (
        <span className="explain text-yellow" {...tip("probable", l.basis)}>Probable</span>
      ) : (
        <span className="text-mute">Lineup unknown</span>
      );
    return (
      <div className={`flex min-w-0 items-center gap-2 font-ui text-[15px] ${s === "away" ? "flex-row-reverse text-right" : ""}`}>
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: `#${l.kit?.color ?? m[s].color}`, boxShadow: "0 0 0 1px rgba(255,255,255,.35)" }} />
        <FormationButton m={m} side={s} />
        <span className="hidden truncate text-mute @2xl:inline">{l.coach?.name}</span>
        <span className="hidden shrink-0 @lg:inline">{status}</span>
      </div>
    );
  };
  return (
    <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-1 @container">
      {side("home")}
      <Segmented
        size="sm"
        value={mode}
        onChange={setMode}
        options={[
          { value: "lineups", label: "Lineups" },
          // Narrow windows have no room for dugouts beside the pitch, so the benches get their own view.
          ...(benchTab ? [{ value: "bench" as const, label: "Bench" }] : []),
          { value: "shots", label: `Shots${m.shots.length ? ` ${m.shots.length}` : ""}`, title: "Shot map: bigger dots were better chances" },
        ]}
      />
      {side("away")}
    </div>
  );
}

function countdown(iso: string) {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "kicking off";
  const h = Math.floor(ms / 3600_000);
  const mins = Math.floor((ms % 3600_000) / 60_000);
  if (h >= 24) return new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  return h ? `in ${h}h ${mins}m` : `in ${mins} min`;
}

function Header({ m, updatedAt, toggle }: { m: MatchDetail; updatedAt: number; toggle: ReactNode }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 20_000);
    return () => clearInterval(t);
  }, []);
  return (
    <header
     
      className="relative shrink-0 border-b border-rule @container"
      style={{ background: `linear-gradient(100deg, ${tint(m.home.color)}66 0%, #151c23 30%, #151c23 70%, ${tint(m.away.color)}66 100%)` }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
        <a href="#/" className="flex items-center gap-2 font-ui text-sm text-chalk/80 hover:text-chalk" aria-label="All matches">
          ‹
          {m.leagueInfo.logo && <Crest src={m.leagueInfo.logo} className="size-5 rounded bg-white/90 p-0.5" />}
          <span className="hidden @3xl:inline">{m.leagueInfo.name}{m.round ? ` · ${m.round}` : ""}</span>
        </a>

        <div className="mx-auto grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 @5xl:max-w-[920px] @5xl:gap-6">
          <HeaderTeam m={m} side="home" />
          <Scoreboard m={m} updatedAt={updatedAt} />
          <HeaderTeam m={m} side="away" />
        </div>

        <div className="flex items-center gap-3">
          {m.odds && <OddsMini m={m} />}
          {toggle}
        </div>
      </div>
    </header>
  );
}

function HeaderTeam({ m, side }: { m: MatchDetail; side: Side }) {
  const t = m[side];
  const right = side === "away";
  const goals = m.goals.filter((g) => g.side === side);
  const reds = m.redCards.filter((r) => r.side === side);
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${right ? "flex-row-reverse text-right" : ""}`}>
      <Crest src={t.logo} className="size-7 drop-shadow @lg:size-9 @2xl:size-11" />
      <div className="min-w-0 leading-none">
        <div className={`flex items-baseline gap-2 ${right ? "flex-row-reverse" : ""}`}>
          <span className="font-display text-2xl font-extrabold tracking-tight @2xl:text-[33px]">
            <span className="@2xl:hidden">{t.abbr}</span>
            <span className="hidden @2xl:inline">{t.short}</span>
          </span>
          {t.rank && <span className="shrink-0 font-ui text-xs text-chalk/60 tnum" data-tip="League position">{ordinal(t.rank)}</span>}
        </div>
        <div className="mt-1 truncate font-ui text-[12.5px] text-chalk/70" data-tip-overflow data-tip={goals.map((g) => `${g.player} ${g.minute}`).join(", ")}>
          {goals.length || reds.length ? (
            <>
              {goals.map((g, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  {g.player.split(" ").slice(-1)[0]} {g.minute}
                  {g.kind === "pen" ? " (p)" : g.kind === "og" ? " (og)" : ""}
                </span>
              ))}
              {reds.map((r, i) => (
                <span key={`r${i}`} className="ml-1.5 text-red">■ {r.player.split(" ").slice(-1)[0]} {r.minute}</span>
              ))}
            </>
          ) : (
            <span className="text-chalk/50">{t.form ? t.form.split("").slice(-5).join(" ") : t.record}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Scoreboard({ m, updatedAt }: { m: MatchDetail; updatedAt: number }) {
  const hc = accent(m.home.color, m.home.altColor);
  const ac = accent(m.away.color, m.away.altColor);
  if (m.state === "pre") {
    return (
      <div className="text-center leading-none">
        <div className="font-display text-[37.5px] font-extrabold tnum">{kickoff(m.date)}</div>
        <div className="mt-0.5 font-ui text-xs text-chalk/70">{countdown(m.date)}</div>
      </div>
    );
  }
  return (
    <div className="text-center leading-none">
      <div className="flex items-center justify-center gap-1 font-display text-[44px] font-black tnum">
        <span style={{ ["--team" as string]: hc }}>
          <Flash value={m.home.score} scope={m.id} lift className={`px-1 ${m.state === "post" && !m.home.winner && m.away.winner ? "opacity-60" : ""}`} />
        </span>
        <span className="text-chalk/40">–</span>
        <span style={{ ["--team" as string]: ac }}>
          <Flash value={m.away.score} scope={m.id} lift className={`px-1 ${m.state === "post" && !m.away.winner && m.home.winner ? "opacity-60" : ""}`} />
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-1.5 font-ui text-xs font-semibold">
        {m.state === "in" && <span className="live-dot size-1.5 rounded-full bg-live" />}
        <span className={m.state === "in" ? "text-live" : "text-chalk/70"}>{m.status === "HT" ? "Half-time" : m.status || (m.state === "post" ? "Full time" : "")}</span>
        {(m.home.shootout || m.away.shootout) && <span className="text-chalk/70">pens {m.home.shootout}-{m.away.shootout}</span>}
      </div>
      {m.state === "in" && <UpdatedAgo at={updatedAt} />}
    </div>
  );
}

function OddsMini({ m }: { m: MatchDetail }) {
  const o = m.odds!;
  return (
    <div className="hidden cursor-help items-center gap-1.5 font-ui text-xs @4xl:flex" {...tip("odds", `${o.provider}: ${o.raw?.home} / ${o.raw?.draw} / ${o.raw?.away}`)}>
      <span className="tnum font-semibold">{Math.round(o.home)}</span>
      <div className="flex h-1.5 w-24 overflow-hidden rounded-full">
        <div style={{ width: `${o.home}%`, background: accent(m.home.color, m.home.altColor) }} />
        <div style={{ width: `${o.draw}%`, background: "#56616d" }} />
        <div style={{ width: `${o.away}%`, background: accent(m.away.color, m.away.altColor) }} />
      </div>
      <span className="tnum font-semibold">{Math.round(o.away)}</span>
      <span className="text-chalk/50">% · draw {Math.round(o.draw)}</span>
    </div>
  );
}

function UpdatedAgo({ at }: { at: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((now - at) / 1000));
  return (
    <div className="mt-0.5 font-ui text-[11px] text-chalk/45 tnum" data-tip="Live data refreshes about every 15 seconds. Changed numbers glow briefly.">
      updated {s < 10 ? "just now" : s < 60 ? `${Math.floor(s / 5) * 5}s ago` : `${Math.floor(s / 60)} min ago`}
    </div>
  );
}
