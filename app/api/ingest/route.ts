// One-time endpoint to ingest NBA game logs into Weaviate
// Call: POST /api/ingest  (protected by INGEST_SECRET env var)
// This populates the vector DB with 3 seasons of game summaries

import { NextResponse } from "next/server";
import { fetchTeamRollingStats } from "@/lib/nba/client";
import { ingestDocuments, type GameDocument } from "@/lib/rag/client";

export async function POST(req: Request) {
  const secret = req.headers.get("x-ingest-secret");
  if (secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const seasons = ["2022-23", "2023-24", "2024-25"];
    const allDocs: GameDocument[] = [];

    for (const season of seasons) {
      const stats = await fetchTeamRollingStats(season);
      // Generate synthetic game documents from rolling stats
      // (In production you'd fetch actual game-by-game logs)
      for (const [abbr, teamStats] of stats) {
        const doc: GameDocument = {
          gameId: `synthetic-${season}-${abbr}`,
          gameDate: season.split("-")[0] + "-12-01",
          homeTeam: abbr,
          awayTeam: "AVG",
          homeScore: Math.round(110 + teamStats.netRating),
          awayScore: 110,
          season,
          homeNetRtg: teamStats.rollNetRtg,
          awayNetRtg: 0,
          summary: `${teamStats.name} ${season} season summary: ${teamStats.wins}W-${teamStats.losses}L record, ` +
            `${(teamStats.winPct * 100).toFixed(1)}% win rate, ` +
            `net rating ${teamStats.rollNetRtg.toFixed(1)}, ` +
            `pace ${teamStats.rollPoss.toFixed(1)} possessions per game.`,
        };
        allDocs.push(doc);
      }
    }

    const count = await ingestDocuments(allDocs);
    return NextResponse.json({ ingested: count, total: allDocs.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
