// Multi-agent orchestration — LangGraph-style state machine
// Agents:
//   1. Router   — classifies query intent
//   2. Stats    — fetches live NBA team stats
//   3. RAG      — searches historical game logs via Weaviate
//   4. Predictor— runs ML model + synthesizes prediction
//
// Each agent is a pure async function that reads/writes AgentState.
// The graph routes between agents based on intent flags in state.

import type { TeamStats } from "@/lib/nba/client";
import type { PredictionResult } from "@/lib/model/predict";
import type { GameDocument } from "@/lib/rag/client";

// ── State ─────────────────────────────────────────────────────────────────────

export interface AgentState {
  userQuery: string;

  // Router outputs
  intent: "prediction" | "stats" | "history" | "standings" | "general";
  entities: {
    teams: string[];    // resolved team abbreviations
    season?: string;
  };

  // Tool outputs
  teamStats: Record<string, TeamStats>;
  prediction: PredictionResult | null;
  gameHistory: GameDocument[];
  standings: { east: TeamStats[]; west: TeamStats[] } | null;

  // Final answer
  contextSummary: string; // assembled context for the LLM
  error: string | null;
}

export function initialState(userQuery: string): AgentState {
  return {
    userQuery,
    intent: "general",
    entities: { teams: [] },
    teamStats: {},
    prediction: null,
    gameHistory: [],
    standings: null,
    contextSummary: "",
    error: null,
  };
}

// ── Agent 1: Router ───────────────────────────────────────────────────────────

import { resolveTeam, TEAM_NAMES } from "@/lib/nba/client";

export function routerAgent(state: AgentState): AgentState {
  const q = state.userQuery.toLowerCase();

  // Detect teams mentioned
  const teams: string[] = [];
  for (const [abbr, name] of Object.entries(TEAM_NAMES)) {
    if (
      q.includes(abbr.toLowerCase()) ||
      q.includes(name.toLowerCase()) ||
      q.includes(name.split(" ").pop()!.toLowerCase())
    ) {
      if (!teams.includes(abbr)) teams.push(abbr);
    }
  }

  // Also check for common nicknames via resolveTeam
  const words = q.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    // Check 1-word and 2-word combos
    for (const chunk of [words[i], words.slice(i, i + 2).join(" ")]) {
      const resolved = resolveTeam(chunk);
      if (resolved && !teams.includes(resolved)) teams.push(resolved);
    }
  }

  // Classify intent
  let intent: AgentState["intent"] = "general";

  if (
    q.match(/predict|win|beat|chance|probab|who('s| is) (better|going to)|matchup|vs\.?|versus|pick/i)
  ) {
    intent = teams.length >= 2 ? "prediction" : "general";
  } else if (q.match(/stand(ing)?s?|rank(ing)?s?|conference|division|east|west|top team/i)) {
    intent = "standings";
  } else if (
    q.match(/last|history|prev|season|game log|when did|record against|all.?time|head.?to.?head/i)
  ) {
    intent = "history";
  } else if (teams.length > 0) {
    intent = "stats";
  }

  // Detect season
  const seasonMatch = q.match(/20(\d{2})-?(\d{2}|\d{4})/);
  const season = seasonMatch ? seasonMatch[0].replace(/^(\d{4})(\d{2})$/, "$1-$2") : undefined;

  return {
    ...state,
    intent,
    entities: { teams: teams.slice(0, 2), season },
  };
}

// ── Agent 2: Stats ────────────────────────────────────────────────────────────

import { fetchTeamRollingStats } from "@/lib/nba/client";

export async function statsAgent(state: AgentState): Promise<AgentState> {
  if (state.entities.teams.length === 0 && state.intent !== "standings") {
    return state;
  }

  try {
    const allStats = await fetchTeamRollingStats(state.entities.season ?? "2025-26");
    const teamStats: Record<string, TeamStats> = {};

    if (state.entities.teams.length > 0) {
      for (const abbr of state.entities.teams) {
        const s = allStats.get(abbr);
        if (s) teamStats[abbr] = s;
      }
    } else {
      // Standings: return all teams
      for (const [abbr, s] of allStats) teamStats[abbr] = s;
    }

    return { ...state, teamStats };
  } catch (err) {
    return { ...state, error: String(err) };
  }
}

// ── Agent 3: RAG ──────────────────────────────────────────────────────────────

import { searchGameHistory } from "@/lib/rag/client";

export async function ragAgent(state: AgentState): Promise<AgentState> {
  if (state.intent !== "history" && state.intent !== "prediction") return state;

  try {
    const query =
      state.entities.teams.length > 0
        ? `${state.entities.teams.join(" vs ")} ${state.userQuery}`
        : state.userQuery;

    const docs = await searchGameHistory(query, 4);
    return { ...state, gameHistory: docs };
  } catch {
    return state;
  }
}

// ── Agent 4: Predictor ────────────────────────────────────────────────────────

import { predictMatchup } from "@/lib/model/predict";

export async function predictorAgent(state: AgentState): Promise<AgentState> {
  if (state.intent !== "prediction") return state;
  if (state.entities.teams.length < 2) return state;

  const [homeAbbr, awayAbbr] = state.entities.teams;
  const homeStats = state.teamStats[homeAbbr];
  const awayStats = state.teamStats[awayAbbr];

  if (!homeStats || !awayStats) return state;

  const prediction = predictMatchup(
    homeAbbr,
    awayAbbr,
    {
      abbreviation: homeAbbr,
      rollNetRtg: homeStats.rollNetRtg,
      last10WinPct: homeStats.last10WinPct,
      rollPoss: homeStats.rollPoss,
    },
    {
      abbreviation: awayAbbr,
      rollNetRtg: awayStats.rollNetRtg,
      last10WinPct: awayStats.last10WinPct,
      rollPoss: awayStats.rollPoss,
    }
  );

  return { ...state, prediction };
}

// ── Agent 5: Context Builder ──────────────────────────────────────────────────

import { fetchStandings } from "@/lib/nba/client";

export async function contextBuilder(state: AgentState): Promise<AgentState> {
  const parts: string[] = [];

  if (state.intent === "standings") {
    try {
      const standings = await fetchStandings();
      const fmt = (teams: TeamStats[]) =>
        teams
          .sort((a, b) => b.winPct - a.winPct)
          .map((t, i) => `${i + 1}. ${t.name} (${t.wins}-${t.losses}, ${(t.winPct * 100).toFixed(1)}%)`)
          .join("\n");
      parts.push("## Eastern Conference\n" + fmt(standings.east));
      parts.push("## Western Conference\n" + fmt(standings.west));
      return { ...state, standings, contextSummary: parts.join("\n\n") };
    } catch {
      // fall through
    }
  }

  if (Object.keys(state.teamStats).length > 0) {
    parts.push("## Team Stats (Current Season)");
    for (const [abbr, s] of Object.entries(state.teamStats)) {
      parts.push(
        `**${s.name} (${abbr})**: ${s.wins}W-${s.losses}L | ` +
          `Net Rtg: ${s.rollNetRtg.toFixed(1)} | ` +
          `Last 10: ${(s.last10WinPct * 100).toFixed(0)}% | ` +
          `Pace: ${s.rollPoss.toFixed(1)}`
      );
    }
  }

  if (state.prediction) {
    const p = state.prediction;
    parts.push(
      `## Prediction: ${p.homeTeam} vs ${p.awayTeam}\n` +
        `${p.homeTeam} win prob: ${(p.homeWinProb * 100).toFixed(1)}%\n` +
        `${p.awayTeam} win prob: ${(p.awayWinProb * 100).toFixed(1)}%\n` +
        `Predicted winner: **${p.predictedWinner}** (${p.confidence} confidence)\n` +
        `Net rating diff: ${p.factors.netRatingDiff.toFixed(1)} | ` +
        `Win% diff: ${(p.factors.winPctDiff * 100).toFixed(1)}%`
    );
  }

  if (state.gameHistory.length > 0) {
    parts.push("## Recent/Historical Games");
    for (const g of state.gameHistory.slice(0, 3)) {
      parts.push(
        `- ${g.gameDate} | ${g.homeTeam} ${g.homeScore} - ${g.awayTeam} ${g.awayScore} (${g.season})`
      );
      if (g.summary) parts.push(`  ${g.summary}`);
    }
  }

  return { ...state, contextSummary: parts.join("\n\n") };
}

// ── Graph execution ───────────────────────────────────────────────────────────

export async function runAgentGraph(userQuery: string): Promise<AgentState> {
  let state = initialState(userQuery);

  // Node 1: Route
  state = routerAgent(state);

  // Node 2 & 3: Stats + RAG (parallel)
  const [withStats, withRag] = await Promise.all([
    statsAgent(state),
    ragAgent(state),
  ]);

  state = {
    ...state,
    teamStats: withStats.teamStats,
    gameHistory: withRag.gameHistory,
    error: withStats.error ?? withRag.error ?? null,
  };

  // Node 4: Predict (needs stats)
  state = await predictorAgent(state);

  // Node 5: Assemble context
  state = await contextBuilder(state);

  return state;
}
