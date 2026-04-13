"use client";

import { useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

// ── Constants ─────────────────────────────────────────────────────────────────

const AGENT_META: AnyObj = {
  A1: { name: "Engineer",        jur: "Technical",       color: "#5271FF", bg: "#EEF0FF" },
  A2: { name: "EU Regulator",    jur: "🇪🇺 GDPR",         color: "#2E8B57", bg: "#F0FDF4" },
  A3: { name: "US Counsel",      jur: "🇺🇸 CCPA/FTC",     color: "#DC4C22", bg: "#FFF4F0" },
  A4: { name: "Product Counsel", jur: "⚖️ Product Law",   color: "#7B1FA2", bg: "#F5F0FB" },
  A5: { name: "Business Owner",  jur: "💼 Commercial",    color: "#C05600", bg: "#FFF8F0" },
};

const STATUS_STYLE: AnyObj = {
  UPHELD:          { fg: "#16a34a", bg: "#F0FDF4", bd: "#BBF7D0" },
  "UNDER DISPUTE": { fg: "#dc2626", bg: "#FEF2F2", bd: "#FECACA" },
  RESTORED:        { fg: "#7B1FA2", bg: "#F5F0FB", bd: "#E1BEE7" },
};

const SCENARIOS: AnyObj = {
  vehicle:  { label: "🚗 Vehicle & Parking Data",  question: "Can a parking app store vehicle registration marks (VRM/VIN) for driver identification and repeat-customer targeting under GDPR and CCPA?" },
  hiring:   { label: "💼 AI Hiring Tools",          question: "Does deploying an AI-based CV screening tool for shortlisting candidates constitute automated decision-making under GDPR Art. 22, requiring explicit consent?" },
  location: { label: "📍 Location Tracking",        question: "Is continuous background location tracking of delivery drivers lawful under GDPR Art. 6 legitimate interests, or does it require explicit consent?" },
  health:   { label: "🏥 Health Records",            question: "Can a fitness app share anonymised health metrics with insurers without patient consent under HIPAA and GDPR special category data rules?" },
  biometric:{ label: "🔐 Biometric Data",            question: "Does facial recognition in retail stores for loss prevention constitute processing of biometric data under GDPR Art. 9, requiring explicit consent?" },
  ads:      { label: "📢 Targeted Advertising",      question: "Is behavioural advertising based on browsing history lawful under ePrivacy Directive Art. 5(3) without affirmative consent to non-essential cookies?" },
};

const QA = [
  {
    pats: ["breyer", "c-582", "identification", "third party", "dvla"],
    r: `<p><strong>Breyer v Germany (ECJ C-582/14)</strong> established that data constitutes personal data if the controller has <em>legal means reasonably likely to be used</em> to identify the natural person — even if they don't hold identifying information directly.</p><p>Applied here: VRM is linked to a named keeper in the DVLA register. Any party can link a VRM to a person. The EU Regulator argued — and the panel upheld — that this is sufficient for GDPR personal data classification under Recital 30.</p><div class="qa-cite">Authority: ECJ Case C-582/14 (Breyer v Germany, 2016) · GDPR Recital 30 · Art. 4(5)</div>`,
  },
  {
    pats: ["us only", "united states", "america", "ccpa only", "ftc only", "no eu"],
    r: `<p>If operations are exclusively US-based with no EU data subjects, GDPR does not apply. Under <strong>CCPA</strong>: VRM is personal information if reasonably linkable. Storage is permitted with adequate privacy notice and opt-out rights. Under <strong>FTC Act § 5</strong>: primary risk is deceptive data practices — disclose VRM retention in your privacy policy.</p><div class="qa-cite">Authority: CCPA § 1798.140 · FTC Act § 5 · FTC Privacy Framework 2012</div>`,
  },
  {
    pats: ["fine", "penalty", "sanction", "enforcement", "ico"],
    r: `<p>GDPR tier-two fines for Art. 5/6 violations: up to <strong>€20 million or 4% of global annual turnover</strong>, whichever is higher. UK GDPR mirrors this under DPA 2018. The panel's consent-first recommendation with documented lawful basis are strong mitigating factors in any ICO investigation.</p><div class="qa-cite">Authority: GDPR Art. 83 · UK GDPR s.157 DPA 2018</div>`,
  },
  {
    pats: ["pseudonymis", "sha", "hash", "token", "anonymis"],
    r: `<p>SHA-256 hashing of VRM tokens with per-user salts constitutes technically robust pseudonymisation. The panel adopted this as the core technical safeguard — working <em>alongside</em> the consent-first lawful basis, not replacing it. Consent is the legal basis; pseudonymisation reduces breach exposure.</p><div class="qa-cite">Authority: GDPR Art. 4(5) · ICO Anonymisation Code 2012 · ENISA Pseudonymisation Guidelines 2019</div>`,
  },
  {
    pats: ["consent", "opt-in", "art. 7", "article 7", "freely given"],
    r: `<p><strong>GDPR Art. 7</strong> requires consent to be: freely given, specific, informed, and unambiguous. No pre-ticked boxes. No bundling with T&Cs. Must be as easy to withdraw as to give (Art. 7(3)). The Product Counsel's one-tap consent UX achieving 74% opt-in was the basis for the Nash equilibrium recommendation.</p><div class="qa-cite">Authority: GDPR Art. 7 · EDPB Guidelines 05/2020 on Consent</div>`,
  },
];

type AppPhase = "input" | "analysing" | "report";
type ChatState = "greeting" | "doc-upload" | "follow-up";

interface Message { id: number; role: "lq" | "user"; content: React.ReactNode; }
let msgId = 0;
const nextId = () => ++msgId;

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Home() {
  const [phase, setPhase] = useState<AppPhase>("input");
  const [chatState, setChatState] = useState<ChatState>("greeting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [inputDisabled, setInputDisabled] = useState(true);
  const [inputPlaceholder, setInputPlaceholder] = useState("What legal question would you like to analyse?");
  const [suggestVisible, setSuggestVisible] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnyObj | null>(null);
  const [activeTab, setActiveTab] = useState<"ruling" | "exchange" | "strategy" | "steps">("ruling");
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [debateVisible, setDebateVisible] = useState(false);
  const [visibleExchanges, setVisibleExchanges] = useState(0);

  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // ── Chat helpers ────────────────────────────────────────────────────────────

  const scrollBottom = () => setTimeout(() => messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" }), 50);

  const addMsg = (role: "lq" | "user", content: React.ReactNode) => {
    const msg = { id: nextId(), role, content };
    setMessages((p) => [...p, msg]);
    scrollBottom();
    return msg.id;
  };
  const addLQ   = (c: React.ReactNode) => addMsg("lq", c);
  const addUser = (t: string) => addMsg("user", <span>{t}</span>);

  const showTyping = (cb: () => void, delay = 900) => {
    const id = addLQ(<div className="typing-dots"><span /><span /><span /></div>);
    setTimeout(() => { setMessages((p) => p.filter((m) => m.id !== id)); cb(); }, delay);
  };

  const enableInput  = (p: string) => { setInputPlaceholder(p); setInputDisabled(false); setTimeout(() => inputRef.current?.focus(), 50); };
  const disableInput = () => setInputDisabled(true);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    showTyping(() => {
      addLQ(
        <>
          <p>Welcome to <strong>LegaliQ</strong>. What legal or regulatory question would you like the panel to examine?</p>
          <p>Select a scenario or type your question below:</p>
          <div className="sc-grid">
            {Object.entries(SCENARIOS).map(([k, s]) => (
              <span key={k} className="sc-chip" onClick={() => selectScenario(s.question)}>{s.label}</span>
            ))}
          </div>
        </>
      );
      enableInput("What legal question would you like to analyse?");
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Input flow ──────────────────────────────────────────────────────────────

  const selectScenario = (q: string) => { addUser(q); handleQuestion(q); };

  const handleQuestion = (q: string) => {
    setChatState("doc-upload");
    setQuestion(q);
    disableInput();
    showTyping(() => {
      addLQ(<DocUploadWidget question={q} onProceed={handleProceed} />);
    }, 900);
  };

  const handleProceed = (skipped: boolean) => {
    addUser(skipped ? "Skip — proceed without documents." : "Proceeding with analysis.");
    disableInput();
    setPhase("analysing");
    showTyping(() => {
      addLQ(<p>Convening the panel… this takes 30–60 seconds.</p>);
      runAnalysis(question);
    }, 700);
  };

  const runAnalysis = async (q: string) => {
    try {
      const res = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, contexts: {} }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setPhase("report");
      setChatState("follow-up");
      setActiveTab("ruling");
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: "smooth" });
        showTyping(() => {
          addLQ(<p>The panel has reached a <strong>Nash equilibrium</strong>. The full report is below — scroll down or use the tabs to navigate. Ask any follow-up question here.</p>);
          setSuggestVisible(true);
          enableInput("Ask a follow-up question about the analysis…");
        }, 600);
      }, 300);
    } catch (e) {
      setPhase("input");
      addLQ(<p style={{ color: "#dc2626" }}><strong>Error:</strong> {e instanceof Error ? e.message : "Unexpected error"}</p>);
      enableInput("What legal question would you like to analyse?");
    }
  };

  // ── Keyboard & send ─────────────────────────────────────────────────────────

  const handleSend = () => {
    const t = inputText.trim();
    if (!t) return;
    setInputText("");
    if (chatState === "greeting") { addUser(t); handleQuestion(t); }
    else if (chatState === "follow-up") { addUser(t); handleFollowUp(t); }
  };

  const handleFollowUp = (q: string) => {
    disableInput();
    const lower = q.toLowerCase();
    let resp: React.ReactNode = null;
    for (const pair of QA) {
      if (pair.pats.some((p) => lower.includes(p))) { resp = <div dangerouslySetInnerHTML={{ __html: pair.r }} />; break; }
    }
    if (!resp) resp = <p>Based on the panel record: the EU Regulator's position (UPHELD) is that a consent-first architecture with pseudonymised tokens is the most defensible implementation. Ask about a specific jurisdiction, agent, or authority for a more targeted answer.</p>;
    showTyping(() => { addLQ(resp); enableInput("Ask a follow-up question…"); }, 900);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };
  const resize = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 100) + "px"; };

  const agentMeta = result?.agentMeta ?? AGENT_META;

  // ── Debate animation trigger ─────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "exchange" || !result) return;
    if (debateVisible) return;
    setDebateVisible(true);
    setVisibleExchanges(0);
    const exchanges = result.exchanges ?? [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    exchanges.forEach((_: AnyObj, i: number) => {
      timers.push(setTimeout(() => setVisibleExchanges(i + 1), 400 + i * 1600));
    });
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, result]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* HEADER */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#1a1a2e,#3d5afe)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12 }}>LQ</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a2e", letterSpacing: "-.5px" }}>LegaliQ</div>
            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500, letterSpacing: ".5px", textTransform: "uppercase" }}>Multi-Agent Legal Reasoning</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {phase === "report" && result && (
            <button onClick={() => window.print()} style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
              ↓ Export PDF
            </button>
          )}
          <span style={{ background: "#EEF0FF", color: "#3d5afe", fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>⚖️ Adversarial Analysis Mode</span>
        </div>
      </header>

      {/* BODY — split pane when report is visible */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT: Chat */}
        <div style={{
          width: phase === "report" ? 340 : "100%",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: phase === "report" ? "1px solid #e5e7eb" : "none",
          transition: "width .4s ease",
          background: "#F4F5F8",
          overflow: "hidden",
        }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: phase === "report" ? "100%" : 860, width: "100%", margin: "0 auto", padding: "0 16px", overflow: "hidden" }}>

            {/* Messages */}
            <div className="chat-messages" ref={messagesRef} style={{ flex: 1, overflowY: "auto", padding: "20px 0 10px", display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map((m) => (
                <div key={m.id} className={`msg ${m.role === "lq" ? "msg-lq" : "msg-user"}`}>
                  {m.role === "lq" && <div className="msg-av">LQ</div>}
                  <div className="msg-bubble">{m.content}</div>
                </div>
              ))}
              {phase === "analysing" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#1a1a2e,#3d5afe)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>LQ</div>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "4px 12px 12px 12px", padding: "13px 16px", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
                    <div className="typing-dots"><span /><span /><span /></div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggest chips */}
            {suggestVisible && (
              <div className="suggest-bar" style={{ display: "flex" }}>
                {[
                  { label: "What does Breyer mean?", q: "What does Breyer v Germany mean for this case?" },
                  { label: "GDPR fines?", q: "What are the potential GDPR fines?" },
                  { label: "Legitimate interests?", q: "Can we use legitimate interests instead of consent?" },
                  { label: "Pseudonymisation?", q: "What is pseudonymisation under GDPR?" },
                ].map((c) => (
                  <span key={c.q} className="suggest-chip" onClick={() => { addUser(c.q); handleFollowUp(c.q); }}>{c.label}</span>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="input-area">
              <div className="input-wrap">
                <textarea ref={inputRef} className="chat-input" rows={1} placeholder={inputPlaceholder}
                  disabled={inputDisabled} value={inputText}
                  onChange={(e) => { setInputText(e.target.value); resize(e.target); }}
                  onKeyDown={onKey} />
                <button className="send-btn" disabled={inputDisabled} onClick={handleSend}>→</button>
              </div>
              <div className="input-hint">Press Enter to send · Shift+Enter for new line</div>
            </div>
          </div>
        </div>

        {/* RIGHT: Structured Report */}
        {phase === "report" && result && (
          <div ref={reportRef} style={{ flex: 1, overflowY: "auto", background: "#F4F5F8" }}>
            <ReportView
              result={result}
              agentMeta={agentMeta}
              activeTab={activeTab}
              onTabChange={(t) => setActiveTab(t)}
              openSteps={openSteps}
              onToggleStep={(i) => setOpenSteps((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              visibleExchanges={visibleExchanges}
              debateVisible={debateVisible}
            />
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" style={{ display: "none" }} accept=".pdf,.docx,.txt,.md,.csv" multiple />
    </div>
  );
}

// ── Doc upload widget ──────────────────────────────────────────────────────────

function DocUploadWidget({ question, onProceed }: { question: string; onProceed: (skipped: boolean) => void }) {
  const [chips, setChips] = useState<{ label: string; type: "file" | "link" }[]>([]);
  const [linkVal, setLinkVal] = useState("");

  const addLink = () => {
    const url = linkVal.trim(); if (!url) return;
    setChips((p) => [...p, { label: `🔗 ${url.replace(/^https?:\/\//, "").substring(0, 45)}`, type: "link" }]);
    setLinkVal("");
  };

  return (
    <>
      <p>Understood. The panel will examine:</p>
      <p><em>"{question}"</em></p>
      <p>Add supporting documents or links, or proceed directly.</p>
      <div className="doc-widget">
        <div className="doc-upload-zone" onClick={() => document.getElementById("lq-file-input")?.click()}>
          <span style={{ fontSize: 18 }}>📎</span>
          <div><strong>Attach documents</strong><br /><span style={{ fontSize: 10, color: "#9ca3af" }}>PDF, DOCX, TXT, MD</span></div>
          <input id="lq-file-input" type="file" style={{ display: "none" }} accept=".pdf,.docx,.txt,.md,.csv" multiple
            onChange={(e) => { setChips((p) => [...p, ...Array.from(e.target.files ?? []).map((f) => ({ label: `📄 ${f.name}`, type: "file" as const }))]); e.target.value = ""; }} />
        </div>
        <div className="doc-link-row">
          <input className="doc-url-input" type="url" placeholder="Or paste a reference link…" value={linkVal}
            onChange={(e) => setLinkVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()} />
          <button className="doc-url-add" onClick={addLink}>Add</button>
        </div>
        {chips.length > 0 && (
          <div className="doc-chips">
            {chips.map((c, i) => (
              <div key={i} className={`doc-chip${c.type === "link" ? " lnk" : ""}`}>
                <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                <span className="doc-chip-x" onClick={() => setChips((p) => p.filter((_, j) => j !== i))}>×</span>
              </div>
            ))}
          </div>
        )}
        <div className="doc-actions">
          <button className="doc-skip" onClick={() => onProceed(true)}>Skip — proceed without documents</button>
          <button className="doc-proceed" onClick={() => onProceed(false)}>→ Proceed with analysis</button>
        </div>
      </div>
    </>
  );
}

// ── Report View ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "ruling",   label: "Panel Ruling"   },
  { id: "exchange", label: "Debate Record"  },
  { id: "strategy", label: "Strategy"       },
  { id: "steps",    label: "Roadmap"        },
] as const;

function ReportView({ result, agentMeta, activeTab, onTabChange, openSteps, onToggleStep, selectedAgent, onSelectAgent, visibleExchanges, debateVisible }: {
  result: AnyObj; agentMeta: AnyObj;
  activeTab: string; onTabChange: (t: "ruling" | "exchange" | "strategy" | "steps") => void;
  openSteps: Set<number>; onToggleStep: (i: number) => void;
  selectedAgent: string | null; onSelectAgent: (id: string) => void;
  visibleExchanges: number; debateVisible: boolean;
}) {
  const meta = (id: string) => agentMeta[id] ?? { name: id, color: "#6b7280", bg: "#f9fafb", jur: "" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 48px" }}>

      {/* Report header */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.03)" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>Panel Analysis Report</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.4, marginBottom: 16 }}>{result.question ?? "Compliance Analysis"}</div>

        {/* Agent status bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
          {["A1","A2","A3","A4","A5"].map((id) => {
            const m = meta(id);
            const st = STATUS_STYLE[result.agents?.[id]?.status ?? "UPHELD"] ?? STATUS_STYLE.UPHELD;
            return (
              <div key={id} onClick={() => { onTabChange("ruling"); onSelectAgent(id); }}
                style={{ borderRadius: 8, padding: "9px 10px", background: m.bg, border: `1px solid ${m.color}25`, cursor: "pointer",
                  boxShadow: selectedAgent === id ? `0 0 0 2px ${m.color}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: m.color }}>{m.name}</span>
                </div>
                <div style={{ fontSize: 9, color: m.color, opacity: .65, margin: "1px 0 5px 11px" }}>{m.jur}</div>
                <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: ".5px", textTransform: "uppercase",
                  padding: "2px 6px", borderRadius: 6, display: "inline-block", marginLeft: 11,
                  color: st.fg, background: st.bg }}>{result.agents?.[id]?.status ?? "UPHELD"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 4, boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => onTabChange(tab.id)}
            style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .15s",
              background: activeTab === tab.id ? "#1a1a2e" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#6b7280" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Panel Ruling */}
      {activeTab === "ruling" && (
        <>
          {/* Verdict */}
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#16a34a", marginBottom: 8 }}>✓ Recommended Implementation</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#15803d", lineHeight: 1.65 }}>{result.decision?.recommendation}</div>
          </div>

          {/* Jurisdiction grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            {(result.decision?.jurisdictions ?? []).map((j: AnyObj) => (
              <div key={j.name} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{j.flag}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", marginBottom: 5 }}>{j.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.55 }}>{j.rule}</div>
              </div>
            ))}
          </div>

          {/* Selected agent brief */}
          {selectedAgent && (
            <AgentBrief agentId={selectedAgent} agents={result.agents ?? {}} agentMeta={agentMeta}
              agentExchangeMap={result.agentExchangeMap ?? {}} />
          )}
          {!selectedAgent && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Click an agent card above to read their full legal brief
            </div>
          )}
        </>
      )}

      {/* TAB: Debate Record */}
      {activeTab === "exchange" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,.03)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", marginBottom: 2 }}>Adversarial Submissions Record</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 20 }}>Chronological log of objections raised between counsel</div>
          <div className="debate-track">
            {(result.exchanges ?? []).map((ex: AnyObj, i: number) => {
              const att = meta(ex.attacker), tgt = meta(ex.target);
              const visible = !debateVisible || i < visibleExchanges;
              return (
                <div key={ex.id} className={`ex-card${visible ? " visible" : ""}`}>
                  <div className="ex-node" style={{ background: att.color, borderColor: "#fff" }}>{i + 1}</div>
                  <div className="ex-bubble" style={{ background: att.bg, borderLeftColor: att.color }}>
                    <div className="ex-bub-hdr">
                      <span className="ex-att-name" style={{ color: att.color }}>{att.name}</span>
                      <span className="ex-att-jur" style={{ color: att.color }}>{att.jur}</span>
                      <span className="ex-type-badge" style={{ background: ex.typeBg, color: ex.typeColor }}>{ex.type}</span>
                    </div>
                    <div className="ex-target">↳ submits against <strong style={{ color: tgt.color }}>{tgt.name}</strong> ({ex.id})</div>
                    <div className="ex-quote">{ex.quote}</div>
                    {/* Outcome */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,.06)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: ".5px", textTransform: "uppercase", padding: "2px 8px", borderRadius: 6,
                        color: ex.outcomeType === "sustained" ? "#dc2626" : "#16a34a",
                        background: ex.outcomeType === "sustained" ? "#FEF2F2" : "#F0FDF4",
                      }}>{ex.outcome}</span>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>{ex.outcomeDetail}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: Strategy */}
      {activeTab === "strategy" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,.03)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", marginBottom: 2 }}>Nash Equilibrium Analysis</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 20 }}>Score = (Legal Validity × Probability) + Business Value − Regulatory Risk − Engineering Cost</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {(result.strategies ?? []).map((s: AnyObj) => {
              const R = 34, C = 2 * Math.PI * R;
              const offset = C * (1 - s.score / 100);
              return (
                <div key={s.name} style={{ textAlign: "center", position: "relative" }}>
                  {s.optimal && (
                    <span style={{ position: "absolute", top: -4, right: 0, fontSize: 8, fontWeight: 800,
                      background: "#F0FDFA", color: "#0d9488", border: "1px solid #CCFBF1",
                      padding: "2px 7px", borderRadius: 8, letterSpacing: ".5px" }}>EQUILIBRIUM</span>
                  )}
                  <div style={{ position: "relative", width: 90, height: 90, margin: "0 auto 14px" }}>
                    <svg width="90" height="90" viewBox="0 0 90 90">
                      <circle cx="45" cy="45" r={R} fill="none" stroke={s.donutBg} strokeWidth="8" />
                      <circle cx="45" cy="45" r={R} fill="none" stroke={s.donutColor} strokeWidth="8"
                        strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 45 45)" />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, fontWeight: 800, color: "#1a1a2e" }}>{s.score}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", marginBottom: 5 }}>{s.name}</div>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 10px", borderRadius: 10, display: "inline-block", marginBottom: 8, background: s.statusBg, color: s.statusColor }}>{s.status}</span>
                  <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>{s.note}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: Roadmap */}
      {activeTab === "steps" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,.03)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", marginBottom: 2 }}>Implementation Roadmap</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>Sequenced actions from panel ruling · click a step to expand</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(result.nextSteps ?? []).map((s: AnyObj, i: number) => (
              <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", borderTop: `4px solid ${s.color}`, cursor: "pointer" }}
                onClick={() => onToggleStep(i)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#f9fafb" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px" }}>{s.phase}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>{s.title}</span>
                      <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: "auto" }}>{s.timeline}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{s.actions}</div>
                  </div>
                  <span style={{ color: "#9ca3af", fontSize: 12, transition: "transform .2s", transform: openSteps.has(i) ? "rotate(180deg)" : "none" }}>▾</span>
                </div>
                {openSteps.has(i) && (
                  <div style={{ padding: "14px 16px", borderTop: "1px solid #f3f4f6", background: "#fff" }}>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
                      {(s.checklist ?? []).map((item: string, j: number) => (
                        <li key={j} style={{ display: "flex", gap: 8, fontSize: 12, color: "#374151", lineHeight: 1.55 }}>
                          <span style={{ color: "#9ca3af", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>{item}
                        </li>
                      ))}
                    </ul>
                    <div style={{ paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
                      <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#9ca3af", marginBottom: 6 }}>Owners</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(s.owners ?? []).map((o: string, j: number) => (
                          <span key={j} style={{ fontSize: 10, fontWeight: 600, background: "#f3f4f6", color: "#374151", padding: "3px 10px", borderRadius: 10 }}>{o}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent Brief ────────────────────────────────────────────────────────────────

function AgentBrief({ agentId, agents, agentMeta, agentExchangeMap }: { agentId: string; agents: AnyObj; agentMeta: AnyObj; agentExchangeMap: AnyObj }) {
  const a = agentMeta[agentId] ?? { name: agentId, color: "#6b7280", bg: "#f9fafb", jur: "" };
  const b = agents[agentId] ?? {};
  const r = b.status ?? "UPHELD";
  const s = STATUS_STYLE[r] ?? { fg: "#6b7280", bg: "#f9fafb", bd: "#e5e7eb" };
  const exMap = agentExchangeMap[agentId] ?? { objections: [], challenges: [] };

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,.03)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".5px", textTransform: "uppercase", color: a.color }}>{a.name}</span>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>{a.jur}</span>
        <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 8, color: s.fg, background: s.bg, border: `1px solid ${s.bd}` }}>{r}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        {[
          ["① Submission", b.submission, true, false],
          ["② Factual Basis", b.factualBasis, false, true],
          ["Legal Authority", b.legalAuthority, false, false],
          ["Cited Authority", b.citedAuthority, true, false],
        ].map(([lbl, txt, bold, italic]) => txt ? (
          <div key={lbl as string}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>{lbl}</div>
            <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, fontWeight: bold ? 600 : 400, fontStyle: italic ? "italic" : "normal", color: bold ? "#1a1a2e" : "#374151" } as React.CSSProperties}>{txt}</div>
          </div>
        ) : null)}
      </div>

      {b.qualification && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: "#f9fafb", borderRadius: 8, borderLeft: "3px solid #e5e7eb" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#9ca3af", marginBottom: 3 }}>Qualification · Save Where</div>
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, fontStyle: "italic" }}>{b.qualification}</div>
        </div>
      )}

      {b.confidence != null && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#9ca3af" }}>Confidence</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: a.color }}>{b.confidence}%</span>
          </div>
          <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2 }}>
            <div style={{ width: `${b.confidence}%`, height: "100%", background: a.color, borderRadius: 2, transition: "width .6s ease" }} />
          </div>
        </div>
      )}

      {(exMap.objections?.length > 0 || exMap.challenges?.length > 0) && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
          {exMap.objections?.map((o: AnyObj) => (
            <div key={o.id} style={{ borderLeft: `3px solid ${o.color}`, background: `${o.color}0d`, borderRadius: 6, padding: 9, marginBottom: 7 }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px", color: o.color, marginBottom: 2 }}>{o.type} · {o.id} from {agentMeta[o.from]?.name ?? o.from}</div>
              <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.5, fontStyle: "italic" }}>"{o.summary}"</div>
            </div>
          ))}
          {exMap.challenges?.map((c: AnyObj) => (
            <div key={c.id} style={{ borderLeft: `3px solid ${c.color}`, background: `${c.color}0d`, borderRadius: 6, padding: 9, marginBottom: 7 }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px", color: c.color, marginBottom: 2 }}>{c.type} · {c.id} → {agentMeta[c.to]?.name ?? c.to}</div>
              <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.5, fontStyle: "italic" }}>"{c.summary}"</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
