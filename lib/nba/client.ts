// NBA Stats API client — mirrors what nba_api Python package does under the hood
// Base URL: https://stats.nba.com/stats/

const NBA_BASE = "https://stats.nba.com/stats";

const NBA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
  Connection: "keep-alive",
};

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

export interface GameLog {
  gameId: string;
  gameDate: string;
  teamAbbr: string;
  matchup: string;
  wl: string;
  pts: number;
  fga: number;
  oreb: number;
  tov: number;
  fta: number;
  netRating?: number;
  poss?: number;
}

// Fetch league game log for a season and compute rolling team stats
export async function fetchTeamRollingStats(
  season = "2025-26"
): Promise<Map<string, TeamStats>> {
  try {
    const url = `${NBA_BASE}/leaguegamelog?Counter=1000&Direction=DESC&LeagueID=00&PlayerOrTeam=T&Season=${season}&SeasonType=Regular+Season&Sorter=DATE`;

    const res = await fetch(url, {
      headers: NBA_HEADERS,
      next: { revalidate: 3600 }, // Cache 1h
      signal: AbortSignal.timeout(4000), // Fail fast — fall back to mock data
    });

    if (!res.ok) throw new Error(`NBA API ${res.status}`);

    const data = await res.json();
    const headers: string[] = data.resultSets[0].headers;
    const rows: unknown[][] = data.resultSets[0].rowSet;

    const idx = (col: string) => headers.indexOf(col);

    // Parse all rows into game logs
    const games: GameLog[] = rows.map((row) => ({
      gameId: String(row[idx("GAME_ID")]),
      gameDate: String(row[idx("GAME_DATE")]),
      teamAbbr: String(row[idx("TEAM_ABBREVIATION")]),
      matchup: String(row[idx("MATCHUP")]),
      wl: String(row[idx("WL")]),
      pts: Number(row[idx("PTS")]),
      fga: Number(row[idx("FGA")]),
      oreb: Number(row[idx("OREB")]),
      tov: Number(row[idx("TOV")]),
      fta: Number(row[idx("FTA")]),
    }));

    // Build opponent lookup for defensive rating
    const gameMap = new Map<string, GameLog[]>();
    for (const g of games) {
      if (!gameMap.has(g.gameId)) gameMap.set(g.gameId, []);
      gameMap.get(g.gameId)!.push(g);
    }

    // Compute per-game stats
    for (const g of games) {
      g.poss = g.fga - g.oreb + g.tov + 0.44 * g.fta;
      const gamePair = gameMap.get(g.gameId);
      const opp = gamePair?.find((x) => x.teamAbbr !== g.teamAbbr);
      if (opp && g.poss > 0) {
        const offRtg = (g.pts / g.poss) * 100;
        const oppPoss = opp.fga - opp.oreb + opp.tov + 0.44 * opp.fta;
        const defRtg = oppPoss > 0 ? (opp.pts / g.poss) * 100 : 100;
        g.netRating = offRtg - defRtg;
      }
    }

    // Group by team, sort chronologically (oldest first)
    const byTeam = new Map<string, GameLog[]>();
    for (const g of games) {
      if (!byTeam.has(g.teamAbbr)) byTeam.set(g.teamAbbr, []);
      byTeam.get(g.teamAbbr)!.push(g);
    }

    const result = new Map<string, TeamStats>();

    for (const [abbr, teamGames] of byTeam) {
      const sorted = [...teamGames].sort(
        (a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()
      );

      const wins = sorted.filter((g) => g.wl === "W").length;
      const losses = sorted.filter((g) => g.wl === "L").length;
      const total = wins + losses;

      const last20 = sorted.slice(-20);
      const last10 = sorted.slice(-10);

      const rollNetRtg =
        last20
          .filter((g) => g.netRating !== undefined)
          .reduce((sum, g) => sum + (g.netRating ?? 0), 0) /
        Math.max(last20.filter((g) => g.netRating !== undefined).length, 1);

      const rollPoss =
        last20
          .filter((g) => g.poss !== undefined)
          .reduce((sum, g) => sum + (g.poss ?? 0), 0) /
        Math.max(last20.filter((g) => g.poss !== undefined).length, 1);

      const last10WinPct =
        last10.filter((g) => g.wl === "W").length / Math.max(last10.length, 1);

      result.set(abbr, {
        abbreviation: abbr,
        name: TEAM_NAMES[abbr] ?? abbr,
        wins,
        losses,
        winPct: total > 0 ? wins / total : 0,
        netRating: rollNetRtg,
        offRating: 0, // simplified
        defRating: 0,
        pace: rollPoss,
        last10WinPct,
        rollNetRtg,
        rollPoss,
      });
    }

    return result;
  } catch (err) {
    console.error("NBA API error:", err);
    return getFallbackStats();
  }
}

// Fetch league standings
export async function fetchStandings(
  season = "2025-26"
): Promise<{ east: TeamStats[]; west: TeamStats[] }> {
  try {
    const url = `${NBA_BASE}/leaguestandingsv3?LeagueID=00&Season=${season}&SeasonType=Regular+Season&SeasonYear=${season}`;
    const res = await fetch(url, {
      headers: NBA_HEADERS,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Standings API ${res.status}`);

    const data = await res.json();
    const headers: string[] = data.resultSets[0].headers;
    const rows: unknown[][] = data.resultSets[0].rowSet;
    const idx = (col: string) => headers.indexOf(col);

    const east: TeamStats[] = [];
    const west: TeamStats[] = [];

    for (const row of rows) {
      const conf = String(row[idx("Conference")]);
      const abbr = String(row[idx("TeamSlug")])
        .toUpperCase()
        .slice(0, 3) as string;
      const stats: TeamStats = {
        abbreviation: abbr,
        name: String(row[idx("TeamName")]),
        wins: Number(row[idx("WINS")]),
        losses: Number(row[idx("LOSSES")]),
        winPct: Number(row[idx("WinPct")]),
        netRating: Number(row[idx("NetRating")] ?? 0),
        offRating: Number(row[idx("OffRating")] ?? 0),
        defRating: Number(row[idx("DefRating")] ?? 0),
        pace: Number(row[idx("Pace")] ?? 0),
        last10WinPct: 0,
        rollNetRtg: Number(row[idx("NetRating")] ?? 0),
        rollPoss: Number(row[idx("Pace")] ?? 0),
      };
      if (conf === "East") east.push(stats);
      else west.push(stats);
    }

    return { east, west };
  } catch {
    return { east: [], west: [] };
  }
}

// ── Fallback / mock data for when NBA API is unreachable ──────────────────────
function getFallbackStats(): Map<string, TeamStats> {
  const data: Record<
    string,
    Omit<TeamStats, "abbreviation" | "name" | "offRating" | "defRating">
  > = {
    BOS: {
      wins: 47, losses: 20, winPct: 0.701, netRating: 9.2,
      pace: 98.1, last10WinPct: 0.7, rollNetRtg: 9.2, rollPoss: 98.1,
    },
    OKC: {
      wins: 50, losses: 14, winPct: 0.781, netRating: 11.5,
      pace: 99.3, last10WinPct: 0.9, rollNetRtg: 11.5, rollPoss: 99.3,
    },
    CLE: {
      wins: 49, losses: 17, winPct: 0.742, netRating: 8.7,
      pace: 96.8, last10WinPct: 0.8, rollNetRtg: 8.7, rollPoss: 96.8,
    },
    GSW: {
      wins: 35, losses: 34, winPct: 0.507, netRating: 1.2,
      pace: 100.4, last10WinPct: 0.5, rollNetRtg: 1.2, rollPoss: 100.4,
    },
    LAL: {
      wins: 38, losses: 31, winPct: 0.551, netRating: 2.8,
      pace: 98.9, last10WinPct: 0.6, rollNetRtg: 2.8, rollPoss: 98.9,
    },
    MIA: {
      wins: 28, losses: 41, winPct: 0.406, netRating: -3.1,
      pace: 97.5, last10WinPct: 0.3, rollNetRtg: -3.1, rollPoss: 97.5,
    },
    NYK: {
      wins: 39, losses: 29, winPct: 0.574, netRating: 3.4,
      pace: 95.2, last10WinPct: 0.6, rollNetRtg: 3.4, rollPoss: 95.2,
    },
    DEN: {
      wins: 37, losses: 32, winPct: 0.536, netRating: 2.1,
      pace: 100.1, last10WinPct: 0.4, rollNetRtg: 2.1, rollPoss: 100.1,
    },
    MIN: {
      wins: 41, losses: 27, winPct: 0.603, netRating: 4.8,
      pace: 97.7, last10WinPct: 0.7, rollNetRtg: 4.8, rollPoss: 97.7,
    },
    SAC: {
      wins: 33, losses: 36, winPct: 0.478, netRating: -0.5,
      pace: 102.3, last10WinPct: 0.4, rollNetRtg: -0.5, rollPoss: 102.3,
    },
    PHX: {
      wins: 30, losses: 39, winPct: 0.435, netRating: -1.8,
      pace: 99.6, last10WinPct: 0.4, rollNetRtg: -1.8, rollPoss: 99.6,
    },
    MIL: {
      wins: 32, losses: 37, winPct: 0.464, netRating: -0.9,
      pace: 98.4, last10WinPct: 0.5, rollNetRtg: -0.9, rollPoss: 98.4,
    },
    IND: {
      wins: 38, losses: 30, winPct: 0.559, netRating: 3.6,
      pace: 103.8, last10WinPct: 0.6, rollNetRtg: 3.6, rollPoss: 103.8,
    },
    PHI: {
      wins: 22, losses: 47, winPct: 0.319, netRating: -6.2,
      pace: 97.1, last10WinPct: 0.2, rollNetRtg: -6.2, rollPoss: 97.1,
    },
    MEM: {
      wins: 36, losses: 33, winPct: 0.522, netRating: 1.4,
      pace: 100.8, last10WinPct: 0.5, rollNetRtg: 1.4, rollPoss: 100.8,
    },
    DAL: {
      wins: 31, losses: 38, winPct: 0.449, netRating: -1.2,
      pace: 99.0, last10WinPct: 0.4, rollNetRtg: -1.2, rollPoss: 99.0,
    },
    NOP: {
      wins: 18, losses: 51, winPct: 0.261, netRating: -8.3,
      pace: 98.2, last10WinPct: 0.2, rollNetRtg: -8.3, rollPoss: 98.2,
    },
    TOR: {
      wins: 19, losses: 50, winPct: 0.275, netRating: -7.9,
      pace: 97.4, last10WinPct: 0.2, rollNetRtg: -7.9, rollPoss: 97.4,
    },
    ATL: {
      wins: 25, losses: 44, winPct: 0.362, netRating: -4.5,
      pace: 101.0, last10WinPct: 0.3, rollNetRtg: -4.5, rollPoss: 101.0,
    },
    WAS: {
      wins: 14, losses: 55, winPct: 0.203, netRating: -11.2,
      pace: 98.7, last10WinPct: 0.1, rollNetRtg: -11.2, rollPoss: 98.7,
    },
    CHA: {
      wins: 16, losses: 53, winPct: 0.232, netRating: -9.8,
      pace: 99.1, last10WinPct: 0.2, rollNetRtg: -9.8, rollPoss: 99.1,
    },
    HOU: {
      wins: 42, losses: 26, winPct: 0.618, netRating: 5.1,
      pace: 98.5, last10WinPct: 0.7, rollNetRtg: 5.1, rollPoss: 98.5,
    },
    SAS: {
      wins: 27, losses: 41, winPct: 0.397, netRating: -3.8,
      pace: 97.9, last10WinPct: 0.3, rollNetRtg: -3.8, rollPoss: 97.9,
    },
    CHI: {
      wins: 26, losses: 43, winPct: 0.377, netRating: -4.1,
      pace: 98.3, last10WinPct: 0.4, rollNetRtg: -4.1, rollPoss: 98.3,
    },
    DET: {
      wins: 27, losses: 42, winPct: 0.391, netRating: -3.5,
      pace: 99.4, last10WinPct: 0.4, rollNetRtg: -3.5, rollPoss: 99.4,
    },
    ORL: {
      wins: 35, losses: 33, winPct: 0.515, netRating: 0.8,
      pace: 96.3, last10WinPct: 0.5, rollNetRtg: 0.8, rollPoss: 96.3,
    },
    BKN: {
      wins: 17, losses: 52, winPct: 0.246, netRating: -10.1,
      pace: 99.8, last10WinPct: 0.2, rollNetRtg: -10.1, rollPoss: 99.8,
    },
    POR: {
      wins: 20, losses: 48, winPct: 0.294, netRating: -7.2,
      pace: 99.2, last10WinPct: 0.3, rollNetRtg: -7.2, rollPoss: 99.2,
    },
    UTA: {
      wins: 18, losses: 50, winPct: 0.265, netRating: -8.7,
      pace: 97.5, last10WinPct: 0.2, rollNetRtg: -8.7, rollPoss: 97.5,
    },
    LAC: {
      wins: 30, losses: 39, winPct: 0.435, netRating: -1.5,
      pace: 98.6, last10WinPct: 0.4, rollNetRtg: -1.5, rollPoss: 98.6,
    },
  };

  const map = new Map<string, TeamStats>();
  for (const [abbr, stats] of Object.entries(data)) {
    map.set(abbr, {
      ...stats,
      abbreviation: abbr,
      name: TEAM_NAMES[abbr] ?? abbr,
      offRating: 0,
      defRating: 0,
    });
  }
  return map;
}

export const TEAM_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "LA Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

// Resolve user input (e.g. "Lakers", "LAL", "los angeles lakers") → abbreviation
export function resolveTeam(input: string): string | null {
  const upper = input.trim().toUpperCase();
  if (TEAM_NAMES[upper]) return upper;

  const lower = input.toLowerCase();
  for (const [abbr, name] of Object.entries(TEAM_NAMES)) {
    if (name.toLowerCase().includes(lower) || abbr.toLowerCase() === lower) {
      return abbr;
    }
  }

  // Common nicknames
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
