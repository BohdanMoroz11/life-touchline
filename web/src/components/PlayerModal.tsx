import { useState } from "react";
import type { MatchDetail, PlayerDetail, Side } from "../../../shared/types";
import { accent, euros, ratingColor, resultColor, shortDate, usePlayer } from "../lib";
import { tip } from "../glossary";
import { ErrorNote, Label, Modal, Photo, Rating, Segmented, Spinner } from "./ui";

type Tab = "overview" | "matches" | "career";

export function PlayerModal({ id, fm, m, onClose }: { id: string; fm?: string; m: MatchDetail; onClose: () => void }) {
  const q = usePlayer(id, fm);
  const [tab, setTab] = useState<Tab>("overview");
  const side: Side | undefined = (["home", "away"] as Side[]).find((s) => [...m.lineups[s].starters, ...m.lineups[s].bench].some((p) => p.id === id || String(p.fmId) === fm));
  const lp = side ? [...m.lineups[side].starters, ...m.lineups[side].bench].find((p) => p.id === id || String(p.fmId) === fm) : undefined;
  const color = side ? accent(m[side].color, m[side].altColor) : "#8d99a5";
  const p = q.data;
  return (
    <Modal label={p?.name ?? "Player"} onClose={onClose} className="sm:w-[min(860px,96vw)]">
      {q.isLoading && <Spinner label="Loading player" />}
      {q.error && <ErrorNote error={q.error} what="this player" />}
      {p && (
        <div className="flex min-h-0 flex-col" style={{ ["--team" as string]: color }}>
          <header className="relative shrink-0 overflow-hidden border-b border-rule p-5 pr-20">
            <div className="pointer-events-none absolute inset-0 opacity-25" style={{ background: side ? `linear-gradient(110deg, #${m[side].color} 0%, transparent 70%)` : undefined }} />
            {p.jersey && (
              <span className="pointer-events-none absolute -bottom-6 right-6 select-none font-display text-[165px] font-black leading-none text-transparent opacity-40 [-webkit-text-stroke:2px_var(--team)]">{p.jersey}</span>
            )}
            <div className="relative flex items-center gap-4">
              <Photo src={p.photo ?? lp?.photo} name={p.name} className="size-24" ring="var(--team)" />
              <div className="min-w-0">
                <div className="font-ui text-sm text-mute">{[p.team?.name, p.position].filter(Boolean).join(" · ")}</div>
                <h2 className="font-display text-4xl font-extrabold leading-none">{p.name}</h2>
                <div className="mt-1 font-ui text-sm text-chalk/80">
                  {[p.age && `${p.age} years`, p.nationality, p.heightCm && `${p.heightCm} cm`, p.foot && `${p.foot.toLowerCase()} foot`].filter(Boolean).join(" · ")}
                </div>
                {p.injury && (
                  <div className="mt-1.5 inline-block rounded bg-red/15 px-2 py-0.5 font-ui text-xs font-semibold text-red">
                    {p.injury.reason ?? "Injured"}{p.injury.returns ? ` · back ${p.injury.returns}` : ""}
                  </div>
                )}
              </div>
            </div>
            <div className="relative mt-4 flex flex-wrap items-end gap-x-6 gap-y-2 font-ui">
              {lp?.rating && m.state !== "pre" && (
                <div>
                  <Rating value={lp.rating} big />
                  <div className="mt-0.5 text-xs text-mute">this match</div>
                </div>
              )}
              {p.marketValue && <Fact label="market value" value={euros(p.marketValue)!} k="marketValue" />}
              {p.contractUntil && <Fact label="contract until" value={new Date(p.contractUntil).getFullYear().toString()} k="contract" />}
              {p.international?.apps != null && <Fact label={`${p.international.team} caps`} value={`${p.international.apps}`} sub={p.international.goals ? `${p.international.goals} goals` : undefined} />}
              {p.positions && p.positions.length > 1 && <Fact label="positions" value={p.positions.join(" / ")} />}
            </div>
            <Segmented
              className="relative mt-4"
              value={tab}
              onChange={setTab}
              options={[
                { value: "overview", label: "This season" },
                { value: "matches", label: `Recent matches${p.recent.length ? ` (${p.recent.length})` : ""}` },
                { value: "career", label: "Career" },
              ]}
            />
          </header>
          <div className="scroll-thin min-h-0 overflow-auto p-5">
            {tab === "overview" && <Overview p={p} m={m} lpStats={lp?.fm} />}
            {tab === "matches" && <Matches p={p} />}
            {tab === "career" && <Career p={p} />}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Fact({ label, value, k, sub }: { label: string; value: string; k?: string; sub?: string }) {
  return (
    <div {...(k ? tip(k) : {})}>
      <div className="font-display text-3xl font-extrabold leading-none tnum">{value}</div>
      <div className="text-xs text-mute">{label}{sub ? ` · ${sub}` : ""}</div>
    </div>
  );
}

function Overview({ p, m, lpStats }: { p: PlayerDetail; m: MatchDetail; lpStats?: Record<string, number> }) {
  const cols: [keyof PlayerDetail["season"][number], string, string?][] = [
    ["apps", "Apps"],
    ["starts", "Starts"],
    ["minutes", "Min"],
    ["goals", "G"],
    ["assists", "A"],
    ["shots", "Shots"],
    ["sot", "On tgt"],
    ["yc", "YC"],
    ["rating", "Rating", "seasonRating"],
  ];
  const shown = cols.filter(([k]) => p.season.some((r) => r[k] != null));
  return (
    <div className="space-y-5">
      {m.state !== "pre" && lpStats && Object.keys(lpStats).length > 0 && (
        <section>
          <Label className="mb-1.5">This match</Label>
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-ui">
            {(
              [
                ["min", "minutes"],
                ["xg", "xG"],
                ["xa", "xA"],
                ["shots", "shots"],
                ["chances", "chances created"],
                ["passes", "accurate passes"],
              ] as const
            ).map(([k, l]) =>
              lpStats[k] != null ? (
                <div key={k} {...(k === "xg" ? tip("xg") : k === "xa" ? tip("xa") : {})}>
                  <div className="font-display text-2xl font-extrabold leading-none tnum">{k === "xg" || k === "xa" ? lpStats[k].toFixed(2) : lpStats[k]}</div>
                  <div className="text-xs text-mute">{l}</div>
                </div>
              ) : null,
            )}
          </div>
        </section>
      )}
      <section>
        <Label className="mb-1.5">By competition</Label>
        {p.season.length ? (
          <div className="overflow-x-auto">
            <table className="w-full font-ui text-[14.5px] tnum">
              <thead>
                <tr className="text-[12px] text-faint">
                  <th className="text-left font-normal">Competition</th>
                  {shown.map(([k, l, t]) => (
                    <th key={k} className="px-1.5 text-right font-normal" {...(t ? tip(t) : {})}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.season.map((r) => (
                  <tr key={r.comp} className="border-t border-rule/50">
                    <td className="py-1 pr-2 font-semibold">{r.comp}</td>
                    {shown.map(([k]) => (
                      <td key={k} className={`px-1.5 text-right ${k === "goals" || k === "assists" ? "font-bold" : "text-chalk/80"}`}>
                        {k === "rating" ? (r.rating ? <span style={{ color: ratingColor(r.rating) }}>{r.rating.toFixed(2)}</span> : "–") : (r[k] as number | undefined) ?? "–"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-ui text-sm text-mute">No appearances this season.</p>
        )}
      </section>
      {p.traits && (
        <section>
          <Label className="mb-1.5" aside="percentile, same position">{p.traits.title}</Label>
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {p.traits.items.map((t) => (
              <div key={t.label} className="grid grid-cols-[minmax(0,1fr)_120px_32px] items-center gap-2 font-ui text-[14.5px]">
                <span className="truncate text-chalk/85">{t.label}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-terrace">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, t.value * 100)}%`, background: t.value >= 0.8 ? "var(--color-good)" : t.value <= 0.2 ? "var(--color-bad)" : "var(--team)" }} />
                </div>
                <span className="text-right text-mute tnum">{Math.round(t.value * 100)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {p.trophies.length > 0 && (
        <section>
          <Label className="mb-1.5">Trophies</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-ui text-sm">
            {p.trophies.slice(0, 14).map((t) => (
              <span key={t.title}>
                <b className="font-display text-base font-extrabold text-yellow">{t.count}×</b> {t.title}
              </span>
            ))}
          </div>
        </section>
      )}
      {p.news.length > 0 && (
        <section>
          <Label className="mb-1.5">News</Label>
          <ul className="space-y-1">
            {p.news.map((n, i) => (
              <li key={i} className="font-ui text-sm">
                <a href={n.link} target="_blank" rel="noreferrer" className="hover:underline">{n.headline}</a>
                {n.published && <span className="ml-2 text-xs text-faint">{shortDate(n.published)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Matches({ p }: { p: PlayerDetail }) {
  if (!p.recent.length) return <p className="font-ui text-sm text-mute">No recent matches available.</p>;
  return (
    <table className="w-full font-ui text-[14.5px] tnum">
      <thead>
        <tr className="text-[12px] text-faint">
          <th className="text-left font-normal">Date</th>
          <th className="text-left font-normal">Comp</th>
          <th className="text-left font-normal">Opponent</th>
          <th className="text-right font-normal">Result</th>
          <th className="text-right font-normal">Min</th>
          <th className="text-right font-normal">G</th>
          <th className="text-right font-normal">A</th>
          <th className="text-right font-normal" {...tip("rating")}>Rating</th>
        </tr>
      </thead>
      <tbody>
        {p.recent.map((r, i) => (
          <tr key={i} className="border-t border-rule/50">
            <td className="py-1 text-mute">{shortDate(r.date)}</td>
            <td className="text-mute">{r.comp}</td>
            <td className="max-w-[160px] truncate">{r.home ? "vs" : "at"} {r.opponent}</td>
            <td className="text-right">
              {r.score && <span className="rounded px-1 font-bold text-[#0d1216]" style={{ background: resultColor(r.result) }}>{r.score}</span>}
            </td>
            <td className="text-right text-chalk/80">{r.bench ? "bench" : r.minutes ?? "–"}</td>
            <td className="text-right font-bold">{r.goals || ""}</td>
            <td className="text-right font-bold">{r.assists || ""}</td>
            <td className="text-right">
              <Rating value={r.rating} /> {r.potm && <span className="text-yellow">★</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Career({ p }: { p: PlayerDetail }) {
  if (!p.career.length) return <p className="font-ui text-sm text-mute">No career data.</p>;
  const yr = (iso?: string) => (iso ? new Date(iso).getFullYear() : undefined);
  return (
    <ol className="relative space-y-1 border-l border-rule pl-4">
      {p.career.map((c, i) => (
        <li key={i} className="relative grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 font-ui text-sm">
          <span className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ${i === 0 ? "bg-[var(--team)]" : "bg-rule"}`} />
          <div className="min-w-0">
            <span className="font-semibold">{c.club}</span>
            {c.loan && <span className="ml-1.5 rounded bg-terrace px-1 text-[11px] text-mute">loan</span>}
            <span className="ml-2 text-xs text-mute tnum">{yr(c.from) ?? "?"}–{c.to ? yr(c.to) : "now"}</span>
          </div>
          <span className="text-xs text-chalk/80 tnum">
            {c.apps != null ? `${c.apps} apps` : ""}{c.goals != null ? ` · ${c.goals} goals` : ""}{c.assists != null ? ` · ${c.assists} assists` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
