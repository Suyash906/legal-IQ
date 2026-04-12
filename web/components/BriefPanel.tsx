"use client";

interface AgentBrief {
  status: string;
  submission: string;
  factualBasis: string;
  legalAuthority: string;
  citedAuthority: string;
  qualification: string;
  confidence: number;
}
interface ExchangeRef { id: string; from?: string; to?: string; type: string; color: string; summary: string }
interface AgentExchanges { objections: ExchangeRef[]; challenges: ExchangeRef[] }
interface AgentMeta { name: string; jur: string; color: string; bg: string }

interface Props {
  agentId: string | null;
  agents: Record<string, AgentBrief>;
  agentExchangeMap: Record<string, AgentExchanges>;
  agentMeta: Record<string, AgentMeta>;
}

const STATUS_STYLE: Record<string, { fg: string; bg: string; border: string }> = {
  UPHELD:        { fg: "#16a34a", bg: "#F0FDF4", border: "#BBF7D0" },
  "UNDER DISPUTE":{ fg: "#dc2626", bg: "#FEF2F2", border: "#FECACA" },
  RESTORED:      { fg: "#7B1FA2", bg: "#F5F0FB", border: "#E1BEE7" },
};

export default function BriefPanel({ agentId, agents, agentExchangeMap, agentMeta }: Props) {
  if (!agentId) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col items-center justify-center" style={{ minHeight: 400 }}>
        <div className="text-4xl mb-3">⚖️</div>
        <div className="text-xs text-gray-400 text-center leading-relaxed">
          Select a counsel node<br />to read the full legal brief
        </div>
      </div>
    );
  }

  const brief = agents[agentId];
  const meta  = agentMeta[agentId];
  const exch  = agentExchangeMap?.[agentId] ?? { objections: [], challenges: [] };
  const st    = STATUS_STYLE[brief?.status] ?? STATUS_STYLE.UPHELD;

  if (!brief || !meta) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm overflow-y-auto" style={{ maxHeight: 520 }}>
      {/* Agent header */}
      <div className="flex items-center gap-2 mb-0.5">
        <div className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
        <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: meta.color }}>{meta.name}</span>
      </div>
      <div className="text-[10px] text-gray-400 mb-3">{meta.jur} &nbsp;·&nbsp; Confidence: {brief.confidence}%</div>

      <span className="inline-block text-[10px] font-extrabold tracking-wide px-2.5 py-1 rounded-lg mb-4"
        style={{ color: st.fg, background: st.bg, border: `1px solid ${st.border}` }}>
        {brief.status}
      </span>

      {[
        { label: "① Submission",          value: brief.submission,      bold: true  },
        { label: "② Factual Basis",        value: brief.factualBasis,    italic: true },
        { label: "Legal Authority · Pursuant To", value: brief.legalAuthority },
        { label: "Cited Authority",        value: brief.citedAuthority,  bold: true  },
        { label: "Qualification · Save Where", value: brief.qualification, italic: true },
      ].map(({ label, value, bold, italic }) => (
        <div key={label} className="mb-3">
          <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">
            {label}
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className={`text-xs leading-relaxed text-gray-700 ${bold ? "font-semibold text-[#1a1a2e]" : ""} ${italic ? "italic" : ""}`}>
            {value}
          </div>
        </div>
      ))}

      {/* Confidence bar */}
      <div className="mb-4">
        <div className="text-[9px] font-extrabold uppercase tracking-widest text-gray-400 mb-1.5">Confidence</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-200 rounded-full">
            <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${brief.confidence}%`, background: meta.color }} />
          </div>
          <span className="text-xs font-extrabold min-w-[32px]" style={{ color: meta.color }}>{brief.confidence}%</span>
        </div>
      </div>

      {/* Objections received */}
      {exch.objections.length > 0 && (
        <>
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-gray-600 mb-2 mt-4 pt-3 border-t border-gray-100">
            Objections Received ({exch.objections.length})
          </div>
          {exch.objections.map((o) => (
            <div key={o.id} className="rounded-lg mb-2 p-2.5 pl-3" style={{ borderLeft: `3px solid ${o.color}`, background: `${o.color}10` }}>
              <div className="text-[9px] font-extrabold uppercase tracking-wide mb-1" style={{ color: o.color }}>
                {o.type} · {o.id} from {agentMeta[o.from ?? ""]?.name ?? o.from}
              </div>
              <div className="text-[11px] text-gray-500 italic leading-snug">"{o.summary}"</div>
            </div>
          ))}
        </>
      )}

      {/* Challenges raised */}
      {exch.challenges.length > 0 && (
        <>
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-gray-600 mb-2 mt-4 pt-3 border-t border-gray-100">
            Submissions Advanced ({exch.challenges.length})
          </div>
          {exch.challenges.map((c) => (
            <div key={c.id} className="rounded-lg mb-2 p-2.5 pl-3" style={{ borderLeft: `3px solid ${c.color}`, background: `${c.color}10` }}>
              <div className="text-[9px] font-extrabold uppercase tracking-wide mb-1" style={{ color: c.color }}>
                {c.type} · {c.id} → {agentMeta[c.to ?? ""]?.name ?? c.to}
              </div>
              <div className="text-[11px] text-gray-500 italic leading-snug">"{c.summary}"</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
