# SportsBot — Multi-Agent NBA AI Analytics

> Ask anything about the NBA in plain English. Live stats, ML predictions, and semantic search over 3 seasons of game history.

**Deployable to Vercel** · Claude claude-sonnet-4-6 · 64% prediction accuracy

---

## Architecture

```
User Query
    │
    ▼
┌─────────────────────────────────────────────┐
│              Agent Graph (LangGraph-style)   │
│                                             │
│  1. Router Agent  ─── classifies intent     │
│         │                                   │
│    ┌────┴────┐                              │
│    │         │                              │
│  Stats     RAG Agent                        │
│  Agent    (Weaviate)                        │
│    │         │                              │
│    └────┬────┘                              │
│         │                                   │
│  4. Predictor Agent                         │
│     (Logistic Regression, ported to TS)     │
│         │                                   │
│  5. Context Builder → LLM (Claude)          │
└─────────────────────────────────────────────┘
```

## Features

- **Multi-agent routing** — Router classifies queries into `prediction`, `stats`, `history`, or `standings` and activates the right agents in parallel
- **Live NBA data** — Fetches from `stats.nba.com` with rolling 20-game averages; graceful fallback to current-season mock data
- **ML predictions** — Logistic regression trained on 4 features achieving **64% accuracy** (within 3% of Vegas baseline). Coefficients ported directly from `model.pkl`
- **RAG search** — Semantic search over game logs using Weaviate Cloud + OpenAI embeddings
- **Streaming UI** — Real-time streaming with visual prediction probability cards

## Model Details

Logistic regression trained on 3 seasons (2022-25) of NBA game logs:

| Feature | Description |
|---|---|
| `DIFF_ROLL_NET_RTG` | 20-game rolling net rating differential |
| `DIFF_ROLL_WIN_PCT` | 10-game rolling win% differential |
| `HOME` | Home court advantage |
| `DIFF_ROLL_POSS` | 20-game rolling possession differential |

Coefficients extracted from `nba-predictor/model.pkl` and ported to TypeScript in `lib/model/predict.ts`.

## Quickstart

### 1. Clone & install
```bash
git clone https://github.com/your-username/SportsBot
cd SportsBot
npm install
```

### 2. Environment variables
```bash
cp .env.local.example .env.local
# Required: ANTHROPIC_API_KEY
# Optional: WEAVIATE_URL, WEAVIATE_API_KEY, OPENAI_API_KEY
```

### 3. Run locally
```bash
npm run dev   # → http://localhost:3000
```

### 4. Ingest game history into Weaviate (optional)
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "x-ingest-secret: your-ingest-secret"
```

## Deploy to Vercel

```bash
npx vercel --prod
```

Set environment variables in the Vercel dashboard:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key |
| `WEAVIATE_URL` | Optional | Weaviate Cloud cluster URL |
| `WEAVIATE_API_KEY` | Optional | Weaviate API key |
| `OPENAI_API_KEY` | Optional | For Weaviate text2vec embeddings |
| `INGEST_SECRET` | Optional | Protects /api/ingest |

The app works fully without Weaviate — it uses curated fallback game data for RAG queries.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| LLM | Anthropic Claude claude-sonnet-4-6 (streaming) |
| AI SDK | Vercel AI SDK v4 |
| Agent orchestration | LangGraph-style state machine |
| Vector DB | Weaviate Cloud |
| NBA Data | stats.nba.com (same as nba_api Python package) |
| Prediction model | Logistic Regression (TypeScript port of scikit-learn pkl) |
| Deployment | Vercel |

## Repository Structure

```
app/
  page.tsx              ← Chat UI with suggested queries
  api/chat/route.ts     ← Streaming agent endpoint (60s timeout)
  api/ingest/route.ts   ← One-time Weaviate data ingestion
lib/
  agents/graph.ts       ← 5-node multi-agent state machine
  nba/client.ts         ← NBA Stats API client + 30-team fallback
  model/predict.ts      ← Logistic regression (ported from model.pkl)
  rag/client.ts         ← Weaviate vector search + fallback
components/
  Message.tsx           ← Streaming message with markdown rendering
  PredictionBanner.tsx  ← Visual win-probability card
nba-predictor/          ← Original Python ML pipeline
  model.pkl             ← Trained scikit-learn model
  train_lean.py         ← Training script (LR + XGBoost)
  predict_game.py       ← Interactive CLI predictor
```
