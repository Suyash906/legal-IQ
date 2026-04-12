"use client";

interface Strategy {
  name: string;
  score: number;
  status: string;
  statusColor: string;
  statusBg: string;
  donutColor: string;
  donutBg: string;
  note: string;
  optimal: boolean;
}

const R = 34;
const C = 2 * Math.PI * R; // ≈ 213.6

export default function StrategyMatrix({ strategies }: { strategies: Strategy[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-5">
      <div className="text-sm font-bold text-[#1a1a2e] mb-0.5">Nash Equilibrium Analysis</div>
      <div className="text-xs text-gray-400 mb-6">Score = (Legal Validity × Probability) + Business Value − Regulatory Risk − Engineering Cost</div>

      <div className="grid grid-cols-3 gap-6">
        {strategies.map((s) => {
          const offset = C * (1 - s.score / 100);
          return (
            <div key={s.name} className="text-center relative">
              {s.optimal && (
                <span className="absolute -top-1 right-0 text-[8px] font-extrabold px-1.5 py-0.5 rounded-lg tracking-wide"
                  style={{ background: "#F0FDFA", color: "#0d9488", border: "1px solid #CCFBF1" }}>
                  EQUILIBRIUM
                </span>
              )}
              {/* Donut */}
              <div className="relative w-[90px] h-[90px] mx-auto mb-4">
                <svg width="90" height="90" viewBox="0 0 90 90">
                  <circle cx="45" cy="45" r={R} fill="none" stroke={s.donutBg} strokeWidth="8" />
                  <circle cx="45" cy="45" r={R} fill="none" stroke={s.donutColor} strokeWidth="8"
                    strokeDasharray={C}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 45 45)" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-[#1a1a2e]">
                  {s.score}
                </div>
              </div>

              <div className="text-xs font-bold text-[#1a1a2e] mb-1.5">{s.name}</div>
              <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-2"
                style={{ background: s.statusBg, color: s.statusColor }}>
                {s.status}
              </span>
              <p className="text-[11px] text-gray-500 leading-relaxed">{s.note}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
