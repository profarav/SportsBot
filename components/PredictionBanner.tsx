"use client";

// Renders a structured prediction card when the assistant message contains
// a prediction result (detected via pattern matching on message text).

interface PredictionData {
  homeTeam: string;
  awayTeam: string;
  homeProb: number;
  awayProb: number;
  winner: string;
  confidence: string;
}

function extractPrediction(text: string): PredictionData | null {
  // Match pattern: "LAL win prob: 62.3%" and "BOS win prob: 37.7%"
  const probMatches = [
    ...text.matchAll(/([A-Z]{2,4})\s+win\s+prob(?:ability)?:\s*([\d.]+)%/gi),
  ];
  if (probMatches.length < 2) return null;

  const winnerMatch = text.match(/[Pp]redicted\s+winner[:\s]+\*{0,2}([A-Z]{2,4})\*{0,2}/);
  const confMatch = text.match(/\((high|medium|low)\s+confidence\)/i);

  return {
    homeTeam: probMatches[0][1].toUpperCase(),
    awayTeam: probMatches[1][1].toUpperCase(),
    homeProb: parseFloat(probMatches[0][2]),
    awayProb: parseFloat(probMatches[1][2]),
    winner: winnerMatch?.[1]?.toUpperCase() ?? probMatches[0][1].toUpperCase(),
    confidence: confMatch?.[1] ?? "medium",
  };
}

const CONF_COLORS: Record<string, string> = {
  high: "#22c55e",
  medium: "#f97316",
  low: "#9ca3af",
};

export default function PredictionBanner({ text }: { text: string }) {
  const data = extractPrediction(text);
  if (!data) return null;

  const homeWidth = `${data.homeProb.toFixed(1)}%`;
  const awayWidth = `${data.awayProb.toFixed(1)}%`;
  const confColor = CONF_COLORS[data.confidence.toLowerCase()] ?? "#9ca3af";

  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #1f2937",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "12px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "11px", color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          AI Prediction · Model Accuracy 64%
        </span>
        <span
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "999px",
            background: `${confColor}22`,
            color: confColor,
            border: `1px solid ${confColor}44`,
            textTransform: "capitalize",
          }}
        >
          {data.confidence} confidence
        </span>
      </div>

      {/* Teams + probabilities */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
        {/* Home */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: data.winner === data.homeTeam ? "#3b82f6" : "#9ca3af",
            }}
          >
            {data.homeTeam}
          </div>
          <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>Home</div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: data.winner === data.homeTeam ? "#3b82f6" : "#f3f4f6",
            }}
          >
            {data.homeProb.toFixed(1)}%
          </div>
        </div>

        {/* VS */}
        <div style={{ fontSize: "14px", color: "#4b5563", fontWeight: 600 }}>VS</div>

        {/* Away */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: data.winner === data.awayTeam ? "#f97316" : "#9ca3af",
            }}
          >
            {data.awayTeam}
          </div>
          <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>Away</div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: data.winner === data.awayTeam ? "#f97316" : "#f3f4f6",
            }}
          >
            {data.awayProb.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Probability bar */}
      <div
        style={{
          height: "8px",
          borderRadius: "4px",
          overflow: "hidden",
          background: "#1f2937",
          display: "flex",
        }}
      >
        <div
          style={{
            width: homeWidth,
            background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
            transition: "width 0.6s ease",
          }}
        />
        <div
          style={{
            flex: 1,
            background: "linear-gradient(90deg, #f97316, #fb923c)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "4px",
          fontSize: "11px",
          color: "#6b7280",
        }}
      >
        <span>{data.homeTeam}</span>
        <span>{data.awayTeam}</span>
      </div>
    </div>
  );
}
