import { useState } from "react";
import type { LeaderBoard, LeaderRow, MatchDetail, Side, SquadPlayer, TeamDetail, TeamLeaders } from "../../../shared/types";
import { accent, go, leaderValue, ordinal, playerHash } from "../lib";
import { tip } from "../glossary";
import { Crest, Modal, Photo } from "./ui";

// The boards a club column shows; the modal has them all.
const PANEL = ["goals", "goal_assist", "rating", "value", "expected_goals", "total_att_assist", "defensive_contributions", "mins_played"];
// The bar column only appears where there is room for it.
const ROW_COLS = "grid grid-cols-[24px_36px_minmax(0,1fr)_56px_80px] items-center gap-x-2 sm:grid-cols-[28px_36px_minmax(0,1fr)_minmax(60px,22%)_64px_92px] sm:gap-x-2.5";
const TIPS: Record<string, string> = { rating: "seasonRating", value: "marketValue", expected_goals: "xg", expected_assists: "xa" };

export const squadOf = (team: TeamDetail, r: LeaderRow): SquadPlayer | undefined =>
  team.squad.find((p) => (r.fmId && p.fmId === r.fmId) || (r.tmId && p.tmId === r.tmId));

const shortName = (team: TeamDetail, r: LeaderRow) => {
  const sp = squadOf(team, r);
  if (sp) return sp.short;
  const parts = r.name.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : r.name;
};

function openRow(m: MatchDetail, team: TeamDetail, r: LeaderRow) {
  const sp = squadOf(team, r);
  const fm = r.fmId ?? sp?.fmId;
  const id = sp?.id ?? (fm ? `fm${fm}` : undefined);
  if (id) go(playerHash(m.league, m.id, id, fm));
}

const leagueNote = (b: LeaderBoard, r: LeaderRow, league: string) => (r.leagueRank ? `${ordinal(r.leagueRank)} in ${league}` : undefined);

/** Where one player stands on every board they appear on. */
export function playerRanks(leaders: TeamLeaders | undefined, fm?: number, tm?: string) {
  if (!leaders) return [];
  return leaders.boards.flatMap((b) => {
    const r = b.rows.find((x) => (fm && x.fmId === fm) || (tm && x.tmId === tm));
    return r ? [{ board: b, row: r }] : [];
  });
}

/** The Players tab: each board's leader with a photo, the next three under it, league rank alongside. */
export function LeaderBoards({ m, team, leaders, onOpen }: { m: MatchDetail; team: TeamDetail; leaders: TeamLeaders; onOpen: (key?: string) => void }) {
  const boards = PANEL.map((k) => leaders.boards.find((b) => b.key === k)).filter((b): b is LeaderBoard => !!b);
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between font-ui text-[13px] font-semibold text-mute">
        <span>This season · {leaders.leagueName}</span>
        <button onClick={() => onOpen()} className="font-semibold text-chalk/85 hover:text-chalk">All leaders</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {boards.map((b) => {
          const [lead, ...rest] = b.rows;
          return (
            <div key={b.key} className="min-w-0 rounded-lg bg-terrace/50 p-2">
              <button onClick={() => onOpen(b.key)} className="mb-1 flex w-full items-baseline justify-between gap-2 text-left font-ui text-[12px] text-mute hover:text-chalk">
                <span className="truncate" {...(TIPS[b.key] ? tip(TIPS[b.key]) : {})}>{b.label}</span>
                {lead.leagueRank && (
                  <span className={`shrink-0 tnum ${lead.leagueRank <= 10 ? "font-semibold text-chalk/90" : ""}`} data-tip={`${shortName(team, lead)} is ${ordinal(lead.leagueRank)} of ${b.leagueSize} ranked players in ${leaders.leagueName}`}>
                    {ordinal(lead.leagueRank)} in {leaders.leagueName}
                  </span>
                )}
              </button>
              <button onClick={() => openRow(m, team, lead)} className="flex w-full min-w-0 items-center gap-2 text-left">
                <Photo src={squadOf(team, lead)?.photo ?? lead.photo} name={lead.name} className="size-10" ring="var(--team)" />
                <div className="min-w-0 leading-tight">
                  <div className="truncate font-ui text-[15px] font-bold hover:underline">{shortName(team, lead)}</div>
                  <div className="font-display text-xl font-extrabold leading-none tnum">
                    {leaderValue(b, lead.value)} {b.format !== "eur" && <span className="font-ui text-[12px] font-normal text-mute">{b.unit}</span>}
                  </div>
                </div>
              </button>
              {rest.length > 0 && (
                <ol className="mt-1.5 space-y-px border-t border-rule/50 pt-1">
                  {rest.slice(0, 3).map((r) => (
                    <li key={r.name}>
                      <button onClick={() => openRow(m, team, r)} className="grid w-full grid-cols-[14px_minmax(0,1fr)_auto] items-baseline gap-1.5 rounded px-0.5 text-left font-ui text-[13px] hover:bg-terrace" data-tip={leagueNote(b, r, leaders.leagueName)}>
                        <span className="text-faint tnum">{r.teamRank}</span>
                        <span className="truncate text-chalk/85">{shortName(team, r)}</span>
                        <span className="font-semibold tnum">{leaderValue(b, r.value)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LeadersModal({ m, side, team, leaders, start, onClose }: { m: MatchDetail; side: Side; team: TeamDetail; leaders: TeamLeaders; start?: string; onClose: () => void }) {
  const [key, setKey] = useState(start ?? leaders.boards[0]?.key);
  const b = leaders.boards.find((x) => x.key === key) ?? leaders.boards[0];
  const inMatch = new Set([...m.lineups[side].starters, ...m.lineups[side].bench].map((p) => p.id));
  const max = Math.max(...(b?.rows.map((r) => r.value) ?? [1]));
  return (
    <Modal label={`${team.short} leaders`} onClose={onClose} className="sm:w-[min(900px,96vw)]">
      <div className="flex min-h-0 flex-col" style={{ ["--team" as string]: accent(team.color, team.altColor) }}>
        <header className="shrink-0 border-b border-rule p-4 pr-20">
          <h3 className="flex items-center gap-2 font-display text-3xl font-extrabold leading-none"><Crest src={team.logo} className="size-7" />{team.short} leaders</h3>
          <p className="mt-1 font-ui text-[13px] text-mute">{leaders.leagueName} season so far. League rank is among every {leaders.leagueName} player on that list.</p>
        </header>
        <div className="grid min-h-0 flex-1 md:grid-cols-[230px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
          <nav className="scroll-thin flex shrink-0 gap-1 overflow-x-auto border-b border-rule p-2 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
            {leaders.boards.map((x) => (
              <button key={x.key} onClick={() => setKey(x.key)} className={`shrink-0 rounded-md px-2.5 py-1.5 text-left font-ui md:w-full ${x.key === b?.key ? "bg-terrace text-chalk" : "text-chalk/75 hover:bg-terrace/60"}`}>
                <div className="whitespace-nowrap text-[14.5px] font-semibold">{x.label}</div>
                <div className="hidden truncate text-[12px] text-mute md:block">{shortName(team, x.rows[0])} · {leaderValue(x, x.rows[0].value)}</div>
              </button>
            ))}
          </nav>
          {b && (
            <div className="scroll-thin min-h-0 overflow-y-auto p-3">
              <div className={`${ROW_COLS} px-1 pb-1 font-ui text-[12px] text-faint`}>
                <span className="text-right">#</span>
                <span />
                <span>Player</span>
                <span className="hidden sm:block" />
                <span className="text-right" {...(TIPS[b.key] ? tip(TIPS[b.key]) : {})}>{b.unit}</span>
                <span className="text-right" data-tip={`Among ${b.leagueSize} ranked players in ${leaders.leagueName}`}>in {leaders.leagueName}</span>
              </div>
              <ol>
                {b.rows.map((r) => {
                  const sp = squadOf(team, r);
                  return (
                    <li key={`${r.name}-${r.fmId ?? r.tmId}`}>
                      <button onClick={() => openRow(m, team, r)} className={`${ROW_COLS} h-11 w-full rounded px-1 text-left font-ui hover:bg-terrace/70`}>
                        <span className="text-right text-[14px] text-mute tnum">{r.teamRank}</span>
                        <Photo src={sp?.photo ?? r.photo} name={r.name} className="size-9" />
                        <span className="min-w-0 leading-tight">
                          <span className="block truncate text-[15px] font-semibold">{sp?.name ?? r.name}</span>
                          <span className="block truncate text-[12px] text-mute">{[sp?.position, sp && inMatch.has(sp.id) ? "in this match" : undefined].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="hidden h-1.5 overflow-hidden rounded-full bg-terrace sm:block">
                          <span className="block h-full rounded-full bg-[var(--team)]" style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
                        </span>
                        <span className="text-right font-display text-xl font-extrabold leading-none tnum">{leaderValue(b, r.value)}</span>
                        <span className="text-right text-[14px] tnum">
                          {r.leagueRank ? <><b className={r.leagueRank <= 10 ? "text-chalk" : "font-normal text-chalk/75"}>{ordinal(r.leagueRank)}</b><span className="text-faint"> /{b.leagueSize}</span></> : "–"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 px-1 font-ui text-[12px] text-faint">Source: {b.source}{b.source === "FotMob" ? ", league matches only; rating and per-90 lists need enough minutes" : ", current squad values"}.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
