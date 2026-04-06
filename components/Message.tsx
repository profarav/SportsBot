"use client";

import ReactMarkdown from "react-markdown";
import PredictionBanner from "./PredictionBanner";

interface MessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export default function Message({ role, content, isStreaming }: MessageProps) {
  const isUser = role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: "16px",
        gap: "10px",
        alignItems: "flex-start",
      }}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            flexShrink: 0,
            marginTop: "2px",
          }}
        >
          🏀
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: "75%",
          minWidth: "60px",
        }}
      >
        {/* Prediction card (assistant only) */}
        {!isUser && <PredictionBanner text={content} />}

        <div
          style={{
            background: isUser ? "#3b82f6" : "#111827",
            border: isUser ? "none" : "1px solid #1f2937",
            borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
            padding: "10px 14px",
            fontSize: "14px",
            lineHeight: "1.6",
            color: isUser ? "#fff" : "#e5e7eb",
            position: "relative",
          }}
        >
          {isUser ? (
            <span>{content}</span>
          ) : (
            <div className="prose prose-sm">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}

          {isStreaming && (
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "14px",
                background: "#3b82f6",
                marginLeft: "2px",
                borderRadius: "1px",
                animation: "blink 1s step-end infinite",
              }}
            />
          )}
        </div>
      </div>

      {isUser && (
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "#1f2937",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            flexShrink: 0,
            marginTop: "2px",
          }}
        >
          👤
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
