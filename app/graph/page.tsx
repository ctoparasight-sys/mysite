"use client";

// =================================================================
// app/graph/page.tsx — Carrierwave RO Relationship Graph
//
// Interactive D3 force-directed graph showing all ROs as nodes
// and their relationships as edges.
// =================================================================

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";

// ── Types ─────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string;
  title: string;
  roType: string;
  species: string;
  minted: boolean;
  diseaseAreaTags: string[];
  confidence: number;
}

interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

// ── Constants ─────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  new_finding:               "#4f8cff",
  negative_result:           "#ff9f43",
  replication_successful:    "#2eddaa",
  replication_unsuccessful:  "#ff6b6b",
  methodology:               "#a29bfe",
  materials_reagents:        "#74b9ff",
  data_update:               "#81ecec",
};

const EDGE_COLORS: Record<string, string> = {
  replicates:       "#2eddaa",
  contradicts:      "#ff6b6b",
  extends:          "#4f8cff",
  derives_from:     "#ff9f43",
  uses_method_from: "#a78bfa",
};

const EDGE_LABELS: Record<string, string> = {
  replicates:       "replicates",
  contradicts:      "contradicts",
  extends:          "extends",
  derives_from:     "derives from",
  uses_method_from: "uses method from",
};

function nodeRadius(confidence: number): number {
  if (confidence >= 3) return 10;
  if (confidence >= 2) return 8;
  return 6;
}

// ── Styles ────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@300;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #080b11;
    --surface: #0f1420;
    --surface2:#131926;
    --border:  #1a2035;
    --muted:   #2e3650;
    --subtle:  #4a5580;
    --text:    #c8d0e8;
    --bright:  #e8edf8;
    --accent:  #4f8cff;
    --accent2: #2eddaa;
    --warn:    #ff6b6b;
    --mono:    'DM Mono', monospace;
    --sans:    'DM Sans', system-ui, sans-serif;
    --r:       10px;
    --t:       160ms ease;
  }

  body {
    background: var(--bg); color: var(--text);
    font-family: var(--sans); font-size: 15px;
    margin: 0; overflow: hidden;
  }

  .graph-wrap {
    width: 100vw; height: 100vh;
    display: flex; flex-direction: column;
    position: relative;
  }

  .graph-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 24px;
    border-bottom: 1px solid var(--border);
    background: rgba(8,11,17,0.9);
    backdrop-filter: blur(12px);
    z-index: 10;
    flex-shrink: 0;
  }
  .graph-wordmark {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 20px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.3px;
  }
  .graph-wordmark em { color: var(--accent); font-style: italic; }
  .graph-nav-links {
    display: flex; gap: 8px; align-items: center;
  }
  .graph-nav-link {
    font-family: var(--mono); font-size: 12px; color: var(--subtle);
    text-decoration: none; padding: 6px 12px; border-radius: 6px;
    border: 1px solid var(--border); transition: all var(--t);
  }
  .graph-nav-link:hover { color: var(--accent); border-color: var(--subtle); }

  .graph-canvas {
    flex: 1; position: relative;
  }
  .graph-canvas svg {
    width: 100%; height: 100%;
    cursor: grab;
  }
  .graph-canvas svg:active { cursor: grabbing; }

  .graph-legend {
    position: absolute; bottom: 20px; left: 20px;
    background: rgba(15,20,32,0.92); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px 18px;
    z-index: 10; backdrop-filter: blur(8px);
  }
  .graph-legend-title {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--subtle); margin-bottom: 10px;
  }
  .graph-legend-item {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--mono); font-size: 11px; color: var(--text);
    margin-bottom: 5px;
  }
  .graph-legend-item:last-child { margin-bottom: 0; }
  .graph-legend-line {
    width: 20px; height: 2px; border-radius: 1px; flex-shrink: 0;
  }
  .graph-legend-dash {
    width: 20px; height: 0; border-top: 2px dashed; flex-shrink: 0;
  }

  .graph-stats {
    position: absolute; top: 20px; right: 20px;
    background: rgba(15,20,32,0.92); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 18px;
    z-index: 10; backdrop-filter: blur(8px);
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
  }
  .graph-stats-num { color: var(--bright); font-weight: 500; }

  .graph-empty {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 16px;
    font-family: var(--mono); font-size: 13px; color: var(--subtle);
  }
  .graph-empty-icon { font-size: 48px; opacity: 0.4; }

  .graph-tooltip {
    position: absolute; pointer-events: none; z-index: 20;
    background: rgba(15,20,32,0.95); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 14px;
    font-size: 12px; color: var(--bright);
    max-width: 280px; backdrop-filter: blur(8px);
    opacity: 0; transition: opacity 100ms ease;
  }
  .graph-tooltip.visible { opacity: 1; }
  .graph-tooltip-type {
    font-family: var(--mono); font-size: 10px;
    padding: 2px 8px; border-radius: 8px;
    display: inline-block; margin-bottom: 4px;
  }
  .graph-tooltip-title { font-weight: 500; line-height: 1.4; }

  @keyframes graph-in { from { opacity: 0; } to { opacity: 1; } }
  .graph-fade { animation: graph-in 400ms ease both; }
`;

// ── Component ─────────────────────────────────────────────────

export default function GraphPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch graph data
  useEffect(() => {
    fetch("/api/ro/graph")
      .then(r => r.json())
      .then(d => {
        setNodes(d.nodes ?? []);
        setEdges(d.edges ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // D3 force simulation
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Clear previous render
    svg.selectAll("*").remove();

    // Arrow markers for each edge type
    const defs = svg.append("defs");
    Object.entries(EDGE_COLORS).forEach(([type, color]) => {
      defs.append("marker")
        .attr("id", `arrow-${type}`)
        .attr("viewBox", "0 0 10 6")
        .attr("refX", 20)
        .attr("refY", 3)
        .attr("markerWidth", 8)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L10,3 L0,6 Z")
        .attr("fill", color);
    });

    // Container for zoom/pan
    const g = svg.append("g");

    // Clone data for simulation (d3 mutates objects)
    const simNodes: GraphNode[] = nodes.map(n => ({ ...n }));
    const simEdges: GraphEdge[] = edges.map(e => ({ ...e }));

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", d => EDGE_COLORS[d.type] ?? "#4a5580")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6)
      .attr("stroke-dasharray", d => d.type === "contradicts" ? "5,4" : "none")
      .attr("marker-end", d => `url(#arrow-${d.type})`);

    // Node groups
    const node = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer");

    // Minted ring
    node.filter(d => d.minted)
      .append("circle")
      .attr("r", d => nodeRadius(d.confidence) + 3)
      .attr("fill", "none")
      .attr("stroke", "#2eddaa")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6);

    // Main circle
    node.append("circle")
      .attr("r", d => nodeRadius(d.confidence))
      .attr("fill", d => TYPE_COLORS[d.roType] ?? "#4a5580")
      .attr("stroke", "rgba(8,11,17,0.6)")
      .attr("stroke-width", 1);

    // Title label
    node.append("text")
      .text(d => d.title.length > 28 ? d.title.slice(0, 26) + "..." : d.title)
      .attr("dy", d => nodeRadius(d.confidence) + 14)
      .attr("text-anchor", "middle")
      .attr("fill", "#c8d0e8")
      .attr("font-family", "'DM Sans', system-ui, sans-serif")
      .attr("font-size", 10)
      .attr("pointer-events", "none");

    // Hover + click handlers
    node
      .on("mouseenter", function (event, d) {
        // Highlight connections
        const connected = new Set<string>();
        connected.add(d.id);
        simEdges.forEach(e => {
          const src = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
          const tgt = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
          if (src === d.id) connected.add(tgt);
          if (tgt === d.id) connected.add(src);
        });

        node.attr("opacity", n => connected.has(n.id) ? 1 : 0.15);
        link.attr("stroke-opacity", e => {
          const src = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
          const tgt = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
          return src === d.id || tgt === d.id ? 0.9 : 0.05;
        });

        // Tooltip
        const tooltip = tooltipRef.current;
        if (tooltip) {
          const tc = TYPE_COLORS[d.roType] ?? "#4a5580";
          tooltip.innerHTML = `
            <div class="graph-tooltip-type" style="color:${tc};background:${tc}18;border:1px solid ${tc}44">
              ${d.roType.replace(/_/g, " ")}
            </div>
            <div class="graph-tooltip-title">${d.title}</div>
            <div style="font-family:var(--mono);font-size:10px;color:var(--subtle);margin-top:4px">
              ${d.species}${d.minted ? " · on-chain" : ""}
            </div>
          `;
          tooltip.classList.add("visible");
          tooltip.style.left = `${event.clientX + 14}px`;
          tooltip.style.top = `${event.clientY - 14}px`;
        }
      })
      .on("mousemove", function (event) {
        const tooltip = tooltipRef.current;
        if (tooltip) {
          tooltip.style.left = `${event.clientX + 14}px`;
          tooltip.style.top = `${event.clientY - 14}px`;
        }
      })
      .on("mouseleave", function () {
        node.attr("opacity", 1);
        link.attr("stroke-opacity", 0.6);
        const tooltip = tooltipRef.current;
        if (tooltip) tooltip.classList.remove("visible");
      })
      .on("click", function (_event, d) {
        router.push(`/ro/${d.id}`);
      });

    // Drag behavior
    let dragTarget: GraphNode | null = null;

    node
      .on("mousedown.drag", function (event, d) {
        event.stopPropagation();
        dragTarget = d;
        d.fx = d.x;
        d.fy = d.y;
        simulation.alphaTarget(0.3).restart();

        const onMove = (ev: MouseEvent) => {
          if (!dragTarget) return;
          const [mx, my] = getTransformedPoint(ev.clientX, ev.clientY);
          dragTarget.fx = mx;
          dragTarget.fy = my;
        };
        const onUp = () => {
          if (dragTarget) {
            dragTarget.fx = null;
            dragTarget.fy = null;
            dragTarget = null;
          }
          simulation.alphaTarget(0);
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });

    // Track current zoom transform for drag coordinate conversion
    let currentTransform = zoomIdentity;

    function getTransformedPoint(clientX: number, clientY: number): [number, number] {
      const rect = svgRef.current!.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return [
        (x - currentTransform.x) / currentTransform.k,
        (y - currentTransform.y) / currentTransform.k,
      ];
    }

    // Zoom
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        currentTransform = event.transform;
        g.attr("transform", event.transform.toString());
      });

    svg.call(zoomBehavior);

    // Simulation
    const simulation = forceSimulation(simNodes)
      .force("link", forceLink<GraphNode, GraphEdge>(simEdges)
        .id(d => d.id)
        .distance(100)
      )
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide<GraphNode>().radius(d => nodeRadius(d.confidence) + 8))
      .on("tick", () => {
        link
          .attr("x1", d => (d.source as GraphNode).x!)
          .attr("y1", d => (d.source as GraphNode).y!)
          .attr("x2", d => (d.target as GraphNode).x!)
          .attr("y2", d => (d.target as GraphNode).y!);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
      });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, router]);

  return (
    <>
      <style>{css}</style>
      <div className="graph-wrap graph-fade">
        {/* Nav */}
        <div className="graph-nav">
          <a href="/" className="graph-wordmark">carrier<em>wave</em></a>
          <div className="graph-nav-links">
            <a href="/explore" className="graph-nav-link">Explore</a>
            <a href="/upload" className="graph-nav-link">Submit RO</a>
          </div>
        </div>

        {/* Canvas */}
        <div className="graph-canvas">
          {loading ? (
            <div className="graph-empty">
              <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--subtle)" }}>
                Loading graph...
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="graph-empty">
              <div className="graph-empty-icon">&#x2B21;</div>
              <div>No research objects yet.</div>
              <a href="/upload" className="graph-nav-link">Submit the first RO</a>
            </div>
          ) : (
            <>
              <svg ref={svgRef} />
              <div ref={tooltipRef} className="graph-tooltip" />

              {/* Stats */}
              <div className="graph-stats">
                <span className="graph-stats-num">{nodes.length}</span> nodes
                {edges.length > 0 && (
                  <> &middot; <span className="graph-stats-num">{edges.length}</span> edges</>
                )}
              </div>

              {/* Legend */}
              <div className="graph-legend">
                <div className="graph-legend-title">Relationship types</div>
                {Object.entries(EDGE_COLORS).map(([type, color]) => (
                  <div key={type} className="graph-legend-item">
                    <div
                      className={type === "contradicts" ? "graph-legend-dash" : "graph-legend-line"}
                      style={type === "contradicts" ? { borderColor: color } : { background: color }}
                    />
                    {EDGE_LABELS[type]}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
