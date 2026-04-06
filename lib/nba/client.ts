// NBA data client
// Primary:   ESPN API (fast, no auth, real live data)
// Secondary: stats.nba.com (more accurate rolling stats, slower)
// Fallback:  hardcoded season snapshot (last resort)

export interface TeamStats {
  abbreviation: string;
  name: string;
  wins: number;
  losses: number;
  winPct: number;
  netRating: number;
  offRating: number;
  defRating: number;
  pace: number;
  last10WinPct: number;
  rollNetRtg: number;
  rollPoss: number;
}

// ── ESPN API ──────────────────────────────────────────────────────────────────
// No auth required. Returns real live standings with W/L, last-10, pts for/against.

const ESPN_STANDINGS =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/standings";

async function fetchFromESPN(): Promise<Map<string, TeamStats>> {
  const res = await fetch(ESPN_STANDINGS, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);

  const data = await res.json();
  const result = new Map<string, TeamStats>();

  for (const group of data.groups ?? []) {
    for (const entry of group.standings?.entries ?? []) {
      const abbr: string = entry.team?.abbreviation?.toUpperCase();
      if (!abbr) continue;

      // Build a quick lookup from the stats array
      const statsArr: { name: string; value: number }[] = entry.stats ?? [];
      const stat = (name: string) =>
        statsArr.find((s: { name: string }) => s.name === name)?.value ?? 0;

      const wins = Math.round(stat("wins"));
      const losses = Math.round(stat("losses"));
      const total = wins + losses;
      const last10Wins = Math.round(stat("last10Wins") || stat("Last10Wins"));
      const last10Losses = Math.round(stat("last10Losses") || stat("Last10Losses"));
      const last10Total = last10Wins + last10Losses || 10;

      // Point differential per game ≈ proxy for net rating
      const ptsFor = stat("pointsFor") || stat("avgPointsFor");
      const ptsAgainst = stat("pointsAgainst") || stat("avgPointsAgainst");
      const pointDiff = ptsFor > 0 && ptsAgainst > 0 ? ptsFor - ptsAgainst : 0;

      // Pace varies ~95-105; use league average unless we have it
      const pace = stat("pace") || 98.5;

      result.set(abbr, {
        abbreviation: abbr,
        name: entry.team?.displayName ?? TEAM_NAMES[abbr] ?? abbr,
        wins,
        losses,
        winPct: total > 0 ? wins / total : 0,
        netRating: pointDiff,
        offRating: ptsFor,
        defRating: ptsAgainst,
        pace,
        last10WinPct: last10Wins / last10Total,
        rollNetRtg: pointDiff,
        rollPoss: pace,
      });
    }
  }

  if (result.size < 25) throw new Error("ESPN returned incomplete data");
  return result;
}

// ── NBA Stats API ─────────────────────────────────────────────────────────────
// More precise rolling stats, but slow/flaky from serverless.

const NBA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

async function fetchFromNBAStats(
  season: string
): Promise<Map<string, TeamStats>> {
  const url = `https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`;

  const res = await fetch(url, {
    headers: NBA_HEADERS,
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`NBA Stats ${res.status}`);

  const data = await res.json();
  const headers: string[] = data.resultSets[0].headers;
  const rows: unknown[][] = data.resultSets[0].rowSet;
  const idx = (col: string) => headers.indexOf(col);

  const result = new Map<string, TeamStats>();

  // Also fetch last-10 records
  const last10Url = `https://stats.nba.com/stats/leaguedashteamstats?LastNGames=10&LeagueID=00&MeasureType=Base&PerMode=PerGame&Season=${season}&SeasonType=Regular+Season`;
  let last10Map = new Map<string, number>();
  try {
    const r2 = await fetch(last10Url, {
      headers: NBA_HEADERS,
      signal: AbortSignal.timeout(3000),
    });
    if (r2.ok) {
      const d2 = await r2.json();
      const h2: string[] = d2.resultSets[0].headers;
      const r2rows: unknown[][] = d2.resultSets[0].rowSet;
      const teamIdx = h2.indexOf("TEAM_ABBREVIATION");
      const wIdx = h2.indexOf("W_PCT");
      for (const row of r2rows) {
        last10Map.set(String(row[teamIdx]), Number(row[wIdx]));
      }
    }
  } catch {
    // ignore, will use win% as proxy
  }

  for (const row of rows) {
    const abbr = String(row[idx("TEAM_ABBREVIATION")]);
    const netRtg = Number(row[idx("NET_RATING")]);
    const pace = Number(row[idx("PACE")]);
    const wins = Number(row[idx("W")]);
    const losses = Number(row[idx("L")]);
    const winPct = Number(row[idx("W_PCT")]);
    const offRtg = Number(row[idx("OFF_RATING")]);
    const defRtg = Number(row[idx("DEF_RATING")]);
    const last10WinPct = last10Map.get(abbr) ?? winPct;

    result.set(abbr, {
      abbreviation: abbr,
      name: TEAM_NAMES[abbr] ?? abbr,
      wins,
      losses,
      winPct,
      netRating: netRtg,
      offRating: offRtg,
      defRating: defRtg,
      pace,
      last10WinPct,
      rollNetRtg: netRtg,
      rollPoss: pace,
    });
  }

  if (result.size < 25) throw new Error("NBA Stats returned incomplete data");
  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchTeamRollingStats(
  season = "2025-26"
): Promise<Map<string, TeamStats>> {
  // Try ESPN first (fast, no auth)
  try {
    const stats = await fetchFromESPN();
    console.log(`ESPN: loaded ${stats.size} teams`);
    return stats;
  } catch (err) {
    console.warn("ESPN failed:", err);
  }

  // Try NBA Stats API second
  try {
    const stats = await fetchFromNBAStats(season);
    console.log(`NBA Stats: loaded ${stats.size} teams`);
    return stats;
  } catch (err) {
    console.warn("NBA Stats failed:", err);
  }

  // Last resort: hardcoded snapshot
  console.warn("Using hardcoded fallback stats");
  return getHardcodedStats();
}

export async function fetchStandings(
  _season = "2025-26"
): Promise<{ east: TeamStats[]; west: TeamStats[] }> {
  try {
    const allStats = await fetchTeamRollingStats(_season);

    // ESPN groups by conference; we split using known conference membership
    const east: TeamStats[] = [];
    const west: TeamStats[] = [];

    for (const [abbr, stats] of allStats) {
      if (EASTERN_CONF.has(abbr)) east.push(stats);
      else west.push(stats);
    }

    east.sort((a, b) => b.winPct - a.winPct);
    west.sort((a, b) => b.winPct - a.winPct);

    return { east, west };
  } catch {
    return { east: [], west: [] };
  }
}

const EASTERN_CONF = new Set([
  "ATL", "BOS", "BKN", "CHA", "CHI",
  "CLE", "DET", "IND", "MIA", "MIL",
  "NYK", "ORL", "PHI", "TOR", "WAS",
]);

// ── Hardcoded 2024-25 final standings (last-resort fallback) ──────────────────
function getHardcodedStats(): Map<string, TeamStats> {
  // Source: NBA.com 2024-25 final regular season standings
  const data: [string, number, number, number, number, number][] = [
    // [abbr, wins, losses, netRating, pace, last10WinPct]
    ["OKC", 68, 14, 11.9, 100.1, 0.9],
    ["CLE", 64, 18,  9.4,  97.2, 0.8],
    ["BOS", 61, 21,  9.3,  99.6, 0.7],
    ["NYK", 51, 31,  4.5,  95.9, 0.6],
    ["IND", 50, 32,  3.8, 104.1, 0.5],
    ["MIL", 49, 33,  3.2,  99.3, 0.6],
    ["MIA", 48, 34,  2.3,  98.1, 0.5],
    ["CHI", 39, 43, -2.1,  99.0, 0.4],
    ["ATL", 35, 47, -4.1, 101.1, 0.4],
    ["TOR", 30, 52, -6.3,  97.5, 0.3],
    ["CHA", 19, 63,-10.3,  99.4, 0.2],
    ["WAS", 18, 64,-11.0,  99.7, 0.2],
    ["PHI", 24, 58, -7.8,  98.0, 0.2],
    ["DET", 27, 55, -6.1, 100.4, 0.3],
    ["BKN", 22, 60, -9.5, 100.5, 0.2],
    ["MIN", 56, 26,  6.7,  98.5, 0.7],
    ["HOU", 52, 30,  4.7,  98.8, 0.6],
    ["LAL", 50, 32,  4.0,  99.7, 0.6],
    ["GSW", 48, 34,  2.6, 100.9, 0.5],
    ["MEM", 46, 36,  2.0, 101.2, 0.5],
    ["DEN", 50, 32,  5.2, 100.4, 0.5],
    ["NOP", 21, 61, -8.7,  98.4, 0.2],
    ["SAC", 38, 44, -0.7, 102.7, 0.4],
    ["PHX", 36, 46, -1.5, 100.2, 0.4],
    ["LAC", 40, 42,  0.2,  99.1, 0.5],
    ["DAL", 39, 43, -0.5,  99.8, 0.4],
    ["SAS", 34, 48, -2.9,  98.6, 0.4],
    ["UTA", 26, 56, -7.3,  98.3, 0.3],
    ["POR", 21, 61, -9.2,  99.9, 0.2],
    ["ORL", 41, 41,  0.9,  96.7, 0.5],
  ];

  const map = new Map<string, TeamStats>();
  for (const [abbr, w, l, net, pace, l10] of data) {
    map.set(abbr, {
      abbreviation: abbr,
      name: TEAM_NAMES[abbr] ?? abbr,
      wins: w,
      losses: l,
      winPct: w / (w + l),
      netRating: net,
      offRating: 0,
      defRating: 0,
      pace,
      last10WinPct: l10,
      rollNetRtg: net,
      rollPoss: pace,
    });
  }
  return map;
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export const TEAM_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks",    BOS: "Boston Celtics",     BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets", CHI: "Chicago Bulls",    CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks", DEN: "Denver Nuggets",    DET: "Detroit Pistons",
  GSW: "Golden State Warriors", HOU: "Houston Rockets", IND: "Indiana Pacers",
  LAC: "LA Clippers",      LAL: "Los Angeles Lakers", MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",       MIL: "Milwaukee Bucks",   MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans", NYK: "New York Knicks", OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",    PHI: "Philadelphia 76ers", PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers", SAC: "Sacramento Kings", SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",  UTA: "Utah Jazz",          WAS: "Washington Wizards",
};

export function resolveTeam(input: string): string | null {
  const upper = input.trim().toUpperCase();
  if (TEAM_NAMES[upper]) return upper;

  const lower = input.toLowerCase();
  for (const [abbr, name] of Object.entries(TEAM_NAMES)) {
    if (name.toLowerCase().includes(lower)) return abbr;
  }

  const nicknames: Record<string, string> = {
    CELTICS: "BOS", LAKERS: "LAL", WARRIORS: "GSW", HEAT: "MIA",
    NETS: "BKN", KNICKS: "NYK", BULLS: "CHI", BUCKS: "MIL",
    SUNS: "PHX", NUGGETS: "DEN", CLIPPERS: "LAC", THUNDER: "OKC",
    TIMBERWOLVES: "MIN", WOLVES: "MIN", SIXERS: "PHI", "76ERS": "PHI",
    RAPTORS: "TOR", HAWKS: "ATL", HORNETS: "CHA", PACERS: "IND",
    CAVALIERS: "CLE", CAVS: "CLE", PISTONS: "DET", GRIZZLIES: "MEM",
    GRIZZ: "MEM", JAZZ: "UTA", KINGS: "SAC", PELICANS: "NOP",
    MAGIC: "ORL", TRAIL: "POR", BLAZERS: "POR", ROCKETS: "HOU",
    MAVS: "DAL", MAVERICKS: "DAL", SPURS: "SAS",
  };
  return nicknames[upper] ?? null;
}
