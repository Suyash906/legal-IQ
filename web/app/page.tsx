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
  vehicle:  { label: "🚗 Vehicle & Parking Data", question: "Can a parking app store vehicle registration marks (VRM/VIN) for driver identification and repeat-customer targeting under GDPR and CCPA?" },
  hiring:   { label: "💼 AI Hiring Tools",        question: "Does deploying an AI-based CV screening tool for shortlisting candidates constitute automated decision-making under GDPR Art. 22, requiring explicit consent?" },
  location: { label: "📍 Location Tracking",      question: "Is continuous background location tracking of delivery drivers lawful under GDPR Art. 6 legitimate interests, or does it require explicit consent?" },
  health:   { label: "🏥 Health Records",          question: "Can a fitness app share anonymised health metrics with insurers without patient consent under HIPAA and GDPR special category data rules?" },
  biometric:{ label: "🔐 Biometric Data",          question: "Does facial recognition in retail stores for loss prevention constitute processing of biometric data under GDPR Art. 9, requiring explicit consent?" },
  ads:      { label: "📢 Targeted Advertising",    question: "Is behavioural advertising based on browsing history lawful under ePrivacy Directive Art. 5(3) without affirmative consent to non-essential cookies?" },
};

const SUGGEST_CHIPS = [
  { label: "What does Breyer mean?",    q: "What does Breyer v Germany mean for this case?" },
  { label: "US-only analysis",          q: "What if we only operate in the US?" },
  { label: "GDPR fines?",              q: "What are the potential GDPR fines?" },
  { label: "Legitimate interests?",     q: "Can we use legitimate interests instead of consent?" },
  { label: "Pseudonymisation?",         q: "What is pseudonymisation under GDPR?" },
];

const QA = [
  {
    pats: ["breyer", "c-582", "identification", "third party", "dvla"],
    r: `<p><strong>Breyer v Germany (ECJ C-582/14)</strong> established that data constitutes personal data if the controller has <em>legal means reasonably likely to be used</em> to identify the natural person — even if they don't hold identifying information directly.</p>
        <p>Applied here: VRM is linked to a named keeper in the DVLA register. Any party (including the parking operator via DVLA, ANPR systems, or third-party enrichment services) can link a VRM to a person. The EU Regulator (A2) argued — and the panel upheld — that this is sufficient for GDPR personal data classification under Recital 30.</p>
        <p>The Engineer's counter-argument (Art. 4(5) pseudonymisation) was not sustained because pseudonymisation requires the re-identification pathway to be practically unavailable, which DVLA access removes.</p>
        <div class="qa-cite">Authority: ECJ Case C-582/14 (Breyer v Germany, 2016) · GDPR Recital 30 · Art. 4(5)</div>`,
  },
  {
    pats: ["us only", "united states", "america", "ccpa only", "ftc only", "no eu"],
    r: `<p>If operations are exclusively US-based with no EU data subjects, GDPR does not apply. The analysis simplifies considerably: <strong>CCPA</strong> and <strong>FTC Act § 5</strong> govern.</p>
        <p>Under CCPA: VRM is personal information if reasonably linkable to a consumer. Storage is permitted with adequate privacy notice and opt-out rights. No affirmative consent required — but you must honour deletion and opt-out requests within 45 days.</p>
        <p>Under FTC Act § 5: The primary risk is deceptive data practices — if your privacy policy does not disclose VRM retention for targeting, collection without disclosure would be an unfair or deceptive act.</p>
        <p>Recommended US-only implementation: plain-language privacy notice at point of VRM capture; opt-out mechanism; no VRM sale to third parties without explicit disclosure.</p>
        <div class="qa-cite">Authority: CCPA § 1798.140 · FTC Act § 5 · FTC Privacy Framework 2012</div>`,
  },
  {
    pats: ["fine", "penalty", "sanction", "enforcement", "ico", "supervisory"],
    r: `<p>GDPR provides a tiered fine structure. For violations of core principles (Art. 5) or lawful basis requirements (Art. 6): up to <strong>€20 million or 4% of global annual turnover</strong>, whichever is higher.</p>
        <p>For lesser infringements (Art. 13/14 transparency): up to €10 million or 2% of turnover. UK GDPR mirrors these figures under the DPA 2018, with ICO enforcement powers.</p>
        <p>Practical exposure: the ICO has issued fines from £50k to £35 million in recent enforcement actions. The panel's recommendation (consent-first + pseudonymised tokens) materially reduces exposure — a documented lawful basis and technical safeguards are strong mitigating factors.</p>
        <div class="qa-cite">Authority: GDPR Art. 83 · UK GDPR s.157 DPA 2018 · ICO Regulatory Action Policy</div>`,
  },
  {
    pats: ["pseudonymis", "sha", "hash", "token", "anonymis"],
    r: `<p>The Engineer's submission uses pseudonymisation as a <em>risk reduction</em> argument — not as a basis to escape GDPR entirely. SHA-256 hashing of VRM tokens, with per-user salts and controlled access to the salt store, constitutes a technically robust pseudonymisation measure.</p>
        <p>The panel adopted this architecture as a core technical recommendation alongside the consent-first lawful basis — the two work in combination: consent is the <em>legal</em> basis, pseudonymisation is the <em>technical</em> safeguard that reduces exposure in the event of a breach or challenge.</p>
        <div class="qa-cite">Authority: GDPR Art. 4(5) · ICO Anonymisation Code of Practice 2012 · ENISA Pseudonymisation Guidelines 2019</div>`,
  },
  {
    pats: ["consent", "opt-in", "art. 7", "article 7", "freely given", "affirmative"],
    r: `<p><strong>GDPR Art. 7</strong> sets four cumulative conditions for valid consent: (1) <em>freely given</em>; (2) <em>specific</em> — to the stated purpose of VRM capture; (3) <em>informed</em>; and (4) <em>unambiguous</em> — requiring affirmative action, not pre-ticked boxes or silence.</p>
        <p>The Product Counsel's submission — RESTORED following the US Counsel's legal authority challenge — argues that a one-tap consent UX meeting these conditions is achievable at a 74% opt-in rate.</p>
        <p>Practical requirements: consent must be as easy to withdraw as to give (Art. 7(3)); records of consent must be retained (Art. 7(1)); consent cannot be bundled with T&Cs.</p>
        <div class="qa-cite">Authority: GDPR Art. 7 · WP29 Guidelines on Consent (WP259 rev.01) · EDPB Guidelines 05/2020</div>`,
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatState = "greeting" | "doc-upload" | "analysing" | "follow-up";

interface Message {
  id: number;
  role: "lq" | "user";
  content: React.ReactNode;
}

let msgId = 0;
const nextId = () => ++msgId;

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatState, setChatState] = useState<ChatState>("greeting");
  const [inputText, setInputText] = useState("");
  const [inputDisabled, setInputDisabled] = useState(true);
  const [inputPlaceholder, setInputPlaceholder] = useState("What legal question would you like to analyse?");
  const [suggestVisible, setSuggestVisible] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnyObj | null>(null);
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());
  const [selectedBriefAgent, setSelectedBriefAgent] = useState<string | null>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const scrollBottom = () => {
    setTimeout(() => {
      messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  };

  const addMsg = (role: "lq" | "user", content: React.ReactNode) => {
    const msg: Message = { id: nextId(), role, content };
    setMessages((prev) => [...prev, msg]);
    scrollBottom();
    return msg.id;
  };

  const addLQ = (content: React.ReactNode) => addMsg("lq", content);
  const addUser = (text: string) => addMsg("user", <span>{text}</span>);

  const showTyping = (cb: () => void, delay = 900) => {
    const id = addLQ(
      <div className="typing-dots"><span /><span /><span /></div>
    );
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      cb();
    }, delay);
  };

  const enableInput = (placeholder: string) => {
    setInputPlaceholder(placeholder);
    setInputDisabled(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const disableInput = () => setInputDisabled(true);

  // ── Init: greeting ─────────────────────────────────────────────────────────

  useEffect(() => {
    showTyping(() => {
      addLQ(
        <>
          <p>Welcome to <strong>LegaliQ</strong>. What legal or regulatory question would you like the panel to examine?</p>
          <p>You can type your question below, or select a scenario to get started:</p>
          <div className="sc-grid">
            {Object.entries(SCENARIOS).map(([key, s]) => (
              <span key={key} className="sc-chip" onClick={() => selectScenario(s.question)}>
                {s.label}
              </span>
            ))}
          </div>
        </>
      );
      setChatState("greeting");
      enableInput("What legal question would you like to analyse?");
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Flow ───────────────────────────────────────────────────────────────────

  const selectScenario = (q: string) => {
    addUser(q);
    handleQuestion(q);
  };

  const handleQuestion = (q: string) => {
    setChatState("doc-upload");
    setQuestion(q);
    disableInput();
    showTyping(() => {
      addLQ(<DocUploadWidget question={q} onProceed={handleProceed} fileInputRef={fileInputRef} />);
    }, 900);
  };

  const handleProceed = (hasDocs: boolean) => {
    setChatState("analysing");
    addUser(hasDocs ? "Proceeding with analysis." : "Skip — proceed without documents.");
    disableInput();
    showTyping(() => {
      runAnalysis();
    }, 700);
  };

  const runAnalysis = async () => {
    // Placeholder message that we will fill progressively
    const blockId = nextId();
    setMessages((prev) => [
      ...prev,
      { id: blockId, role: "lq", content: <AnalysisBlock key={blockId} question={question} agentMeta={AGENT_META} onDone={onAnalysisDone} /> },
    ]);
    scrollBottom();
  };

  const onAnalysisDone = (res: AnyObj) => {
    setResult(res);
    setChatState("follow-up");
    showTyping(() => {
      addLQ(
        <p>Analysis complete. The panel has reached a <strong>Nash equilibrium</strong> — no counsel can improve their position by deviating. Ask me any follow-up question about the analysis.</p>
      );
      setSuggestVisible(true);
      enableInput("Ask a follow-up question about the analysis…");
    }, 800);
  };

  // ── Input handling ─────────────────────────────────────────────────────────

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    if (chatState === "greeting") {
      addUser(text);
      handleQuestion(text);
    } else if (chatState === "follow-up") {
      addUser(text);
      handleFollowUp(text, result);
    }
  };

  const handleFollowUp = (q: string, res: AnyObj | null) => {
    disableInput();
    const lower = q.toLowerCase();
    let response: React.ReactNode = null;

    for (const pair of QA) {
      if (pair.pats.some((p) => lower.includes(p))) {
        response = <div dangerouslySetInnerHTML={{ __html: pair.r }} />;
        break;
      }
    }

    if (!response) {
      if (lower.includes("step") || lower.includes("implement") || lower.includes("action")) {
        response = (
          <>
            <p>The panel's recommended roadmap runs across four phases. Critical immediate actions:</p>
            <p><strong>Week 1–2 (Legal):</strong> Complete the ICO LIA template and determine DPO obligation.</p>
            <p><strong>Week 2–6 (Engineering):</strong> SHA-256 hashed token architecture with per-user salts and 90-day TTL.</p>
            <p><strong>Week 4–6 (Product):</strong> One-tap consent UX — target ≥74% opt-in rate.</p>
            <p><strong>Week 7–10 (Launch):</strong> Staged rollout with consent monitoring and a 6-month ICO audit scheduled from day one.</p>
          </>
        );
      } else if (res?.decision) {
        response = (
          <>
            <p><strong>Panel ruling:</strong> {res.decision.recommendation}</p>
            <p>Feel free to ask a more specific question about any jurisdiction, agent, or implementation detail.</p>
          </>
        );
      } else {
        response = (
          <p>That touches on aspects the panel hasn't specifically addressed. Ask about a specific jurisdiction, agent, legal authority, or implementation step and I'll draw from the panel record.</p>
        );
      }
    }

    showTyping(() => {
      addLQ(response);
      enableInput("Ask a follow-up question…");
    }, 900);
  };

  // ── Keyboard & resize ──────────────────────────────────────────────────────

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
        <span style={{ background: "#EEF0FF", color: "#3d5afe", fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>⚖️ Adversarial Analysis Mode</span>
      </header>

      {/* CHAT OUTER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 860, width: "100%", margin: "0 auto", overflow: "hidden", padding: "0 16px" }}>

        {/* Messages */}
        <div className="chat-messages" ref={messagesRef} style={{ flex: 1, overflowY: "auto", padding: "24px 0 12px", display: "flex", flexDirection: "column", gap: 18 }}>
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role === "lq" ? "msg-lq" : "msg-user"}`}>
              {m.role === "lq" && <div className="msg-av">LQ</div>}
              <div className="msg-bubble">{m.content}</div>
            </div>
          ))}
        </div>

        {/* Suggest chips */}
        {suggestVisible && (
          <div className="suggest-bar" style={{ display: "flex" }}>
            {SUGGEST_CHIPS.map((c) => (
              <span key={c.q} className="suggest-chip" onClick={() => { addUser(c.q); handleFollowUp(c.q, result); }}>
                {c.label}
              </span>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="input-area">
          <div className="input-wrap">
            <textarea
              ref={inputRef}
              className="chat-input"
              rows={1}
              placeholder={inputPlaceholder}
              disabled={inputDisabled}
              value={inputText}
              onChange={(e) => { setInputText(e.target.value); resize(e.target); }}
              onKeyDown={onKey}
            />
            <button className="send-btn" disabled={inputDisabled} onClick={handleSend}>→</button>
          </div>
          <div className="input-hint">Press Enter to send · Shift+Enter for new line</div>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" style={{ display: "none" }} accept=".pdf,.docx,.txt,.md,.csv" multiple />
    </div>
  );
}

// ── Doc upload widget ──────────────────────────────────────────────────────────

function DocUploadWidget({ question, onProceed, fileInputRef }: { question: string; onProceed: (hasDocs: boolean) => void; fileInputRef: React.RefObject<HTMLInputElement | null> }) {
  const [chips, setChips] = useState<{ label: string; type: "file" | "link" }[]>([]);
  const [linkVal, setLinkVal] = useState("");

  const addLink = () => {
    const url = linkVal.trim();
    if (!url) return;
    const label = url.replace(/^https?:\/\//, "").substring(0, 45);
    setChips((p) => [...p, { label: `🔗 ${label}`, type: "link" }]);
    setLinkVal("");
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setChips((p) => [...p, ...files.map((f) => ({ label: `📄 ${f.name}`, type: "file" as const }))]);
    e.target.value = "";
  };

  return (
    <>
      <p>Understood. The panel will examine:</p>
      <p><em>"{question}"</em></p>
      <p>Would you like to add supporting documents or links to inform the panel?</p>
      <div className="doc-widget">
        <div className="doc-upload-zone" onClick={() => fileInputRef.current?.click()}>
          <span style={{ fontSize: 18 }}>📎</span>
          <div>
            <strong>Attach documents</strong><br />
            <span style={{ fontSize: 10, color: "#9ca3af" }}>PDF, DOCX, TXT, MD — content used as agent context</span>
          </div>
          <input type="file" style={{ display: "none" }} accept=".pdf,.docx,.txt,.md,.csv" multiple onChange={handleFiles} />
        </div>
        <div className="doc-link-row">
          <input className="doc-url-input" type="url" placeholder="Or paste a reference link (https://…)" value={linkVal} onChange={(e) => setLinkVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()} />
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
          <button className="doc-skip" onClick={() => onProceed(false)}>Skip — proceed without documents</button>
          <button className="doc-proceed" onClick={() => onProceed(true)}>→ Proceed with analysis</button>
        </div>
      </div>
    </>
  );
}

// ── Analysis block ─────────────────────────────────────────────────────────────

function AnalysisBlock({ question, agentMeta, onDone }: { question: string; agentMeta: AnyObj; onDone: (res: AnyObj) => void }) {
  const [exchanges, setExchanges] = useState<AnyObj[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [result, setResult] = useState<AnyObj | null>(null);
  const [showConclusion, setShowConclusion] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reason", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, contexts: {} }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setResult(data);
        setExchanges(data.exchanges ?? []);
      })
      .catch((e) => setError(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate exchanges in sequentially
  useEffect(() => {
    if (!exchanges.length) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    exchanges.forEach((_, i) => {
      const t = setTimeout(() => {
        setVisibleCount(i + 1);
        if (i === exchanges.length - 1) {
          timers.push(setTimeout(() => setShowConclusion(true), 1000));
        }
      }, 400 + i * 1950);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [exchanges]);

  useEffect(() => { if (showConclusion) setTimeout(() => setShowStrategy(true), 400); }, [showConclusion]);
  useEffect(() => { if (showStrategy) setTimeout(() => setShowSteps(true), 400); }, [showStrategy]);
  useEffect(() => { if (showSteps) setTimeout(() => setShowGraph(true), 400); }, [showSteps]);
  useEffect(() => { if (showGraph && result) setTimeout(() => onDone(result), 600); }, [showGraph, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStep = (i: number) =>
    setOpenSteps((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const meta = (id: string) => (result?.agentMeta ?? agentMeta)[id] ?? { name: id, color: "#6b7280", bg: "#f9fafb" };

  if (error) return <p style={{ color: "#dc2626" }}><strong>Error:</strong> {error}</p>;

  return (
    <div className="analysis-block">

      {/* 1. Chambers Exchange */}
      <div className="analysis-section-lbl">Chambers Exchange — Adversarial Submissions</div>
      <div className="debate-track">
        {exchanges.map((ex, i) => {
          const att = meta(ex.attacker);
          const tgt = meta(ex.target);
          const visible = i < visibleCount;
          return (
            <div key={ex.id} className={`ex-card${visible ? " visible" : ""}`}>
              <div className="ex-node" style={{ background: att.color, borderColor: "#F4F5F8" }}>{i + 1}</div>
              <div className="ex-bubble" style={{ background: att.bg, borderLeftColor: att.color }}>
                <div className="ex-bub-hdr">
                  <span className="ex-att-name" style={{ color: att.color }}>{att.name}</span>
                  <span className="ex-att-jur" style={{ color: att.color }}>{att.jur}</span>
                  <span className="ex-type-badge" style={{ background: ex.typeBg, color: ex.typeColor }}>{ex.type}</span>
                </div>
                <div className="ex-target">↳ submits against <strong style={{ color: tgt.color }}>{tgt.name}</strong> ({ex.id})</div>
                <div className="ex-quote">{ex.quote}</div>
              </div>
            </div>
          );
        })}
        {!exchanges.length && (
          <div style={{ display: "flex", gap: 4, padding: "8px 0" }}>
            <div className="typing-dots"><span /><span /><span /></div>
            <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>Panel convening…</span>
          </div>
        )}
      </div>

      {/* 2. Panel Ruling */}
      {showConclusion && result && (
        <>
          <div className="analysis-section-lbl" style={{ marginTop: 22 }}>Panel Ruling</div>
          <div className="verdict-box">
            <div className="verdict-lbl">✓ Recommended Implementation</div>
            <div className="verdict-txt">{result.decision?.recommendation}</div>
          </div>
          <div className="jur-grid">
            {(result.decision?.jurisdictions ?? []).map((j: AnyObj) => (
              <div key={j.name} className="jur-card">
                <div className="jur-flag">{j.flag}</div>
                <div className="jur-name">{j.name}</div>
                <div className="jur-rule">{j.rule}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 3. Strategy */}
      {showStrategy && result && (
        <>
          <div className="analysis-section-lbl" style={{ marginTop: 22 }}>Nash Equilibrium — Strategic Options</div>
          <div className="strategy-row">
            {(result.strategies ?? []).map((s: AnyObj) => (
              <div key={s.name} className="strat-box" style={{ borderColor: s.donutBg ?? "#e5e7eb", background: s.donutBg ? `${s.donutBg}80` : "#f9fafb" }}>
                {s.optimal && <div className="strat-eq">EQUILIBRIUM</div>}
                <div className="strat-score" style={{ color: s.donutColor }}>{s.score}</div>
                <div className="strat-bar" style={{ background: s.statusBg }}>
                  <div style={{ width: `${s.score}%`, height: "100%", background: s.donutColor, borderRadius: 2 }} />
                </div>
                <div className="strat-name">{s.name}</div>
                <div className="strat-pill" style={{ background: s.statusBg, color: s.statusColor }}>{s.status}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 4. Next Steps */}
      {showSteps && result && (
        <>
          <div className="analysis-section-lbl" style={{ marginTop: 22 }}>
            Recommended Next Steps <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500, letterSpacing: 0 }}>· click to expand</span>
          </div>
          <div className="steps-list">
            {(result.nextSteps ?? []).map((s: AnyObj, i: number) => (
              <div key={i} className="step-item" onClick={() => toggleStep(i)}>
                <div className="step-hdr">
                  <div className="step-num-badge" style={{ background: s.color }}>{i + 1}</div>
                  <div className="step-info">
                    <div className="step-title-row">
                      <span className="step-phase">{s.phase}</span>
                      <span className="step-title">{s.title}</span>
                    </div>
                    <div className="step-time">{s.timeline} · {s.actions}</div>
                  </div>
                  <span className={`step-chev${openSteps.has(i) ? " open" : ""}`}>▾</span>
                </div>
                {openSteps.has(i) && (
                  <div className="step-body open">
                    <ul className="step-checklist">
                      {(s.checklist ?? []).map((item: string, j: number) => <li key={j}>{item}</li>)}
                    </ul>
                    <div className="step-owners">
                      {(s.owners ?? []).map((o: string, j: number) => <span key={j} className="step-owner-chip">{o}</span>)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 5. Argument Map (collapsible) */}
      {showGraph && result && (
        <details className="graph-details">
          <summary>⚖️ Argument map &amp; legal briefs — click any node to read the full brief</summary>
          <div className="graph-inner">
            <div>
              <ArgumentMapSVG exchanges={result.exchanges ?? []} agentMeta={result.agentMeta ?? agentMeta} selectedAgent={selectedAgent} onSelect={setSelectedAgent} />
            </div>
            <BriefPanelInline agentId={selectedAgent} agents={result.agents ?? {}} agentMeta={result.agentMeta ?? agentMeta} />
          </div>
        </details>
      )}
    </div>
  );
}

// ── Argument map SVG ──────────────────────────────────────────────────────────

const NODE_POS: AnyObj = {
  A1: { cx: 155, cy: 155 },
  A2: { cx: 370, cy: 65  },
  A3: { cx: 560, cy: 185 },
  A4: { cx: 470, cy: 295 },
  A5: { cx: 210, cy: 295 },
};

function ArgumentMapSVG({ exchanges, agentMeta, selectedAgent, onSelect }: { exchanges: AnyObj[]; agentMeta: AnyObj; selectedAgent: string | null; onSelect: (id: string) => void }) {
  const LABEL: AnyObj = { A1: "Engineer", A2: "EU Reg.", A3: "US Counsel", A4: "Product", A5: "Business" };

  const edgeColor = (type: string) =>
    type === "Direct Contention" ? "#E53935" : type === "Legal Authority Challenge" ? "#F57C00" : "#FFA000";
  const edgeDash = (type: string) =>
    type === "Direct Contention" ? undefined : type === "Legal Authority Challenge" ? "5,3" : "3,3";

  return (
    <>
      <svg className="g-svg" viewBox="0 0 700 345" style={{ overflow: "visible" }}>
        <defs>
          {["#E53935","#F57C00","#FFA000"].map((c, i) => (
            <marker key={i} id={`m${i}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={c} />
            </marker>
          ))}
        </defs>
        {exchanges.map((ex, i) => {
          const from = NODE_POS[ex.attacker], to = NODE_POS[ex.target];
          if (!from || !to) return null;
          const mx = (from.cx + to.cx) / 2 + (i % 2 === 0 ? -40 : 40);
          const my = (from.cy + to.cy) / 2 + (i % 2 === 0 ? -30 : 20);
          const color = edgeColor(ex.type);
          const markerIdx = color === "#E53935" ? 0 : color === "#F57C00" ? 1 : 2;
          return (
            <path key={ex.id}
              d={`M ${from.cx},${from.cy} Q ${mx},${my} ${to.cx},${to.cy}`}
              stroke={color} strokeWidth="1.8" fill="none"
              strokeDasharray={edgeDash(ex.type)}
              markerEnd={`url(#m${markerIdx})`} opacity=".85"
            />
          );
        })}
        {Object.entries(NODE_POS).map(([id, pos]) => {
          const m = agentMeta[id]; if (!m) return null;
          const p = pos as { cx: number; cy: number };
          return (
            <g key={id} onClick={() => onSelect(id)} style={{ cursor: "pointer" }}>
              <circle cx={p.cx} cy={p.cy} r="36" fill={m.bg} stroke={m.color} strokeWidth={selectedAgent === id ? 4 : 2} />
              <text x={p.cx} y={p.cy - 5} textAnchor="middle" fontSize="11" fontWeight="800" fill={m.color} fontFamily="Inter,system-ui">{id}</text>
              <text x={p.cx} y={p.cy + 9} textAnchor="middle" fontSize="9" fill="#374151" fontFamily="Inter,system-ui">{LABEL[id]}</text>
            </g>
          );
        })}
      </svg>
      <div className="g-legend">
        <div className="g-leg"><div style={{ width: 20, height: 2, background: "#E53935" }} />Direct Contention</div>
        <div className="g-leg"><div style={{ width: 20, borderTop: "2px dashed #F57C00" }} />Legal Authority Challenge</div>
        <div className="g-leg"><div style={{ width: 20, borderTop: "2px dotted #FFA000" }} />Factual Dispute</div>
      </div>
    </>
  );
}

// ── Brief panel inline ─────────────────────────────────────────────────────────

function BriefPanelInline({ agentId, agents, agentMeta }: { agentId: string | null; agents: AnyObj; agentMeta: AnyObj }) {
  if (!agentId) return <div className="brief-card"><div className="brief-empty">Select a node to read the legal brief</div></div>;

  const a = agentMeta[agentId] ?? { name: agentId, color: "#6b7280", bg: "#f9fafb", jur: "" };
  const b = agents[agentId] ?? {};
  const r = b.status ?? "UPHELD";
  const s = STATUS_STYLE[r] ?? { fg: "#6b7280", bg: "#f9fafb", bd: "#e5e7eb" };

  return (
    <div className="brief-card">
      <div className="bs-agent" style={{ color: a.color }}>
        <div className="bs-agent-dot" style={{ background: a.color }} />{a.name}
      </div>
      <div className="bs-jur">{a.jur} · Confidence: {b.confidence ?? "—"}%</div>
      <div className="bs-status" style={{ color: s.fg, background: s.bg, border: `1px solid ${s.bd}` }}>{r}</div>
      {[
        ["Submission", b.submission, "bold"],
        ["Factual Basis", b.factualBasis, "italic"],
        ["Legal Authority", b.legalAuthority, ""],
        ["Cited Authority", b.citedAuthority, "bold"],
        ["Qualification", b.qualification, "italic"],
      ].map(([lbl, txt, cls]) => txt ? (
        <div key={lbl as string} className="bs-sec">
          <div className="bs-lbl">{lbl}</div>
          <div className={`bs-txt${cls ? ` ${cls}` : ""}`}>{txt}</div>
        </div>
      ) : null)}
      {b.confidence != null && (
        <div className="bs-sec">
          <div className="bs-lbl">Confidence</div>
          <div className="conf-row">
            <div className="conf-bar"><div className="conf-fill" style={{ width: `${b.confidence}%`, background: a.color }} /></div>
            <strong style={{ color: a.color, fontSize: 11 }}>{b.confidence}%</strong>
          </div>
        </div>
      )}
    </div>
  );
}
