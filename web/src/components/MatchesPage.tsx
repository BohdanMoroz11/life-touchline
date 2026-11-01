import type { League, MatchCard } from "../../../shared/types";
import { dayLabel, kickoff, ordinal, shiftDay, todayYmd, useMatches } from "../lib";
import { Crest, ErrorNote, Spinner } from "./ui";

export function MatchesPage({ date }: { date?: string }) {
  const day = date ?? todayYmd();
  const q = useMatches(day);
  const total = q.data?.leagues.reduce((s, l) => s + l.matches.length, 0) ?? 0;
  const live = q.data?.leagues.reduce((s, l) => s + l.matches.filter((m) => m.state === "in").length, 0) ?? 0;
  return (
    <div className="mx-auto min-h-dvh max-w-[1320px] px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-5 pt-6">
        <div>
          <h1 className="font-display text-5xl font-black leading-none tracking-tight">Touchline</h1>
          <p className="mt-1 font-ui text-sm text-mute">
            {dayLabel(day)}
            {q.data && ` · ${total} match${total === 1 ? "" : "es"}`}
            {live > 0 && <span className="ml-2 text-live">● {live} live</span>}
          </p>
        </div>
        <nav className="flex items-center gap-1 font-ui text-sm" aria-label="Change day">
          <a href={`#/d/${shiftDay(day, -1)}`} className="rounded-lg px-3 py-1.5 ring-1 ring-rule hover:bg-terrace" aria-label="Previous day">‹</a>
          <a href="#/" className={`rounded-lg px-3 py-1.5 ring-1 ring-rule hover:bg-terrace ${!date ? "bg-terrace" : ""}`}>Today</a>
          <a href={`#/d/${shiftDay(day, 1)}`} className="rounded-lg px-3 py-1.5 ring-1 ring-rule hover:bg-terrace" aria-label="Next day">›</a>
        </nav>
      </header>
      {q.isLoading && <Spinner label="Loading matches" />}
      {q.error && <ErrorNote error={q.error} what="matches" />}
      {q.data && total === 0 && (
        <div className="rounded-xl bg-stand p-8 text-center font-ui text-mute ring-1 ring-rule">
          No LaLiga, Premier League, Bundesliga or Champions League matches on this day. Try the next day.
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {q.data?.leagues
          .filter((l) => l.matches.length)
          .map((l) => <LeagueBlock key={l.league.id} league={l.league} matches={l.matches} />)}
      </div>
    </div>
  );
}

function LeagueBlock({ league, matches }: { league: League; matches: MatchCard[] }) {
  return (
    <section className="self-start overflow-hidden rounded-xl bg-stand ring-1 ring-rule">
      <h2 className="flex items-center gap-2.5 border-b border-rule px-4 py-2.5">
        <Crest src={league.logo} className="size-6 rounded bg-white/90 p-0.5" />
        <span className="font-display text-2xl font-extrabold leading-none">{league.name}</span>
        <span className="ml-auto font-ui text-xs text-mute">{league.country}</span>
      </h2>
      <ul>
        {matches.map((m) => <MatchRow key={m.id} m={m} />)}
      </ul>
    </section>
  );
}

function MatchRow({ m }: { m: MatchCard }) {
  const scorers = (side: "home" | "away") =>
    m.goals
      .filter((g) => g.side === side)
      .map((g) => `${g.player.split(" ").slice(-1)[0]} ${g.minute}${g.kind === "pen" ? " (p)" : g.kind === "og" ? " (og)" : ""}`)
      .join(", ");
  return (
    <li className="border-b border-rule/50 last:border-0">
      <a href={`#/m/${m.league}/${m.id}`} className="grid grid-cols-[52px_minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 hover:bg-terrace/70 sm:gap-3 sm:px-4">
        <span className={`font-ui text-xs tnum ${m.state === "in" ? "font-bold text-live" : "text-mute"}`}>
          {m.state === "pre" ? kickoff(m.date) : m.state === "in" ? <><span className="live-dot mr-1 inline-block size-1.5 rounded-full bg-live align-middle" />{m.status}</> : m.status}
        </span>
        <Side m={m} side="home" scorers={scorers("home")} />
        <span className={`rounded-md py-1 text-center font-display text-2xl font-black leading-none tnum ${m.state === "pre" ? "text-base font-bold text-mute" : m.state === "in" ? "bg-live/10 text-chalk" : "bg-terrace/70"}`}>
          {m.state === "pre" ? "v" : `${m.home.score}–${m.away.score}`}
        </span>
        <Side m={m} side="away" scorers={scorers("away")} />
      </a>
    </li>
  );
}

function Side({ m, side, scorers }: { m: MatchCard; side: "home" | "away"; scorers: string }) {
  const t = m[side];
  const right = side === "home";
  const dim = m.state === "post" && !t.winner && m[side === "home" ? "away" : "home"].winner;
  return (
    <span className={`flex min-w-0 items-center gap-2 ${right ? "flex-row-reverse text-right" : ""}`}>
      <Crest src={t.logo} className="size-7" />
      <span className="min-w-0 leading-tight">
        <span className={`block truncate font-ui text-[16.5px] font-semibold ${dim ? "text-chalk/60" : ""}`}>{t.short}</span>
        <span className="block truncate font-ui text-[12px] text-mute" data-tip-overflow data-tip={scorers}>
          {scorers || (t.record ? `${t.record}${t.rank ? ` · ${ordinal(t.rank)}` : ""}` : "")}
        </span>
      </span>
      {m.redCards.some((r) => r.side === side) && <span className="h-3 w-2 shrink-0 rounded-[1.5px] bg-red" aria-label="Red card" />}
    </span>
  );
}
