import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { runAgentGraph } from "@/lib/agents/graph";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are SportsBot — an AI sports analyst specialized in NBA analytics.

You have access to live team statistics, a logistic regression prediction model trained on 3 seasons of NBA data (64% accuracy, within 3% of Vegas baseline), and a semantic search engine over historical game logs.

When answering:
- Cite specific statistics (net rating, win%, pace)
- Explain the factors driving a prediction
- Be confident but acknowledge uncertainty
- Keep answers concise and data-driven
- Format predictions clearly with win probabilities

Do NOT make up statistics. Only use data provided in the context below.`;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userMessage = messages[messages.length - 1]?.content ?? "";

  // Run multi-agent graph to gather context
  const agentState = await runAgentGraph(userMessage);

  // Build context-enriched system prompt
  const systemWithContext = agentState.contextSummary
    ? `${SYSTEM_PROMPT}\n\n---\n## Live Data Context\n\n${agentState.contextSummary}`
    : SYSTEM_PROMPT;

  // Stream LLM response with context injected
  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemWithContext,
    messages,
    temperature: 0.3,
    maxTokens: 1024,
  });

  return result.toDataStreamResponse();
}
