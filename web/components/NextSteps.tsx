"use client";

import { useState } from "react";

interface Step {
  phase: string;
  title: string;
  timeline: string;
  actions: string;
  color: string;
  checklist?: string[];
  owners?: string[];
}

export default function NextSteps({ steps }: { steps: Step[] }) {
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setOpenSteps((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
      <div className="text-sm font-bold text-[#1a1a2e] mb-0.5">Implementation Roadmap</div>
      <div className="text-xs text-gray-400 mb-5">
        Click any step to expand the action checklist · Sequenced from panel ruling
      </div>

      <div className="grid grid-cols-4 gap-3">
        {steps.map((step, i) => {
          const isOpen = openSteps.has(i);
          return (
            <div
              key={i}
              className="rounded-[10px] border border-gray-200 overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
              style={{ borderTop: `4px solid ${step.color}`, background: "#f9fafb" }}
              onClick={() => toggle(i)}
            >
              {/* Card header */}
              <div className="p-3.5 flex flex-col gap-0">
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
                    style={{ background: step.color }}
                  >
                    {i + 1}
                  </div>
                  <span
                    className="text-xs text-gray-400 transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                  >
                    ▾
                  </span>
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{step.phase}</div>
                <div className="text-xs font-bold text-[#1a1a2e] leading-tight mb-1">{step.title}</div>
                <div className="text-[10px] text-gray-400 mb-2">{step.timeline}</div>
                <div className="text-[11px] text-gray-600 leading-relaxed">{step.actions}</div>
              </div>

              {/* Expandable detail */}
              {isOpen && (
                <div className="border-t border-gray-200 p-3.5 bg-white">
                  {step.checklist && step.checklist.length > 0 && (
                    <ul className="flex flex-col gap-1.5 mb-3">
                      {step.checklist.map((item, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-[11px] text-gray-700 leading-relaxed">
                          <span className="text-gray-400 font-bold flex-shrink-0 mt-[1px]">→</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {step.owners && step.owners.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-[9px] font-extrabold uppercase tracking-wide text-gray-400 mb-1.5">Owners</div>
                      <div className="flex flex-wrap gap-1">
                        {step.owners.map((owner, j) => (
                          <span key={j} className="text-[10px] font-semibold bg-gray-100 text-gray-600 rounded-md px-2 py-0.5">
                            {owner}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
