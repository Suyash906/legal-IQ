"use client";

interface Article {
  article_id: string;
  section: string;
  what_it_covers: string;
  relevance: string;
  regulation: string;
  jurisdiction: string;
  matched_tags: string[];
}

interface Conflict {
  tag_a: string;
  tag_b: string;
}

interface Regulation {
  regulation: string;
  jurisdiction: string;
  article_count: number;
}

interface Decision {
  verdict: "COMPLIANT" | "NON_COMPLIANT" | "CONDITIONAL" | "INSUFFICIENT_DATA";
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
  key_issues: string[];
  recommendations: string[];
  conflict_resolutions: Array<{ conflict: string; resolution: string }>;
}

interface ReportData {
  files: string[];
  tags: string[];
  tag_reasoning: string;
  regulations: Regulation[];
  articles: Article[];
  conflicts: Conflict[];
  decision: Decision;
}

const VERDICT_CONFIG = {
  COMPLIANT: { label: "Compliant", bg: "bg-green-50", border: "border-green-300", text: "text-green-700", dot: "bg-green-500" },
  NON_COMPLIANT: { label: "Non-Compliant", bg: "bg-red-50", border: "border-red-300", text: "text-red-700", dot: "bg-red-500" },
  CONDITIONAL: { label: "Conditional", bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", dot: "bg-amber-500" },
  INSUFFICIENT_DATA: { label: "Insufficient Data", bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-700", dot: "bg-slate-400" },
};

const RISK_CONFIG = {
  LOW: { label: "Low Risk", color: "text-green-600", bg: "bg-green-100" },
  MEDIUM: { label: "Medium Risk", color: "text-amber-600", bg: "bg-amber-100" },
  HIGH: { label: "High Risk", color: "text-orange-600", bg: "bg-orange-100" },
  CRITICAL: { label: "Critical Risk", color: "text-red-600", bg: "bg-red-100" },
};

const JURISDICTION_COLOR: Record<string, string> = {
  EU: "bg-blue-100 text-blue-700",
  "US (Federal)": "bg-red-100 text-red-700",
  California: "bg-purple-100 text-purple-700",
};

export default function ComplianceReport({ data }: { data: ReportData }) {
  const verdict = VERDICT_CONFIG[data.decision.verdict];
  const risk = RISK_CONFIG[data.decision.risk_level];

  // Group articles by regulation
  const byRegulation = data.articles.reduce<Record<string, Article[]>>((acc, a) => {
    const key = `${a.regulation} (${a.jurisdiction})`;
    (acc[key] = acc[key] ?? []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">

      {/* ── Verdict banner ── */}
      <div className={`rounded-2xl border-2 ${verdict.border} ${verdict.bg} p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`inline-block h-3 w-3 rounded-full ${verdict.dot} mt-1`} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Compliance Verdict</p>
              <h2 className={`text-2xl font-bold ${verdict.text}`}>{verdict.label}</h2>
            </div>
          </div>
          <span className={`shrink-0 text-sm font-semibold px-3 py-1 rounded-full ${risk.bg} ${risk.color}`}>
            {risk.label}
          </span>
        </div>
        <p className="mt-4 text-slate-700 leading-relaxed">{data.decision.summary}</p>

        {/* Files analysed */}
        <div className="mt-4 flex flex-wrap gap-2">
          {data.files.map((f) => (
            <span key={f} className="text-xs bg-white/70 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-full">
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Key issues */}
        {data.decision.key_issues.length > 0 && (
          <Section title="Key Issues" icon="⚠️">
            <ul className="space-y-2">
              {data.decision.key_issues.map((issue, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 shrink-0 text-amber-500">▸</span>
                  {issue}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Recommendations */}
        {data.decision.recommendations.length > 0 && (
          <Section title="Recommendations" icon="✅">
            <ul className="space-y-2">
              {data.decision.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 shrink-0 text-green-500">▸</span>
                  {rec}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* ── Active conflicts ── */}
      {data.conflicts.length > 0 && (
        <Section title={`Detected Conflicts (${data.conflicts.length})`} icon="⚡">
          <div className="space-y-3">
            {data.decision.conflict_resolutions.map((cr, i) => (
              <div key={i} className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm font-mono font-semibold text-red-700 mb-1">{cr.conflict}</p>
                <p className="text-sm text-slate-600">{cr.resolution}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Regulations overview ── */}
      <Section title={`Applicable Regulations (${data.regulations.length})`} icon="📜">
        <div className="flex flex-wrap gap-3">
          {data.regulations.map((r) => (
            <div key={r.regulation}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${JURISDICTION_COLOR[r.jurisdiction] ?? "bg-slate-100 text-slate-600"}`}>
                {r.jurisdiction}
              </span>
              <span className="text-sm font-medium text-slate-800">{r.regulation}</span>
              <span className="text-xs text-slate-400">{r.article_count} articles</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Matched tags ── */}
      <Section title={`Identified Compliance Tags (${data.tags.length})`} icon="🏷️">
        <p className="text-xs text-slate-500 mb-3">{data.tag_reasoning}</p>
        <div className="flex flex-wrap gap-2">
          {data.tags.map((tag) => (
            <span key={tag}
              className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg">
              {tag}
            </span>
          ))}
        </div>
      </Section>

      {/* ── Articles by regulation ── */}
      <Section title="Relevant Legal Articles" icon="📋">
        <div className="space-y-6">
          {Object.entries(byRegulation).map(([regKey, arts]) => (
            <div key={regKey}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{regKey}</h4>
              <div className="space-y-3">
                {arts.map((a) => (
                  <div key={a.article_id}
                    className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div>
                        <span className="text-xs font-mono font-semibold text-indigo-600">{a.article_id}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="text-sm font-semibold text-slate-800">{a.what_it_covers}</span>
                      </div>
                    </div>
                    {a.relevance && (
                      <p className="text-xs text-slate-500 mb-2">{a.relevance}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(a.matched_tags as string[]).map((tag) => (
                        <span key={tag}
                          className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}
