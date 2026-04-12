"use client";

interface Jurisdiction { flag: string; name: string; rule: string }
interface Decision { recommendation: string; jurisdictions: Jurisdiction[] }

export default function DecisionMemo({ decision }: { decision: Decision }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-5">
      <div className="text-sm font-bold text-[#1a1a2e] mb-0.5">Panel Ruling</div>
      <div className="text-xs text-gray-400 mb-5">Synthesised finding based on counsel submissions and adversarial exchange</div>

      {/* Verdict box */}
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 mb-5">
        <div className="text-[9px] font-extrabold uppercase tracking-wider text-green-600 mb-2">✓ Recommended Implementation</div>
        <div className="text-sm font-semibold text-green-800 leading-relaxed">{decision.recommendation}</div>
      </div>

      {/* Jurisdiction grid */}
      <div className="grid grid-cols-3 gap-3">
        {decision.jurisdictions.map((j) => (
          <div key={j.name} className="rounded-xl p-4 bg-gray-50 border border-gray-200">
            <div className="text-2xl mb-1.5">{j.flag}</div>
            <div className="text-xs font-bold text-[#1a1a2e] mb-1.5">{j.name}</div>
            <div className="text-xs text-gray-500 leading-relaxed">{j.rule}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
