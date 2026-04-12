"use client";

interface AgentMeta { name: string; jur: string; color: string; bg: string }
interface Exchange { id: string; type: string; typeColor: string; attacker: string; target: string }

interface Props {
  agentMeta: Record<string, AgentMeta>;
  exchanges: Exchange[];
  selectedAgent: string | null;
  onSelectAgent: (id: string) => void;
}

// Fixed node positions (matching the original mockup layout)
const POSITIONS: Record<string, { cx: number; cy: number }> = {
  A1: { cx: 155, cy: 155 },
  A2: { cx: 370, cy: 65  },
  A3: { cx: 560, cy: 185 },
  A4: { cx: 470, cy: 295 },
  A5: { cx: 210, cy: 295 },
};

function edgePath(from: string, to: string): string {
  const s = POSITIONS[from];
  const t = POSITIONS[to];
  if (!s || !t) return "";
  const mx = (s.cx + t.cx) / 2;
  const my = (s.cy + t.cy) / 2 - 40;
  return `M ${s.cx},${s.cy} Q ${mx},${my} ${t.cx},${t.cy}`;
}

const EDGE_STYLE: Record<string, { dash: string; markerId: string }> = {
  "Direct Contention":       { dash: "none",   markerId: "m-contention" },
  "Legal Authority Challenge":{ dash: "5,3",   markerId: "m-authority"  },
  "Factual Dispute":         { dash: "3,3",    markerId: "m-factual"    },
};

export default function ArgumentMap({ agentMeta, exchanges, selectedAgent, onSelectAgent }: Props) {
  return (
    <div className="arg-card bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="text-sm font-bold text-[#1a1a2e] mb-0.5">Adversarial Argument Graph</div>
      <div className="text-xs text-gray-400 mb-3">Select a counsel node to read the full legal brief · Edges show objections between submissions</div>

      <svg viewBox="0 0 700 360" className="w-full" style={{ height: 290 }}>
        <defs>
          {["contention", "authority", "factual"].map((t) => (
            <marker key={t} id={`m-${t}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={t === "contention" ? "#E53935" : t === "authority" ? "#F57C00" : "#FFA000"} />
            </marker>
          ))}
        </defs>

        {/* Edges */}
        {exchanges.map((ex, i) => {
          const style = EDGE_STYLE[ex.type] ?? { dash: "none", markerId: "m-contention" };
          return (
            <path
              key={i}
              d={edgePath(ex.attacker, ex.target)}
              stroke={ex.typeColor}
              strokeWidth="1.8"
              fill="none"
              strokeDasharray={style.dash === "none" ? undefined : style.dash}
              markerEnd={`url(#${style.markerId})`}
              opacity={0.85}
            />
          );
        })}

        {/* Agent nodes */}
        {Object.entries(POSITIONS).map(([id, { cx, cy }]) => {
          const meta = agentMeta[id];
          if (!meta) return null;
          const isSelected = selectedAgent === id;
          return (
            <g key={id} onClick={() => onSelectAgent(id)} style={{ cursor: "pointer" }}>
              <circle
                cx={cx} cy={cy} r={36}
                fill={meta.bg}
                stroke={meta.color}
                strokeWidth={isSelected ? 3.5 : 2}
                style={{ transition: "stroke-width .2s" }}
                filter={isSelected ? `drop-shadow(0 0 6px ${meta.color}66)` : undefined}
              />
              <text x={cx} y={cy - 5} textAnchor="middle" fontSize={11} fontWeight={800} fill={meta.color} fontFamily="Inter,system-ui">{id}</text>
              <text x={cx} y={cy + 9} textAnchor="middle" fontSize={9} fill="#374151" fontFamily="Inter,system-ui">{meta.name.split(" ")[0]}</text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2 pt-2 border-t border-gray-100 flex-wrap">
        {[
          { label: "Direct Contention",        color: "#E53935", dash: false },
          { label: "Legal Authority Challenge", color: "#F57C00", dash: true  },
          { label: "Factual Dispute",           color: "#FFA000", dots: true  },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <svg width="22" height="8">
              <line x1="0" y1="4" x2="22" y2="4"
                stroke={l.color} strokeWidth="2"
                strokeDasharray={"dots" in l && l.dots ? "3,3" : l.dash ? "5,3" : undefined} />
            </svg>
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
