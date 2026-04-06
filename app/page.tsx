"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState } from "react";
import Message from "@/components/Message";

const SUGGESTED_QUERIES = [
  "Predict OKC Thunder vs Boston Celtics — who wins?",
  "How did Cleveland Cavaliers finish this season?",
  "Show me the 2024-25 NBA standings",
  "Compare Lakers vs Warriors — who has the better net rating?",
  "Which teams had the best net rating in 2024-25?",
];

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({ api: "/api/chat" });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSuggestion(q: string) {
    handleInputChange({ target: { value: q } } as React.ChangeEvent<HTMLTextAreaElement>);
    setTimeout(() => {
      const form = document.querySelector("form");
      form?.requestSubmit();
    }, 50);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.closest("form");
      form?.requestSubmit();
    }
  }

  if (!mounted) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0a0e1a",
        color: "#f3f4f6",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: "56px",
          borderBottom: "1px solid #1f2937",
          flexShrink: 0,
          background: "#0d1117",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>🏀</span>
          <span style={{ fontWeight: 700, fontSize: "16px", letterSpacing: "-0.02em" }}>
            SportsBot
          </span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "999px",
              background: "#1f2937",
              color: "#6b7280",
            }}
          >
            NBA AI
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#22c55e",
            }}
          />
          Live Data · 64% Model Accuracy
        </div>
      </header>

      {/* ── Messages ── */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
          maxWidth: "760px",
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "32px",
            }}
          >
            {/* Hero */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🏀</div>
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  margin: 0,
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                SportsBot
              </h1>
              <p style={{ color: "#6b7280", marginTop: "8px", fontSize: "14px" }}>
                Multi-agent NBA analytics · Live stats · ML predictions · RAG history
              </p>
            </div>

            {/* Stats pills */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
              {[
                { icon: "🤖", label: "Multi-Agent", sub: "LangGraph routing" },
                { icon: "📊", label: "Live NBA Data", sub: "stats.nba.com" },
                { icon: "🎯", label: "64% Accuracy", sub: "Logistic Regression" },
                { icon: "🔍", label: "RAG Search", sub: "Weaviate + embeddings" },
              ].map(({ icon, label, sub }) => (
                <div
                  key={label}
                  style={{
                    background: "#111827",
                    border: "1px solid #1f2937",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    textAlign: "center",
                    minWidth: "130px",
                  }}
                >
                  <div style={{ fontSize: "20px", marginBottom: "4px" }}>{icon}</div>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: "11px", color: "#6b7280" }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Suggested queries */}
            <div style={{ width: "100%", maxWidth: "560px" }}>
              <p style={{ fontSize: "12px", color: "#4b5563", marginBottom: "8px", textAlign: "center" }}>
                Try asking...
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {SUGGESTED_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    style={{
                      background: "#111827",
                      border: "1px solid #1f2937",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      textAlign: "left",
                      color: "#d1d5db",
                      fontSize: "13px",
                      cursor: "pointer",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.borderColor = "#3b82f6";
                      (e.target as HTMLButtonElement).style.background = "#1e293b";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.borderColor = "#1f2937";
                      (e.target as HTMLButtonElement).style.background = "#111827";
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <Message
                key={m.id}
                role={m.role as "user" | "assistant"}
                content={m.content}
                isStreaming={
                  isLoading && i === messages.length - 1 && m.role === "assistant"
                }
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  🏀
                </div>
                <div
                  style={{
                    background: "#111827",
                    border: "1px solid #1f2937",
                    borderRadius: "4px 16px 16px 16px",
                    padding: "12px 16px",
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#3b82f6",
                        animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {error && (
              <div
                style={{
                  background: "#1c0a0a",
                  border: "1px solid #7f1d1d",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#fca5a5",
                  marginBottom: "12px",
                }}
              >
                Error: {error.message}
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* ── Input ── */}
      <div
        style={{
          borderTop: "1px solid #1f2937",
          padding: "16px 24px",
          background: "#0d1117",
          flexShrink: 0,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: "760px",
            margin: "0 auto",
            display: "flex",
            gap: "10px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about NBA stats, predictions, standings..."
            rows={1}
            style={{
              flex: 1,
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "12px",
              padding: "12px 16px",
              color: "#f3f4f6",
              fontSize: "14px",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: "1.5",
              minHeight: "44px",
              maxHeight: "120px",
              overflowY: "auto",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.target.style.borderColor = "#1f2937")}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              background: isLoading || !input.trim() ? "#1f2937" : "#3b82f6",
              border: "none",
              borderRadius: "12px",
              width: "44px",
              height: "44px",
              cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
          >
            {isLoading ? "⏳" : "➤"}
          </button>
        </form>
        <p
          style={{
            textAlign: "center",
            fontSize: "11px",
            color: "#374151",
            marginTop: "8px",
            maxWidth: "760px",
            margin: "8px auto 0",
          }}
        >
          SportsBot uses live NBA data and a logistic regression model trained on 3 seasons · Not financial/betting advice
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
