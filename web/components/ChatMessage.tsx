"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ComplianceReport from "./ComplianceReport";
import GraphVisualization from "./GraphVisualization";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportData = any;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: string[];
  report?: ReportData;
  isStreaming?: boolean;
}

export default function ChatMessage({ message }: { message: Message }) {
  const [activeTab, setActiveTab] = useState<"report" | "graph">("report");
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[75%]">
          {message.files && message.files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end mb-2">
              {message.files.map((f) => (
                <span key={f}
                  className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {f}
                </span>
              ))}
            </div>
          )}
          <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
            {message.content}
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1">
          U
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-white shrink-0 mt-1">
        <span className="text-sm">⚖️</span>
      </div>

      <div className="flex-1 min-w-0">
        {/* Streaming indicator */}
        {message.isStreaming && !message.content && (
          <div className="flex gap-1 items-center h-9 px-4">
            <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:300ms]" />
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-800 prose-a:text-indigo-600 prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-slate-400 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}

        {/* Embedded compliance report */}
        {message.report && (
          <div className="mt-3">
            {/* Tab bar */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-3 w-fit shadow-sm">
              <TabBtn active={activeTab === "report"} onClick={() => setActiveTab("report")}>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Report
              </TabBtn>
              <TabBtn active={activeTab === "graph"} onClick={() => setActiveTab("graph")}>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Graph
              </TabBtn>
            </div>
            {activeTab === "report" && <ComplianceReport data={message.report} />}
            {activeTab === "graph"  && <GraphVisualization data={message.report} />}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
        ${active ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
      {children}
    </button>
  );
}
