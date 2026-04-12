"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Article {
  article_id: string;
  section: string;
  what_it_covers: string;
  relevance: string;
  regulation: string;
  jurisdiction: string;
  matched_tags: string[];
}

interface ReportData {
  tags: string[];
  articles: Article[];
  conflicts: Array<{ tag_a: string; tag_b: string }>;
  regulations: Array<{ regulation: string; jurisdiction: string; article_count: number }>;
}

interface GNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  nodeType: "regulation" | "article" | "tag";
  tagType?: string;
  jurisdiction?: string;
  detail?: string;
}

interface GLink extends d3.SimulationLinkDatum<GNode> {
  source: string | GNode;
  target: string | GNode;
  linkType: "BELONGS_TO" | "TAGGED_AS" | "CONFLICTS_WITH";
}

// ── Colours ───────────────────────────────────────────────────────────────────

const JURISDICTION_COLOR: Record<string, string> = {
  EU: "#4f46e5",
  "US (Federal)": "#dc2626",
  California: "#7c3aed",
};

const TAG_TYPE_COLOR: Record<string, string> = {
  classification: "#8b5cf6",
  constraint: "#f59e0b",
  right: "#10b981",
  risk: "#ef4444",
  requirement: "#f97316",
  rule: "#6366f1",
};

const LINK_COLOR: Record<string, string> = {
  BELONGS_TO: "#cbd5e1",
  TAGGED_AS: "#818cf8",
  CONFLICTS_WITH: "#ef4444",
};

const TAG_TYPE_MAP: Record<string, string> = {
  PERSONAL_DATA_CLASSIFICATION: "classification", LINKABILITY_TEST: "classification",
  AI_RISK_CLASSIFICATION: "classification", DATA_SOURCE_DEPENDENCY: "classification",
  DATA_MINIMISATION_CONSTRAINT: "constraint", RETENTION_LIMIT: "constraint",
  FAIRNESS_CONSTRAINT: "constraint", SYSTEM_DESIGN_CONSTRAINT: "constraint",
  DEVICE_STORAGE_RULE: "constraint", SALES_RESTRICTION: "constraint",
  USER_RIGHT_OVERRIDE: "right", CONSUMER_RIGHTS_NODE: "right",
  DELETION_NODE: "right", OPT_OUT_REQUIREMENT: "right", DELETION_REQUIREMENT: "right",
  CRIMINAL_LIABILITY: "risk", FINANCIAL_RISK: "risk",
  HIGH_RISK_RULE: "risk", BREACH_LIABILITY: "risk",
  DPA_REQUIREMENT: "requirement", NOTICE_OBLIGATION: "requirement",
  DISCLOSURE_REQUIREMENT: "requirement", TRANSPARENCY_REQUIREMENT: "requirement",
  SECURITY_BASELINE: "requirement", RISK_MANAGEMENT_OBLIGATION: "requirement",
  COMPLIANCE_BASELINE: "requirement", ENFORCEMENT_BACKSTOP: "requirement",
};

function nodeColor(n: GNode): string {
  if (n.nodeType === "regulation") return JURISDICTION_COLOR[n.jurisdiction ?? ""] ?? "#4f46e5";
  if (n.nodeType === "tag") return TAG_TYPE_COLOR[n.tagType ?? "rule"] ?? "#6366f1";
  return "#0ea5e9";
}

function nodeRadius(n: GNode): number {
  if (n.nodeType === "regulation") return 16;
  if (n.nodeType === "article") return 10;
  return 6;
}

// ── Graph data builder ────────────────────────────────────────────────────────

function buildGraphData(data: ReportData) {
  const nodes: GNode[] = [];
  const links: GLink[] = [];
  const seen = new Set<string>();

  const addNode = (n: GNode) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n); } };

  for (const r of data.regulations) {
    addNode({ id: r.regulation, label: r.regulation, nodeType: "regulation",
      jurisdiction: r.jurisdiction, detail: `${r.jurisdiction} · ${r.article_count} articles` });
  }

  for (const a of data.articles) {
    addNode({ id: a.article_id, label: a.section, nodeType: "article", detail: a.what_it_covers });
    links.push({ source: a.article_id, target: a.regulation, linkType: "BELONGS_TO" });
  }

  const allTags = new Set([
    ...data.tags,
    ...data.articles.flatMap((a) => a.matched_tags as string[]),
  ]);
  for (const tag of allTags) {
    const tagType = TAG_TYPE_MAP[tag] ?? "rule";
    addNode({ id: tag, label: tag.replace(/_/g, " "), nodeType: "tag",
      tagType, detail: `tag · ${tagType}` });
  }

  for (const a of data.articles) {
    for (const tag of (a.matched_tags as string[])) {
      links.push({ source: a.article_id, target: tag, linkType: "TAGGED_AS" });
    }
  }

  const conflictSeen = new Set<string>();
  for (const c of data.conflicts) {
    const key = [c.tag_a, c.tag_b].sort().join("||");
    if (!conflictSeen.has(key)) {
      conflictSeen.add(key);
      links.push({ source: c.tag_a, target: c.tag_b, linkType: "CONFLICTS_WITH" });
    }
  }

  return { nodes, links };
}

// ── Legend items ──────────────────────────────────────────────────────────────

const NODE_LEGEND = [
  { label: "Regulation (EU)", color: JURISDICTION_COLOR.EU },
  { label: "Regulation (US Federal)", color: JURISDICTION_COLOR["US (Federal)"] },
  { label: "Regulation (California)", color: JURISDICTION_COLOR.California },
  { label: "Article", color: "#0ea5e9" },
  { label: "Tag: classification", color: TAG_TYPE_COLOR.classification },
  { label: "Tag: constraint", color: TAG_TYPE_COLOR.constraint },
  { label: "Tag: right", color: TAG_TYPE_COLOR.right },
  { label: "Tag: risk", color: TAG_TYPE_COLOR.risk },
  { label: "Tag: requirement", color: TAG_TYPE_COLOR.requirement },
  { label: "Tag: rule", color: TAG_TYPE_COLOR.rule },
];

const EDGE_LEGEND = [
  { label: "BELONGS_TO", color: LINK_COLOR.BELONGS_TO, dashed: false },
  { label: "TAGGED_AS", color: LINK_COLOR.TAGGED_AS, dashed: false },
  { label: "CONFLICTS_WITH", color: LINK_COLOR.CONFLICTS_WITH, dashed: true },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphVisualization({ data }: { data: ReportData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<GNode, GLink> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const [hovered, setHovered] = useState<GNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { nodes, links } = useCallback(() => buildGraphData(data), [data])();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d")!;

    // Clone nodes/links so D3 can mutate them with positions
    const simNodes: GNode[] = nodes.map((n) => ({ ...n }));
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: GLink[] = links.map((l) => ({
      ...l,
      source: typeof l.source === "string" ? l.source : (l.source as GNode).id,
      target: typeof l.target === "string" ? l.target : (l.target as GNode).id,
    }));

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.k, transformRef.current.k);

      // Draw edges
      for (const link of simLinks) {
        const s = typeof link.source === "string" ? nodeById.get(link.source) : link.source as GNode;
        const t = typeof link.target === "string" ? nodeById.get(link.target) : link.target as GNode;
        if (!s?.x || !t?.x) continue;

        ctx.beginPath();
        ctx.moveTo(s.x!, s.y!);
        ctx.lineTo(t.x!, t.y!);
        ctx.strokeStyle = LINK_COLOR[link.linkType] ?? "#94a3b8";
        ctx.lineWidth = link.linkType === "CONFLICTS_WITH" ? 2 : 1;
        ctx.globalAlpha = link.linkType === "BELONGS_TO" ? 0.4 : 0.7;
        if (link.linkType === "CONFLICTS_WITH") {
          ctx.setLineDash([5, 4]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Arrow for non-conflict edges
        if (link.linkType !== "CONFLICTS_WITH" && s.x !== undefined && t.x !== undefined) {
          const dx = t.x! - s.x!;
          const dy = t.y! - s.y!;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const tr = nodeRadius(t);
          const ax = t.x! - (dx / len) * (tr + 2);
          const ay = t.y! - (dy / len) * (tr + 2);
          const angle = Math.atan2(dy, dx);
          const arrowSize = 5;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax - arrowSize * Math.cos(angle - 0.4), ay - arrowSize * Math.sin(angle - 0.4));
          ctx.lineTo(ax - arrowSize * Math.cos(angle + 0.4), ay - arrowSize * Math.sin(angle + 0.4));
          ctx.closePath();
          ctx.fillStyle = LINK_COLOR[link.linkType] ?? "#94a3b8";
          ctx.globalAlpha = 0.7;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Draw nodes
      for (const node of simNodes) {
        if (node.x === undefined) continue;
        const r = nodeRadius(node);
        const color = nodeColor(node);

        // Shadow for regulations
        if (node.nodeType === "regulation") {
          ctx.shadowColor = color + "55";
          ctx.shadowBlur = 12;
        }

        ctx.beginPath();
        ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        const showLabel = node.nodeType === "regulation" || node.nodeType === "article";
        if (showLabel) {
          ctx.font = node.nodeType === "regulation" ? "bold 9px Inter, sans-serif" : "8px Inter, sans-serif";
          ctx.fillStyle = "#1e293b";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          // Truncate long labels
          const maxW = node.nodeType === "regulation" ? 90 : 70;
          let label = node.label;
          if (ctx.measureText(label).width > maxW) {
            while (ctx.measureText(label + "…").width > maxW && label.length > 0) label = label.slice(0, -1);
            label += "…";
          }
          ctx.fillText(label, node.x!, node.y! + r + 3);
        }
      }

      ctx.restore();
    }

    // D3 force simulation
    const sim = d3.forceSimulation<GNode>(simNodes)
      .force("link", d3.forceLink<GNode, GLink>(simLinks).id((d) => d.id).distance((l) => {
        const lt = (l as GLink).linkType;
        return lt === "BELONGS_TO" ? 90 : lt === "TAGGED_AS" ? 60 : 50;
      }).strength(0.6))
      .force("charge", d3.forceManyBody().strength((n) =>
        (n as GNode).nodeType === "regulation" ? -400 : (n as GNode).nodeType === "article" ? -150 : -80
      ))
      .force("center", d3.forceCenter(W / 2, H / 2).strength(0.05))
      .force("collide", d3.forceCollide<GNode>((n) => nodeRadius(n) + 8))
      .on("tick", draw);

    simRef.current = sim;

    // Zoom + pan
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (e) => {
        transformRef.current = e.transform;
        draw();
      });

    d3.select(canvas).call(zoom);

    // Hover detection
    function findNodeAt(ex: number, ey: number): GNode | null {
      const t = transformRef.current;
      const mx = (ex - t.x) / t.k;
      const my = (ey - t.y) / t.k;
      for (const n of simNodes) {
        if (n.x === undefined) continue;
        const r = nodeRadius(n);
        const dx = mx - n.x!;
        const dy = my - n.y!;
        if (dx * dx + dy * dy <= (r + 4) ** 2) return n;
      }
      return null;
    }

    function onMouseMove(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ex = e.clientX - rect.left;
      const ey = e.clientY - rect.top;
      setMousePos({ x: e.clientX, y: e.clientY });
      const found = findNodeAt(ex, ey);
      setHovered(found);
      canvas.style.cursor = found ? "pointer" : "grab";
    }

    canvas.addEventListener("mousemove", onMouseMove);

    return () => {
      sim.stop();
      canvas.removeEventListener("mousemove", onMouseMove);
      d3.select(canvas).on(".zoom", null);
    };
  }, [nodes, links]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-bold text-slate-800">Knowledge Graph</h3>
        <span className="text-xs text-slate-400">
          {nodes.length} nodes · {links.length} edges · scroll to zoom · drag to pan
        </span>
      </div>

      <div className="flex">
        {/* Canvas */}
        <div ref={containerRef} className="relative flex-1" style={{ height: 560 }}>
          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Hover tooltip (follows mouse via fixed positioning) */}
          {hovered && (
            <div
              className="fixed z-50 bg-white/95 border border-slate-200 rounded-xl shadow-lg px-3.5 py-2.5 max-w-xs pointer-events-none"
              style={{ left: mousePos.x + 14, top: mousePos.y - 10 }}>
              <p className="text-xs font-bold text-slate-800 mb-0.5 leading-snug">{hovered.label}</p>
              {hovered.detail && <p className="text-xs text-slate-500">{hovered.detail}</p>}
              <span className={`mt-1.5 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                hovered.nodeType === "regulation" ? "bg-indigo-100 text-indigo-700" :
                hovered.nodeType === "article"    ? "bg-sky-100 text-sky-700" :
                                                    "bg-slate-100 text-slate-600"}`}>
                {hovered.nodeType === "tag" ? `tag · ${hovered.tagType}` : hovered.nodeType}
              </span>
            </div>
          )}
        </div>

        {/* Legend sidebar */}
        <div className="w-44 shrink-0 border-l border-slate-100 px-4 py-4 bg-slate-50 overflow-y-auto" style={{ height: 560 }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Nodes</p>
          <div className="space-y-2 mb-5">
            {NODE_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-slate-600 leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Edges</p>
          <div className="space-y-2">
            {EDGE_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <svg width="20" height="8" className="shrink-0">
                  <line x1="0" y1="4" x2="20" y2="4"
                    stroke={item.color} strokeWidth="2"
                    strokeDasharray={item.dashed ? "4 3" : undefined} />
                </svg>
                <span className="text-[10px] text-slate-600 leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
