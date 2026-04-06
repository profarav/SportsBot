// Weaviate RAG client
// Stores 3 seasons of NBA game logs as vector-searchable documents
// Uses Weaviate Cloud (free tier available at console.weaviate.cloud)

import weaviate, { type WeaviateClient } from "weaviate-client";

let _client: WeaviateClient | null = null;

export async function getWeaviateClient(): Promise<WeaviateClient | null> {
  if (_client) return _client;

  const url = process.env.WEAVIATE_URL;
  const apiKey = process.env.WEAVIATE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!url || !apiKey) {
    console.warn("Weaviate not configured — RAG disabled");
    return null;
  }

  try {
    _client = await weaviate.connectToWeaviateCloud(url, {
      authCredentials: new weaviate.ApiKey(apiKey),
      headers: openaiKey ? { "X-OpenAI-Api-Key": openaiKey } : {},
    });
    return _client;
  } catch (err) {
    console.error("Weaviate connection failed:", err);
    return null;
  }
}

const COLLECTION = "NBAGameLog";

export interface GameDocument {
  gameId: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  season: string;
  homeNetRtg: number;
  awayNetRtg: number;
  summary: string; // Natural language description for embedding
}

// Ensure the collection exists with text2vec-openai vectorizer
export async function ensureCollection(client: WeaviateClient): Promise<void> {
  const exists = await client.collections.exists(COLLECTION);
  if (exists) return;

  await client.collections.create({
    name: COLLECTION,
    vectorizers: [
      weaviate.configure.vectorizer.text2VecOpenAI({
        name: "default",
        sourceProperties: ["summary"],
      }),
    ],
    properties: [
      { name: "gameId", dataType: "text" as const },
      { name: "gameDate", dataType: "text" as const },
      { name: "homeTeam", dataType: "text" as const },
      { name: "awayTeam", dataType: "text" as const },
      { name: "homeScore", dataType: "number" as const },
      { name: "awayScore", dataType: "number" as const },
      { name: "season", dataType: "text" as const },
      { name: "homeNetRtg", dataType: "number" as const },
      { name: "awayNetRtg", dataType: "number" as const },
      { name: "summary", dataType: "text" as const },
    ],
  });
}

// Semantic search over game logs
export async function searchGameHistory(
  query: string,
  limit = 5
): Promise<GameDocument[]> {
  const client = await getWeaviateClient();
  if (!client) return getFallbackResults(query);

  try {
    const collection = client.collections.get(COLLECTION);
    const result = await collection.query.nearText(query, {
      limit,
      returnProperties: [
        "gameId", "gameDate", "homeTeam", "awayTeam",
        "homeScore", "awayScore", "season", "homeNetRtg", "awayNetRtg", "summary",
      ],
    });

    return result.objects.map((obj) => obj.properties as unknown as GameDocument);
  } catch (err) {
    console.error("Weaviate search error:", err);
    return getFallbackResults(query);
  }
}

// Ingest game documents into Weaviate (called from /api/ingest)
export async function ingestDocuments(docs: GameDocument[]): Promise<number> {
  const client = await getWeaviateClient();
  if (!client) return 0;

  await ensureCollection(client);
  const collection = client.collections.get(COLLECTION);

  let count = 0;
  const batchSize = 100;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await collection.data.insertMany(batch as any);
    count += Object.keys(result.uuids ?? {}).length;
  }
  return count;
}

// Fallback: keyword-based mock results when Weaviate is not configured
function getFallbackResults(query: string): GameDocument[] {
  const q = query.toLowerCase();

  const mockGames: GameDocument[] = [
    {
      gameId: "0022301001",
      gameDate: "2024-01-15",
      homeTeam: "BOS",
      awayTeam: "LAL",
      homeScore: 114,
      awayScore: 105,
      season: "2023-24",
      homeNetRtg: 9.2,
      awayNetRtg: 2.8,
      summary:
        "Boston Celtics beat LA Lakers 114-105. Jayson Tatum scored 32 points with 8 rebounds. The Celtics dominated in the fourth quarter with a +14 net rating differential.",
    },
    {
      gameId: "0022300892",
      gameDate: "2024-02-08",
      homeTeam: "GSW",
      awayTeam: "OKC",
      homeScore: 109,
      awayScore: 120,
      season: "2023-24",
      homeNetRtg: 1.2,
      awayNetRtg: 11.5,
      summary:
        "Oklahoma City Thunder defeated Golden State Warriors 120-109. Shai Gilgeous-Alexander recorded 38 points and 7 assists in a dominant road victory.",
    },
    {
      gameId: "0022201543",
      gameDate: "2023-03-20",
      homeTeam: "MIL",
      awayTeam: "BOS",
      homeScore: 118,
      awayScore: 99,
      season: "2022-23",
      homeNetRtg: 6.8,
      awayNetRtg: 8.5,
      summary:
        "Milwaukee Bucks crushed Boston Celtics 118-99. Giannis Antetokounmpo led with 44 points and 14 rebounds in an MVP-caliber performance.",
    },
    {
      gameId: "0022300445",
      gameDate: "2023-12-02",
      homeTeam: "OKC",
      awayTeam: "DEN",
      homeScore: 130,
      awayScore: 103,
      season: "2023-24",
      homeNetRtg: 10.2,
      awayNetRtg: 5.3,
      summary:
        "Oklahoma City Thunder blew out Denver Nuggets 130-103. The Thunder's defense held Nikola Jokic to 14 points on 5-of-17 shooting.",
    },
    {
      gameId: "0022201200",
      gameDate: "2023-02-14",
      homeTeam: "LAL",
      awayTeam: "GSW",
      homeScore: 128,
      awayScore: 121,
      season: "2022-23",
      homeNetRtg: 1.8,
      awayNetRtg: 3.4,
      summary:
        "LA Lakers defeated Golden State Warriors 128-121 in a classic rivalry game. LeBron James scored 37 points while Anthony Davis had 24 points and 15 rebounds.",
    },
  ];

  // Simple keyword filter
  return mockGames.filter(
    (g) =>
      g.summary.toLowerCase().includes(q.split(" ")[0]) ||
      g.homeTeam.toLowerCase().includes(q) ||
      g.awayTeam.toLowerCase().includes(q) ||
      q.includes("nba") ||
      q.includes("game") ||
      q.includes("season")
  ).slice(0, 3);
}
