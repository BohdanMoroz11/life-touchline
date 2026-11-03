// API contract between server and UI. Change this first when adding data.

export type Side = "home" | "away";
export type MatchState = "pre" | "in" | "post";

export type League = {
  id: string; // ESPN slug: esp.1, eng.1, ger.1, uefa.champions, ...
  name: string;
  short: string;
  logo: string;
  country: string;
};

export type TeamRef = {
  id: string;
  name: string;
  short: string;
  abbr: string;
  logo: string;
  color: string; // hex without #
  altColor: string;
  score?: string;
  shootout?: string;
  winner?: boolean;
  form?: string; // "WDLWW", oldest first
  record?: string; // "W-D-L" in this competition
  rank?: number; // league position
};

export type GoalMark = { side: Side; minute: string; player: string; kind?: "pen" | "og" };

export type MatchCard = {
  id: string;
  league: string;
  date: string;
  state: MatchState;
  status: string; // "78'", "HT", "FT", "Postponed"
  home: TeamRef;
  away: TeamRef;
  venue?: string;
  round?: string; // "Matchday 10", "League phase"
  note?: string; // aggregate / extra info
  goals: GoalMark[];
  redCards: { side: Side; minute: string; player: string }[];
};

export type PlayerMark = {
  goals: string[]; // minutes
  ownGoals: string[];
  pens: string[];
  assists: string[];
  yellow?: string;
  red?: string; // minute; second yellow also counts
  subIn?: string;
  subOut?: string;
};

export type LineupPlayer = {
  id: string;
  name: string;
  short: string;
  jersey?: string;
  pos?: string; // ESPN code (CD-L, AM-R, F...)
  role: "G" | "D" | "M" | "F";
  x?: number; // depth 0 (own goal) .. 1, starters only
  y?: number; // lateral 0 (team's left) .. 1 (right)
  starter: boolean;
  marks: PlayerMark;
  stats?: Record<string, number>; // this match
  /** Probable XI only: share of recent matches this player started (0..1). */
  confidence?: number;
  replacedBy?: string; // player id
  replaces?: string;
  /** Slot they fill today, from FotMob ("RB", "CDM", "LW"...). */
  slot?: string;
  // FotMob enrichment
  fmId?: number;
  photo?: string;
  rating?: number; // this match
  seasonRating?: number;
  marketValue?: number; // EUR
  potm?: boolean;
  age?: number;
  nationality?: string;
  /** This match, from FotMob: minutes, xG, xA... */
  fm?: Record<string, number>;
};

export type Absentee = { name: string; id?: string; fmId?: number; photo?: string; status: "out" | "doubt" | "suspended"; reason?: string; returns?: string; role?: LineupPlayer["role"]; seasonRating?: number; marketValue?: number };

export type Lineup = {
  status: "official" | "probable" | "none";
  formation?: string;
  basis?: string; // probable XI: how it was derived
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  kit?: { color: string; alt?: string };
  coach?: { name: string; fmId?: number; photo?: string; age?: number; country?: string };
  unavailable: Absentee[];
  rating?: number; // FotMob team rating
  avgAge?: number;
  value?: number; // starting XI market value, EUR
  /** What each source called the formation, when they differ it's worth saying. */
  formationSources?: { espn?: string; fotmob?: string };
};

export type ShapeInfo = {
  today?: string;
  sources: { espn?: string; fotmob?: string };
  disagree: boolean;
  /** Recent matches (any competition FotMob covers), newest first. */
  recent: { matchId: string; date: string; opponent: string; comp: string; home: boolean; formation?: string; result?: "W" | "D" | "L"; score?: string }[];
  counts: { formation: string; count: number }[];
  usual?: string;
  changedFromUsual: boolean;
  /** Our read from recent lineups; the coach note has the human one. */
  fluidity?: "fixed" | "variable" | "fluid";
  outOfPosition: { playerId: string; name: string; slot: string; natural: string[]; kind: "position" | "flank" }[];
  /** Per starter: natural positions and where they've lined up lately. */
  players: Record<string, { natural: string[]; recent: { slot: string; count: number }[] }>;
  changes: { minute: string; text: string }[];
  coach?: { base?: string; in_possession?: string; out_of_possession?: string; roles?: string[]; fluidity?: string; confidence?: string };
};

export type MatchEvent = {
  minute: string;
  sort: number; // seconds, for ordering
  side?: Side;
  type: "goal" | "pen-goal" | "own-goal" | "pen-miss" | "yellow" | "second-yellow" | "red" | "sub" | "var" | "period";
  text: string; // short label
  detail?: string; // full commentary sentence
  player?: string;
  playerId?: string;
  other?: string; // assist / player off
  score?: string; // after a goal: "2-1"
};

export type Shot = {
  side: Side;
  xg?: number;
  minute: string;
  sort: number;
  player?: string;
  x: number; // 0..100 toward the opponent goal
  y: number; // 0..100 across
  outcome: "goal" | "on" | "off" | "blocked";
  text?: string;
};

export type StatRow = { key: string; label: string; home: number; away: number; display?: [string, string]; pct?: boolean };

export type H2HGame = { id: string; date: string; home: string; away: string; homeId: string; awayId: string; score: string; comp?: string; winnerId?: string };

export type Odds = {
  provider: string;
  home: number; // implied probability, 0..100, normalised
  draw: number;
  away: number;
  overUnder?: number;
  raw?: { home?: string; draw?: string; away?: string };
};

export type Referee = { name: string; country?: string; matches?: number; yellowsPerGame?: number; redsPerGame?: number; pensPerGame?: number };

export type Weather = { tempC: number; desc: string; windKmh?: number; rainPct?: number; icon: "sun" | "cloud" | "rain" | "snow" | "fog" | "storm" | "partly" };

export type MatchDetail = MatchCard & {
  leagueInfo: League;
  venueInfo?: { name: string; city?: string; capacity?: number; attendance?: number };
  referee?: Referee;
  weather?: Weather;
  odds?: Odds;
  lineups: Record<Side, Lineup>;
  events: MatchEvent[];
  stats: StatRow[];
  shots: Shot[];
  /** Pressure by minute: positive = home on top. */
  momentum: { minute: number; value: number }[];
  h2h: { summary?: string; games: H2HGame[] };
  commentary: { minute: string; text: string; type?: string }[];
  clockSeconds?: number;
  period?: number;
  /** FotMob match xG when available. */
  xg?: Record<Side, number>;
  insights: { text: string; side?: Side }[];
  fm?: { matchId: string; teamIds: Record<Side, number> };
  /** "estimate" when the pressure curve is our own (ESPN commentary), "fotmob" when it's FotMob's. */
  momentumSource?: "fotmob" | "estimate";
  h2hAllTime?: { home: number; draw: number; away: number };
  shape?: Partial<Record<Side, ShapeInfo>>;
};

// ---------- standings ----------

export type TableRow = {
  rank: number;
  teamId: string;
  name: string;
  abbr: string;
  logo: string;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  zone?: { label: string; color: string };
  form?: string;
};

export type Table = { league: string; name: string; groups: { name?: string; rows: TableRow[] }[] };

// ---------- teams ----------

export type FixtureRow = {
  id: string;
  date: string;
  league: string; // ESPN slug when known
  comp: string; // display name
  opponent: { id: string; name: string; abbr: string; logo: string };
  home: boolean;
  state: MatchState;
  score?: string; // from this team's perspective "2-1"
  result?: "W" | "D" | "L";
};

export type Injury = { status: "out" | "doubt" | "suspended"; reason?: string; returns?: string };

export type SquadPlayer = {
  id: string;
  name: string;
  short: string;
  jersey?: string;
  role: "G" | "D" | "M" | "F";
  position?: string; // detailed: "Centre-Back", "Left Winger"
  age?: number;
  nationality?: string;
  flag?: string;
  photo?: string;
  heightCm?: number;
  // this season, this competition (ESPN)
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  shots: number;
  sot: number;
  yc: number;
  rc: number;
  saves?: number;
  conceded?: number;
  minutes?: number;
  // enrichment
  xg?: number;
  xa?: number;
  marketValue?: number; // EUR
  contractUntil?: string;
  injury?: Injury;
  /** Starts in the team's last N matches across all competitions. */
  recentStarts?: number;
  importance: number; // 0..100
  rating?: number; // season average rating if available
  fmId?: number;
  tmId?: string;
};

export type Coach = {
  name: string;
  photo?: string;
  nationality?: string;
  age?: number;
  appointed?: string;
  contractUntil?: string;
  record?: { games: number; w: number; d: number; l: number; ppg?: number };
  previous?: { club: string; from?: string; to?: string; games?: number; ppg?: number }[];
  trophies?: { title: string; count: number; years?: string }[];
  formation?: string; // most used this season
  formations?: { formation: string; count: number }[];
  style?: string;
  knownFor?: string;
  source?: string;
};

export type ClubLore = {
  nickname?: string;
  founded?: number;
  stadium?: string;
  capacity?: number;
  identity?: string;
  history?: string;
  honours?: { title: string; count: number; last?: number }[];
  rivals?: string[];
  legends?: string[];
};

export type TeamDetail = {
  id: string;
  league: string; // the club's own league (differs from the match's in Europe and cups)
  leagueName: string;
  name: string;
  short: string;
  abbr: string;
  logo: string;
  color: string;
  altColor: string;
  standing?: TableRow & { of: number };
  coach?: Coach;
  squad: SquadPlayer[];
  results: FixtureRow[];
  fixtures: FixtureRow[];
  load: { daysRest?: number; daysToNext?: number; last?: FixtureRow; next?: FixtureRow; last30: number };
  xg?: { for: number; against: number; games: number; rankFor?: number; rankAgainst?: number; recent: { date: string; xg: number; xga: number; opp: string; result?: string }[] };
  squadValue?: { total: number; rank?: number; avgAge?: number };
  lore?: ClubLore;
  news: { headline: string; description?: string; published?: string; link?: string; image?: string }[];
  /** League-season profile with ranks (FotMob): xG, goals per match, possession... */
  profile: { key: string; label: string; value: number; display: string; rank?: number }[];
  leagueSize?: number;
  venue?: { name: string; city?: string; capacity?: number; opened?: number };
  honours: { title: string; count: number; last?: string }[];
  fmId?: number;
  tmId?: string;
  /** Last few matches' starting XIs (all competitions), newest first. */
  recentXIs: { matchId: string; date: string; comp: string; opponent: string; formation?: string; starters: string[] }[];
};

/** How a player arrived at a club (Transfermarkt). fee 0 = free transfer; no fee = undisclosed or not applicable. */
export type Transfer = { date: string; fee?: number; kind: "transfer" | "loan" | "free" | "youth" | "return"; marketValue?: number; /** Loan made permanent during the spell. */ boughtFor?: number };

// ---------- leaders ----------

export type LeaderRow = { name: string; fmId?: number; tmId?: string; photo?: string; value: number; teamRank: number; leagueRank?: number };
export type LeaderBoard = {
  key: string;
  label: string; // "Goals"
  unit: string; // "goals", shown after the number
  format: "int" | "dec1" | "dec2" | "eur";
  source: "FotMob" | "Transfermarkt";
  /** Players ranked in the league list (FotMob lists have a minutes threshold for per-90 and rating). */
  leagueSize: number;
  rows: LeaderRow[];
};
export type TeamLeaders = { league: string; leagueName: string; boards: LeaderBoard[] };

export type PlayerDetail = {
  id: string;
  name: string;
  jersey?: string;
  position?: string;
  positions?: string[];
  age?: number;
  dob?: string;
  nationality?: string;
  heightCm?: number;
  foot?: string;
  photo?: string;
  team?: { name: string; logo?: string };
  marketValue?: number;
  contractUntil?: string;
  injury?: { reason?: string; returns?: string };
  /** This season per competition. */
  season: { comp: string; apps?: number; starts?: number; minutes?: number; goals?: number; assists?: number; rating?: number; shots?: number; sot?: number; yc?: number; rc?: number }[];
  recent: { date: string; comp: string; opponent: string; home: boolean; score?: string; result?: "W" | "D" | "L"; minutes?: number; goals?: number; assists?: number; rating?: number; potm?: boolean; bench?: boolean }[];
  career: { club: string; from?: string; to?: string; apps?: number; goals?: number; assists?: number; loan?: boolean; transfer?: Transfer }[];
  international?: { team: string; apps?: number; goals?: number };
  /** Percentiles vs same position, 0..1. */
  traits?: { title: string; items: { label: string; value: number }[] };
  trophies: { title: string; count: number }[];
  news: { headline: string; published?: string; link?: string }[];
};
