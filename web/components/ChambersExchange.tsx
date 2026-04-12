"use client";

import { useEffect, useState } from "react";

interface Exchange {
  id: string;
  type: string;
  typeColor: string;
  typeBg: string;
  attacker: string;
  target: string;
  quote: string;
  outcomeType: "sustained" | "overruled";
  outcome: string;
  outcomeDetail: string;
}
interface AgentMeta { name: string; color: string; bg: string; jur?: string }

export default function ChambersExchange({
  exchanges,
  agentMeta,
  onAnimationComplete,
}: {
  exchanges: Exchange[];
  agentMeta: Record<string, AgentMeta>;
  onAnimationComplete?: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!exchanges.length) return;
    setVisibleCount(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    exchanges.forEach((_, i) => {
      const t = setTimeout(() => {
        setVisibleCount(i + 1);
        if (i === exchanges.length - 1) {
          const t2 = setTimeout(() => onAnimationComplete?.(), 800);
          timers.push(t2);
        }
      }, 400 + i * 1900);
      timers.push(t);
    });

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchanges]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-sm font-bold text-[#1a1a2e] mb-0.5">Adversarial Submissions Record</div>
          <div className="text-xs text-gray-400">Counsel submissions in sequence — each party argues in turn</div>
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {visibleCount > 0 ? `${visibleCount} of ${exchanges.length} submissions` : ""}
        </div>
      </div>

      {/* Debate track */}
      <div className="relative">
        {/* Vertical connector line */}
        {exchanges.length > 1 && (
          <div className="absolute left-[18px] top-0 bottom-0 w-[2px] bg-gray-200" />
        )}

        {exchanges.map((ex, i) => {
          const att = agentMeta[ex.attacker] ?? { name: ex.attacker, color: "#6b7280", bg: "#f9fafb" };
          const tgt = agentMeta[ex.target]   ?? { name: ex.target,   color: "#6b7280", bg: "#f9fafb" };
          const visible = i < visibleCount;

          return (
            <div
              key={ex.id}
              className="relative pl-12 pb-5 last:pb-0"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
              }}
            >
              {/* Node circle */}
              <div
                className="absolute left-[9px] top-3 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-extrabold text-white z-10 border-2 border-white"
                style={{ background: att.color, boxShadow: `0 0 0 2px ${att.color}` }}
              >
                {i + 1}
              </div>

              {/* Bubble */}
              <div
                className="rounded-[10px] p-3.5 border-l-4"
                style={{
                  background: att.bg,
                  borderLeftColor: att.color,
                  boxShadow: "0 1px 4px rgba(0,0,0,.04)",
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: att.color }}>
                    {att.name}
                  </span>
                  {att.jur && (
                    <span className="text-[10px] opacity-65" style={{ color: att.color }}>{att.jur}</span>
                  )}
                  <span
                    className="text-[9px] font-extrabold px-2 py-0.5 rounded-lg ml-auto whitespace-nowrap"
                    style={{ background: ex.typeBg, color: ex.typeColor }}
                  >
                    {ex.type}
                  </span>
                </div>

                {/* Target row */}
                <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-1">
                  ↳ submits against{" "}
                  <span className="font-bold" style={{ color: tgt.color }}>{tgt.name}</span>
                </div>

                {/* Quote */}
                <div className="text-xs text-gray-700 leading-relaxed italic">
                  "{ex.quote}"
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
