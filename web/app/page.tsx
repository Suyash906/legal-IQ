"use client";

import { useRef, useState } from "react";
import ArgumentMap from "@/components/ArgumentMap";
import BriefPanel from "@/components/BriefPanel";
import ChambersExchange from "@/components/ChambersExchange";
import StrategyMatrix from "@/components/StrategyMatrix";
import DecisionMemo from "@/components/DecisionMemo";
import NextSteps from "@/components/NextSteps";

// ── Types ─────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

const AGENT_IDS = ["A1", "A2", "A3", "A4", "A5"] as const;

const AGENT_META_DEFAULT = {
  A1: { name: "Engineer",        jur: "Technical",        color: "#5271FF", bg: "#EEF0FF" },
  A2: { name: "EU Regulator",    jur: "🇪🇺 GDPR",          color: "#2E8B57", bg: "#F0FDF4" },
  A3: { name: "US Counsel",      jur: "🇺🇸 CCPA / FTC",    color: "#DC4C22", bg: "#FFF4F0" },
  A4: { name: "Product Counsel", jur: "⚖️ Product Law",    color: "#7B1FA2", bg: "#F5F0FB" },
  A5: { name: "Business Owner",  jur: "💼 Commercial",     color: "#C05600", bg: "#FFF8F0" },
};

const SCENARIOS: Record<string, { label: string; icon: string; question: string; ctx: Record<string,string> }> = {
  vehicle: {
    label: "Vehicle & Parking Data", icon: "🚗",
    question: "Can a parking app store vehicle registration marks (VRM/VIN) for driver identification and repeat-customer targeting under GDPR and CCPA?",
    ctx: {
      A1: "We use SHA-256 hashed VRM tokens internally; no raw VRM is stored server-side after the initial capture event.",
      A2: "Processing occurs in Germany under BSI oversight; we are registered with the BfDI as a data controller.",
      A3: "Primary US operations in California; Delaware incorporation; no VRM data sold to third parties.",
      A4: "Consent flow is already built; our baseline opt-in rate is 74% from a comparable parking application.",
      A5: "VRM re-identification is core to our repeat-customer targeting; 60% of revenue is tied to return-user recognition.",
    },
  },
  hiring: {
    label: "AI Hiring Tools", icon: "💼",
    question: "Does deploying an AI-based CV screening tool for shortlisting candidates constitute automated decision-making under GDPR Art. 22, requiring explicit consent?",
    ctx: { A1: "", A2: "", A3: "", A4: "", A5: "" },
  },
  location: {
    label: "Location Tracking", icon: "📍",
    question: "Is continuous background location tracking of delivery drivers lawful under GDPR Art. 6 legitimate interests, or does it require explicit consent?",
    ctx: { A1: "", A2: "", A3: "", A4: "", A5: "" },
  },
  health: {
    label: "Health Records", icon: "🏥",
    question: "Can a fitness app share anonymised health metrics with insurers without patient consent under HIPAA and GDPR special category data rules?",
    ctx: { A1: "", A2: "", A3: "", A4: "", A5: "" },
  },
  biometric: {
    label: "Biometric Data", icon: "🔐",
    question: "Does facial recognition in retail stores for loss prevention constitute processing of biometric data under GDPR Art. 9, requiring explicit consent?",
    ctx: { A1: "", A2: "", A3: "", A4: "", A5: "" },
  },
  ads: {
    label: "Targeted Advertising", icon: "📢",
    question: "Is behavioural advertising based on browsing history lawful under ePrivacy Directive Art. 5(3) without affirmative consent to non-essential cookies?",
    ctx: { A1: "", A2: "", A3: "", A4: "", A5: "" },
  },
};

const ACCEPTED = [".docx", ".txt", ".md"];

export default function Home() {
  // ── Query state ─────────────────────────────────────────────────────────
  const [activeScenario, setActiveScenario] = useState<string>("vehicle");
  const [question, setQuestion] = useState(SCENARIOS.vehicle.question);
  const [contexts, setContexts] = useState<Record<string,string>>(SCENARIOS.vehicle.ctx);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Results state ────────────────────────────────────────────────────────
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnyObj | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [postExchangeVisible, setPostExchangeVisible] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  const pickScenario = (key: string) => {
    const s = SCENARIOS[key];
    if (!s) return;
    setActiveScenario(key);
    setQuestion(s.question);
    if (Object.values(s.ctx).some(Boolean)) setContexts(s.ctx);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const valid = Array.from(list).filter((f) => ACCEPTED.some((e) => f.name.toLowerCase().endsWith(e)));
    setFiles((prev) => [...prev, ...valid].filter((f, i, a) => a.findIndex((x) => x.name === f.name) === i));
  };

  const runAnalysis = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setSelectedAgent(null);

    try {
      let res: Response;

      if (files.length > 0) {
        const form = new FormData();
        form.append("question", question);
        form.append("contexts", JSON.stringify(contexts));
        files.forEach((f) => form.append("files", f));
        res = await fetch("/api/reason", { method: "POST", body: form });
      } else {
        res = await fetch("/api/reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, contexts }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Server error");

      setResult(data);
      setPostExchangeVisible(false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setRunning(false);
    }
  };

  const agentMeta = result?.agentMeta ?? AGENT_META_DEFAULT;

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", background: "#F4F5F8", color: "#1a1a2e", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <header style={{
        background: "#fff", borderBottom: "2px solid #e5e7eb", padding: "14px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center",
            justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: "-.5px",
            background: "linear-gradient(135deg,#1a1a2e 0%,#3d5afe 100%)",
          }}>LQ</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#1a1a2e", letterSpacing: "-.5px" }}>LegaliQ</div>
            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500, letterSpacing: ".5px", textTransform: "uppercase" }}>Multi-Agent Legal Reasoning</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ background: "#EEF0FF", color: "#3d5afe", fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20, letterSpacing: ".3px" }}>
            ⚖️ Adversarial Analysis Mode
          </span>
          <button
            onClick={runAnalysis}
            disabled={running}
            style={{
              background: running ? "#6b7280" : "#1a1a2e", color: "#fff", border: "none",
              padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: running ? "not-allowed" : "pointer", letterSpacing: ".3px", transition: "background .2s",
            }}>
            {running ? "Analysing…" : "Run Analysis"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px" }}>

        {/* ── LEGAL QUESTION ── */}
        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10 }}>
          Legal Question
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,.03)" }}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="Describe the legal or regulatory question you want the counsel panel to examine…"
            style={{
              width: "100%", border: "none", outline: "none", resize: "none",
              fontSize: 15, color: "#1a1a2e", lineHeight: 1.65, fontFamily: "inherit",
              background: "transparent", minHeight: 60,
            }}
          />

          {/* Scenario bubbles */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: "1px solid #f3f4f6", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: ".5px", textTransform: "uppercase", whiteSpace: "nowrap" }}>Scenarios</span>
            {Object.entries(SCENARIOS).map(([key, s]) => (
              <button key={key} onClick={() => pickScenario(key)}
                style={{
                  background: activeScenario === key ? "#1a1a2e" : "#F3F4F6",
                  color: activeScenario === key ? "#fff" : "#4b5563",
                  border: `1px solid ${activeScenario === key ? "#1a1a2e" : "transparent"}`,
                  padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                  cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
                }}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* File upload strip */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: ".5px", textTransform: "uppercase" }}>Documents</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "#F3F4F6", border: "1px solid #e5e7eb", borderRadius: 8,
                padding: "4px 12px", fontSize: 12, fontWeight: 500, color: "#4b5563", cursor: "pointer",
              }}>
              📎 Attach files
            </button>
            <input ref={fileInputRef} type="file" multiple accept={ACCEPTED.join(",")}
              className="hidden" onChange={(e) => addFiles(e.target.files)} />
            {files.map((f) => (
              <span key={f.name} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "#EEF0FF", color: "#3d5afe", border: "1px solid #c7d2fe",
                borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 500,
              }}>
                {f.name}
                <button onClick={() => setFiles((p) => p.filter((x) => x.name !== f.name))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        </div>

        {/* ── CONTEXT SECTION ── */}
        <div
          onClick={() => setCtxOpen((o) => !o)}
          style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", marginBottom: 12, userSelect: "none", width: "fit-content" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"
            style={{ transform: ctxOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Add company context to fine-tune counsel reasoning</span>
        </div>

        {ctxOpen && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 24 }}>
            {AGENT_IDS.map((id) => {
              const m = AGENT_META_DEFAULT[id];
              return (
                <div key={id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 13, boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6, letterSpacing: ".3px" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                    {m.name.toUpperCase()}
                  </div>
                  <textarea
                    value={contexts[id] ?? ""}
                    onChange={(e) => setContexts((c) => ({ ...c, [id]: e.target.value }))}
                    rows={3}
                    placeholder={`${m.name} context…`}
                    style={{
                      width: "100%", border: "none", outline: "none", resize: "none",
                      fontSize: 11, color: "#374151", fontFamily: "inherit", background: "transparent",
                      lineHeight: 1.5, minHeight: 48,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ── ERROR ── */}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── RESULTS ── */}
        {result && (
          <div ref={resultsRef}>

            {/* 1. Chambers Exchange — animated first */}
            <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10 }}>
              Chambers Exchange
            </div>
            <ChambersExchange
              exchanges={result.exchanges ?? []}
              agentMeta={agentMeta}
              onAnimationComplete={() => setPostExchangeVisible(true)}
            />

            {/* 2. Post-exchange — fades in after animation */}
            <div style={{
              opacity: postExchangeVisible ? 1 : 0,
              transition: "opacity 0.8s ease",
              pointerEvents: postExchangeVisible ? "auto" : "none",
            }}>

              {/* Argument map + brief panel */}
              <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10 }}>
                Argument Map &amp; Legal Brief
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14, marginBottom: 20 }}>
                <ArgumentMap
                  agentMeta={agentMeta}
                  exchanges={result.exchanges ?? []}
                  selectedAgent={selectedAgent}
                  onSelectAgent={(id) => setSelectedAgent(id === selectedAgent ? null : id)}
                />
                <BriefPanel
                  agentId={selectedAgent}
                  agents={result.agents ?? {}}
                  agentExchangeMap={result.agentExchangeMap ?? {}}
                  agentMeta={agentMeta}
                />
              </div>

              {/* Strategy Matrix */}
              <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10 }}>
                Strategic Options Matrix
              </div>
              <StrategyMatrix strategies={result.strategies ?? []} />

              {/* Decision Memo */}
              <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10 }}>
                Decision Memo
              </div>
              <DecisionMemo decision={result.decision ?? { recommendation: "", jurisdictions: [] }} />

              {/* Next Steps */}
              <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10 }}>
                Recommended Next Steps
              </div>
              <NextSteps steps={result.nextSteps ?? []} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
