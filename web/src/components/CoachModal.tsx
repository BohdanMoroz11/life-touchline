import type { Coach, ShapeInfo, TeamDetail } from "../../../shared/types";
import { accent, tenure } from "../lib";
import { tip } from "../glossary";
import { Crest, Label, Modal, Photo } from "./ui";

const yr = (iso?: string) => (iso ? new Date(iso).getFullYear() : undefined);

export function CoachModal({ team, shape, onClose }: { team: TeamDetail; shape?: ShapeInfo; onClose: () => void }) {
  // FotMob's recent lineups read shapes better than ESPN's formation codes; prefer them.
  const c = { ...team.coach!, formations: shape?.counts.length ? shape.counts : team.coach!.formations };
  return (
    <Modal label={`Coach: ${c.name}`} onClose={onClose} className="sm:w-[min(780px,96vw)]">
      <div className="scroll-thin min-h-0 overflow-auto" style={{ ["--team" as string]: accent(team.color, team.altColor) }}>
        <CoachHero c={c} team={team} />
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            {c.style && (
              <section>
                <Label className="mb-1.5">How he sets up</Label>
                <p className="text-[16.5px] leading-relaxed text-chalk/90">{c.style}</p>
                {c.knownFor && <p className="mt-2 text-sm leading-relaxed text-mute">{c.knownFor}</p>}
                {shape?.coach?.in_possession && <p className="mt-2 text-sm leading-relaxed"><span className="text-good">With the ball:</span> <span className="text-chalk/85">{shape.coach.in_possession}</span></p>}
                {shape?.coach?.out_of_possession && <p className="mt-1 text-sm leading-relaxed"><span className="text-bad">Without it:</span> <span className="text-chalk/85">{shape.coach.out_of_possession}</span></p>}
                {shape?.coach?.roles && shape.coach.roles.length > 0 && <ul className="mt-1.5 space-y-0.5 text-sm text-chalk/80">{shape.coach.roles.map((r) => <li key={r}>◆ {r}</li>)}</ul>}
              </section>
            )}
            {c.formations && c.formations.length > 0 && <Formations c={c} />}
            {c.trophies && c.trophies.length > 0 && (
              <section>
                <Label className="mb-1.5" aside={`${c.trophies.reduce((s, t) => s + t.count, 0)} in total`}>Trophies as a coach</Label>
                <ul className="space-y-1">
                  {c.trophies.map((t) => (
                    <li key={t.title} className="flex items-baseline gap-2 font-ui text-sm" data-tip={t.years}>
                      <span className="w-7 shrink-0 text-right font-display text-lg font-extrabold text-yellow tnum">{t.count}×</span>
                      <span className="truncate">{t.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <Career c={c} team={team} />
        </div>
      </div>
    </Modal>
  );
}

export function CoachHero({ c, team, compact }: { c: Coach; team: TeamDetail; compact?: boolean }) {
  const t = tenure(c.appointed);
  const r = c.record;
  return (
    <header className={`relative overflow-hidden border-b border-rule ${compact ? "p-3" : "p-5 pr-20"}`}>
      <div className="pointer-events-none absolute inset-0 opacity-25" style={{ background: `linear-gradient(110deg, #${team.color} 0%, transparent 70%)` }} />
      <div className="relative flex items-center gap-4">
        <Photo src={c.photo} name={c.name} className={compact ? "size-14" : "size-20"} ring="var(--team)" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-ui text-sm text-mute">
            <Crest src={team.logo} className="size-4" /> {team.name} head coach
          </div>
          <h2 className={`font-display font-extrabold leading-none ${compact ? "text-3xl" : "text-4xl"}`}>{c.name}</h2>
          <div className="mt-1 font-ui text-sm text-chalk/80">
            {[c.nationality, c.age ? `${c.age} years old` : undefined].filter(Boolean).join(", ")}
            {t && <span {...tip("tenure")}> · in charge since {t.since} ({t.span})</span>}
          </div>
        </div>
      </div>
      {r && (
        <div className="relative mt-4 grid max-w-md grid-cols-5 gap-2 font-ui">
          {[
            ["Matches", r.games, ""],
            ["Won", r.w, "text-win"],
            ["Drawn", r.d, "text-draw"],
            ["Lost", r.l, "text-loss"],
            ["PPG", r.ppg?.toFixed(2), ""],
          ].map(([l, v, cls]) => (
            <div key={l as string} {...(l === "PPG" ? tip("ppg") : {})}>
              <div className={`font-display text-3xl font-extrabold leading-none tnum ${cls}`}>{v ?? "–"}</div>
              <div className="text-[12px] text-mute">{l}</div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

function Formations({ c }: { c: Coach }) {
  const total = c.formations!.reduce((s, f) => s + f.count, 0);
  return (
    <section>
      <Label className="mb-1.5" aside={`last ${total} matches`}>
        <span {...tip("formation")} className="explain">Formations used</span>
      </Label>
      <div className="space-y-1">
        {c.formations!.map((f) => (
          <div key={f.formation} className="flex items-center gap-2 font-ui text-sm">
            <span className="w-16 shrink-0 font-semibold tnum">{f.formation}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-terrace">
              <div className="h-full rounded-full" style={{ width: `${(f.count / total) * 100}%`, background: "var(--team)" }} />
            </div>
            <span className="w-6 text-right text-mute tnum">{f.count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Career({ c, team }: { c: Coach; team: TeamDetail }) {
  const rows = [
    ...(c.record ? [{ club: team.name, from: c.appointed, to: undefined as string | undefined, games: c.record.games, ppg: c.record.ppg, current: true }] : []),
    ...(c.previous ?? []).map((p) => ({ ...p, current: false })),
  ];
  if (!rows.length) return null;
  const maxPpg = Math.max(2.5, ...rows.map((r) => r.ppg ?? 0));
  return (
    <section>
      <Label className="mb-1.5" aside="all competitions">Career</Label>
      <ol className="relative space-y-0.5 border-l border-rule pl-3">
        {rows.map((r, i) => (
          <li key={i} className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-1 font-ui text-sm">
            <span className={`absolute -left-[17px] top-1/2 size-2 -translate-y-1/2 rounded-full ${r.current ? "bg-[var(--team)]" : "bg-rule"}`} />
            <div className="min-w-0">
              <div className={`truncate ${r.current ? "font-bold" : "font-semibold"}`}>{r.club}</div>
              <div className="text-xs text-mute tnum">
                {yr(r.from) ?? "?"}–{r.current ? "now" : yr(r.to) ?? "?"} · {r.games} matches
              </div>
            </div>
            {r.ppg != null && (
              <div className="flex items-center gap-2" {...tip("ppg")}>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-terrace">
                  <div className="h-full rounded-full bg-chalk/60" style={{ width: `${(r.ppg / maxPpg) * 100}%` }} />
                </div>
                <span className="w-9 text-right tnum">{r.ppg.toFixed(2)}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
