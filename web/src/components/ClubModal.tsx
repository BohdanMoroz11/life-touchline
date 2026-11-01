import { useState } from "react";
import type { MatchDetail, TeamDetail } from "../../../shared/types";
import { accent, euros, ordinal, shortDate, resultColor, kickoff } from "../lib";
import { tip } from "../glossary";
import { Crest, Label, Modal, Segmented } from "./ui";

type Tab = "about" | "fixtures" | "news";

export function ClubModal({ team, m, onClose }: { team: TeamDetail; m: MatchDetail; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("about");
  const l = team.lore;
  return (
    <Modal label={team.name} onClose={onClose} className="sm:w-[min(820px,96vw)]">
      <header className="relative shrink-0 overflow-hidden border-b border-rule p-5 pr-20">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `linear-gradient(110deg, #${team.color} 0%, transparent 70%)` }} />
        <div className="relative flex items-center gap-4">
          <Crest src={team.logo} className="size-16 drop-shadow" />
          <div className="min-w-0">
            <h2 className="font-display text-4xl font-extrabold leading-none">{team.name}</h2>
            <div className="mt-1 font-ui text-sm text-chalk/80">
              {[l?.nickname && `“${l.nickname}”`, l?.founded && `founded ${l.founded}`, team.venue && `${team.venue.name}${team.venue.capacity ? ` (${team.venue.capacity.toLocaleString()})` : ""}`].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap items-end gap-x-6 gap-y-2 font-ui">
          {team.standing && <Fact label={`in ${m.leagueInfo.short}`} value={ordinal(team.standing.rank)} />}
          {team.squadValue && <Fact label={`squad value, ${ordinal(team.squadValue.rank ?? 0)} in league`} value={euros(team.squadValue.total) ?? "–"} k="squadValue" />}
          {team.squadValue?.avgAge && <Fact label="average age" value={team.squadValue.avgAge.toFixed(1)} />}
          {team.honours[0] && <Fact label={`${team.honours[0].title} titles`} value={String(team.honours[0].count)} />}
        </div>
        <Segmented
          className="relative mt-4"
          value={tab}
          onChange={setTab}
          options={[
            { value: "about", label: "About" },
            { value: "fixtures", label: "Fixtures" },
            { value: "news", label: `News${team.news.length ? ` (${team.news.length})` : ""}` },
          ]}
        />
      </header>
      <div className="scroll-thin min-h-0 overflow-auto p-5" style={{ ["--team" as string]: accent(team.color, team.altColor) }}>
        {tab === "about" && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              {l?.identity && <p className="text-[16.5px] leading-relaxed text-chalk/90">{l.identity}</p>}
              {l?.history && <p className="text-[16.5px] leading-relaxed text-chalk/75">{l.history}</p>}
              {!l && <p className="text-mute">No club notes written for {team.name} yet.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                {l?.rivals && l.rivals.length > 0 && (
                  <div>
                    <Label className="mb-1">Rivals</Label>
                    <div className="font-ui text-sm">{l.rivals.join(", ")}</div>
                  </div>
                )}
                {l?.legends && l.legends.length > 0 && (
                  <div>
                    <Label className="mb-1">Legends</Label>
                    <div className="font-ui text-sm">{l.legends.join(", ")}</div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label className="mb-1.5">Honours</Label>
              {team.honours.length ? (
                <ul className="space-y-1">
                  {team.honours.slice(0, 12).map((h) => (
                    <li key={h.title} className="flex items-baseline gap-2 font-ui text-sm">
                      <span className="w-8 shrink-0 text-right font-display text-lg font-extrabold text-yellow tnum">{h.count}</span>
                      <span className="min-w-0 flex-1 truncate">{h.title}</span>
                      {h.last && <span className="shrink-0 text-xs text-mute">last {h.last}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-ui text-sm text-mute">No major honours listed.</p>
              )}
            </div>
          </div>
        )}
        {tab === "fixtures" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <Label className="mb-1.5">Recent results</Label>
              {team.results.map((r) => (
                <div key={r.id} className="grid grid-cols-[52px_44px_minmax(0,1fr)_auto] items-center gap-2 py-1 font-ui text-sm">
                  <span className="text-xs text-mute">{shortDate(r.date)}</span>
                  <span className="text-xs text-mute">{r.comp}</span>
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <span className="text-mute">{r.home ? "vs" : "at"}</span>
                    <Crest src={r.opponent.logo} className="size-4" />
                    <span className="truncate">{r.opponent.name}</span>
                  </span>
                  <span className="rounded px-1.5 font-bold tnum text-[#0d1216]" style={{ background: resultColor(r.result) }}>{r.score}</span>
                </div>
              ))}
            </div>
            <div>
              <Label className="mb-1.5">Coming up</Label>
              {team.fixtures.map((r) => (
                <div key={r.id} className="grid grid-cols-[52px_44px_minmax(0,1fr)_auto] items-center gap-2 py-1 font-ui text-sm">
                  <span className="text-xs text-mute">{shortDate(r.date)}</span>
                  <span className="text-xs text-mute">{r.comp}</span>
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <span className="text-mute">{r.home ? "vs" : "at"}</span>
                    <Crest src={r.opponent.logo} className="size-4" />
                    <span className="truncate">{r.opponent.name}</span>
                  </span>
                  <span className="text-xs text-mute tnum">{kickoff(r.date)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "news" && (
          <ul className="space-y-3">
            {team.news.map((n, i) => (
              <li key={i}>
                <a href={n.link} target="_blank" rel="noreferrer" className="group block">
                  <div className="font-ui text-[16.5px] font-semibold group-hover:underline">{n.headline}</div>
                  {n.description && <p className="mt-0.5 text-sm text-mute">{n.description}</p>}
                  {n.published && <div className="mt-0.5 text-xs text-faint">{shortDate(n.published)}</div>}
                </a>
              </li>
            ))}
            {!team.news.length && <p className="text-mute">No recent news from ESPN.</p>}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function Fact({ label, value, k }: { label: string; value: string; k?: string }) {
  return (
    <div {...(k ? tip(k) : {})}>
      <div className="font-display text-3xl font-extrabold leading-none tnum">{value}</div>
      <div className="text-xs text-mute">{label}</div>
    </div>
  );
}
