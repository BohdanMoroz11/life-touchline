import type { MatchDetail, ShapeInfo, Side } from "../../../shared/types";
import { accent, resultColor, shortDate } from "../lib";
import { tip } from "../glossary";
import { Popover } from "./ui";

const FLUIDITY: Record<string, { label: string; body: string }> = {
  fixed: { label: "Settled shape", body: "The same formation in almost every recent match." },
  variable: { label: "Switches systems", body: "One main formation, with a second (or third) used against certain opponents." },
  fluid: { label: "Changes shape often", body: "No single formation dominates lately; expect the shape on paper to be loose." },
};

/** Something about the formation deserves a second look: sources disagree, it's not the usual one, or players are out of position. */
export function shapeAlerts(s?: ShapeInfo) {
  if (!s) return [];
  const out: string[] = [];
  if (s.disagree) out.push(`Sources disagree: FotMob says ${s.sources.fotmob}, ESPN says ${s.sources.espn}`);
  if (s.changedFromUsual) out.push(`Not their usual shape (usually ${s.usual})`);
  if (s.outOfPosition.length) out.push(`${s.outOfPosition.length} player${s.outOfPosition.length > 1 ? "s" : ""} out of position`);
  if (s.changes.length) out.push(`${s.changes.length} in-game change${s.changes.length > 1 ? "s" : ""}`);
  return out;
}

/** The formation label in the pitch bar; opens the full shape story. */
export function FormationButton({ m, side }: { m: MatchDetail; side: Side }) {
  const l = m.lineups[side];
  const s = m.shape?.[side];
  const alerts = shapeAlerts(s);
  if (!l.formation && !s?.usual) return null;
  return (
    <Popover
      align={side === "away" ? "right" : "left"}
      className="w-[min(380px,calc(100vw-24px))]"
      trigger={(open) => (
        <span
          className={`relative inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1 font-display text-[22px] font-extrabold leading-none tnum hover:bg-terrace ${open ? "bg-terrace" : ""}`}
          data-tip={alerts.length ? alerts.join("\n") + "\n\nClick for the full shape story." : "How this team lines up and shifts. Click for details."}
          data-tip-title="Formation"
        >
          {l.formation ?? s?.usual}
          {alerts.length > 0 && <span className="size-1.5 rounded-full bg-yellow" aria-label="Worth a look" />}
          <span className="font-ui text-[12px] font-normal text-mute">▾</span>
        </span>
      )}
    >
      <ShapeCard m={m} side={side} />
    </Popover>
  );
}

export function ShapeCard({ m, side }: { m: MatchDetail; side: Side }) {
  const s = m.shape?.[side];
  const l = m.lineups[side];
  const color = accent(m[side].color, m[side].altColor);
  if (!s) return <p className="font-ui text-sm text-mute">No shape data for {m[side].name}.</p>;
  const total = s.counts.reduce((a, c) => a + c.count, 0);
  const c = s.coach;
  return (
    <div className="space-y-3 font-ui text-[14.5px] leading-snug" style={{ ["--team" as string]: color }}>
      <header>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-2xl font-extrabold leading-none">
            {l.formation ?? s.usual}
            <span className="ml-2 font-ui text-xs font-normal text-mute">{l.status === "official" ? "on the team sheet" : l.status === "probable" ? "probable" : "usual"}</span>
          </span>
          <span className="text-xs text-mute">{m[side].short}</span>
        </div>
        <p className="mt-1 text-xs text-mute">A formation is a snapshot of where players start. Teams reshape with and without the ball, so read it as the base structure.</p>
      </header>

      {(s.disagree || s.changedFromUsual) && (
        <div className="space-y-1 rounded-lg bg-yellow/10 p-2 text-chalk/90 ring-1 ring-yellow/25">
          {s.disagree && (
            <div>
              <b className="font-semibold text-yellow">Sources disagree.</b> FotMob reads {s.sources.fotmob}, ESPN lists {s.sources.espn}. The pitch uses FotMob's, which places players by where they actually line up.
            </div>
          )}
          {s.changedFromUsual && (
            <div>
              <b className="font-semibold text-yellow">A change.</b> They've mostly played {s.usual} lately; today's sheet says {l.formation}.
            </div>
          )}
        </div>
      )}

      {c && (c.in_possession || c.out_of_possession) && (
        <section>
          <div className="mb-1 flex items-center justify-between text-[12.5px] font-semibold text-mute">
            <span>How they shift</span>
            <span className="font-normal" data-tip="Hand-written from what's known about the coach's methods, not measured from data.">
              coach notes{c.confidence ? ` · ${c.confidence} confidence` : ""}
            </span>
          </div>
          <dl className="space-y-1">
            {c.in_possession && (
              <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
                <dt className="text-good">With ball</dt>
                <dd className="text-chalk/90">{c.in_possession}</dd>
              </div>
            )}
            {c.out_of_possession && (
              <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
                <dt className="text-bad">Without</dt>
                <dd className="text-chalk/90">{c.out_of_possession}</dd>
              </div>
            )}
          </dl>
          {c.roles && c.roles.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {c.roles.map((r) => (
                <li key={r} className="flex gap-1.5 text-chalk/80"><span className="text-[var(--team)]">◆</span>{r}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {s.outOfPosition.length > 0 && (
        <section>
          <div className="mb-1 text-[12.5px] font-semibold text-mute">Out of position today</div>
          <ul className="space-y-0.5">
            {s.outOfPosition.map((o) => (
              <li key={o.playerId} className="text-chalk/90">
                <b className="font-semibold">{o.name}</b> at <b className="font-semibold text-yellow">{o.slot}</b>
                <span className="text-mute"> · {o.kind === "flank" ? "usually plays the other flank" : `usually ${o.natural.join(", ")}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.changes.length > 0 && (
        <section>
          <div className="mb-1 text-[12.5px] font-semibold text-mute">During the match</div>
          <ul className="space-y-1">
            {s.changes.map((ch, i) => (
              <li key={i} className="grid grid-cols-[38px_minmax(0,1fr)] gap-2 text-chalk/90">
                <span className="text-mute tnum">{ch.minute}</span>
                {ch.text}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[12px] text-faint">Inferred from who came on and off; the coach may have kept the shape.</p>
        </section>
      )}

      {total > 0 && (
        <section>
          <div className="mb-1 flex items-center justify-between text-[12.5px] font-semibold text-mute">
            <span>Last {s.recent.length} matches</span>
            {s.fluidity && (
              <span className="font-normal text-chalk/80" data-tip={FLUIDITY[s.fluidity].body + (c?.fluidity && c.fluidity !== s.fluidity ? `\nCoach notes call the team ${c.fluidity}.` : "")}>
                {FLUIDITY[s.fluidity].label}
              </span>
            )}
          </div>
          <div className="space-y-1">
            {s.counts.map((f) => (
              <div key={f.formation} className="flex items-center gap-2">
                <span className="w-14 shrink-0 font-semibold tnum">{f.formation}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-terrace">
                  <div className="h-full rounded-full bg-[var(--team)]" style={{ width: `${(f.count / total) * 100}%` }} />
                </div>
                <span className="w-5 text-right text-mute tnum">{f.count}</span>
              </div>
            ))}
          </div>
          <ul className="mt-2 space-y-0.5">
            {s.recent.map((r) => (
              <li key={r.matchId} className="grid grid-cols-[44px_40px_minmax(0,1fr)_auto_52px] items-center gap-1.5 text-[13px]">
                <span className="text-mute tnum">{shortDate(r.date)}</span>
                <span className="truncate text-faint">{r.comp}</span>
                <span className="truncate">{r.home ? "vs" : "at"} {r.opponent}</span>
                {r.score ? <span className="rounded px-1 font-bold tnum text-[#0d1216]" style={{ background: resultColor(r.result) }}>{r.score}</span> : <span />}
                <span className={`text-right tnum ${r.formation && r.formation !== s.usual ? "font-semibold text-yellow" : "text-chalk/80"}`}>{r.formation ?? "–"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-[12px] text-faint" {...tip("formation")}>Formations from FotMob lineups; positions from FotMob squad data.</p>
    </div>
  );
}
