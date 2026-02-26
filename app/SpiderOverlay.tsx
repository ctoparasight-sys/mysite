"use client";

// =================================================================
// app/SpiderOverlay.tsx
//
// Mechanical spider agents that crawl across the screen inspecting
// page elements. Matrix-inspired red surveillance bots.
// Used on landing page and explore feed.
// =================================================================

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";

// ── Types ──────────────────────────────────────────────────

interface ActiveSpider {
  id: string;
  label: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  exitX: number;
  exitY: number;
  phase: "crawling-in" | "paused" | "crawling-out";
  mounted: boolean;
  crawlInDuration: number;
  crawlOutDuration: number;
  entryEdge: Edge;
  createdAt: number;
}

type Edge = "top" | "bottom" | "left" | "right";

// ── Helpers ────────────────────────────────────────────────

function pickRandomEdge(): { x: number; y: number; edge: Edge } {
  const edges: Edge[] = ["top", "bottom", "left", "right"];
  const edge = edges[Math.floor(Math.random() * edges.length)];
  const w = window.innerWidth;
  const h = window.innerHeight;
  const m = 60;
  switch (edge) {
    case "top":    return { x: Math.random() * w, y: -m, edge };
    case "bottom": return { x: Math.random() * w, y: h + m, edge };
    case "left":   return { x: -m, y: Math.random() * h, edge };
    case "right":  return { x: w + m, y: Math.random() * h, edge };
  }
}

function getExitPoint(avoidEdge: Edge): { x: number; y: number } {
  const edges = (["top", "bottom", "left", "right"] as Edge[]).filter(e => e !== avoidEdge);
  const edge = edges[Math.floor(Math.random() * edges.length)];
  const w = window.innerWidth;
  const h = window.innerHeight;
  const m = 60;
  switch (edge) {
    case "top":    return { x: Math.random() * w, y: -m };
    case "bottom": return { x: Math.random() * w, y: h + m };
    case "left":   return { x: -m, y: Math.random() * h };
    case "right":  return { x: w + m, y: Math.random() * h };
  }
}

function getElementCenter(selector: string): { x: number; y: number; el: Element } | null {
  const els = Array.from(document.querySelectorAll(selector));
  if (els.length === 0) return null;
  // Shuffle and pick the first element that's in the viewport
  const shuffled = els.sort(() => Math.random() - 0.5);
  for (const el of shuffled) {
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth) {
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, el };
    }
  }
  return null;
}

function deriveLabel(el: Element): string {
  // RO cards in explore feed — <a href="/ro/{id}" class="cw-card">
  const roAnchor = el.closest("a[href^='/ro/']") ?? (el.matches("a[href^='/ro/']") ? el : null);
  if (roAnchor) {
    const id = (roAnchor.getAttribute("href") ?? "").replace("/ro/", "");
    if (id) return `RO ${id.slice(-4)} read by Agent`;
  }

  // Stats bar — .cw-stat with .cw-stat-label inside
  const statLabel = el.querySelector(".cw-stat-label");
  if (statLabel?.textContent) return `Reading ${statLabel.textContent.trim().toLowerCase()}`;

  // Type breakdown bars — .cw-tbar with .cw-tbar-name inside
  const tbarName = el.querySelector(".cw-tbar-name");
  if (tbarName?.textContent) return `Analyzing ${tbarName.textContent.trim()}`;

  // Landscape items — .cw-land-item text content
  if (el.classList.contains("cw-land-item")) {
    const text = el.textContent?.trim();
    if (text) return `Processing: ${text.slice(0, 28)}${text.length > 28 ? "\u2026" : ""}`;
  }

  // Landing page hero headline
  if (el.classList.contains("cw-hero-headline")) return "Scanning network";

  // Landing page section labels
  if (el.classList.contains("cw-section-label")) {
    const text = el.textContent?.trim();
    if (text) return `Reading ${text.toLowerCase()}`;
  }

  // Landing page RO type cards
  if (el.classList.contains("cw-ro-card")) {
    const title = el.querySelector("h3");
    if (title?.textContent) return `Inspecting ${title.textContent.trim()}`;
  }

  return "Scanning\u2026";
}

// ── CSS ────────────────────────────────────────────────────

const spiderCss = `
  .cw-spider-overlay {
    position: fixed; inset: 0;
    pointer-events: none; overflow: hidden;
    z-index: 150;
  }
  .cw-spider {
    position: absolute; top: 0; left: 0;
    will-change: transform;
  }
  .cw-spider.moving {
    transition: transform var(--spider-dur, 3s) linear;
  }
  @keyframes cw-leg-a {
    0%, 15% { transform: rotate(0deg); }
    25%, 75% { transform: rotate(15deg); }
    85%, 100% { transform: rotate(0deg); }
  }
  @keyframes cw-leg-b {
    0%, 15% { transform: rotate(0deg); }
    25%, 75% { transform: rotate(-15deg); }
    85%, 100% { transform: rotate(0deg); }
  }
  .cw-spider.walking .cw-leg-a {
    animation: cw-leg-a 0.4s ease-out infinite;
  }
  .cw-spider.walking .cw-leg-b {
    animation: cw-leg-b 0.4s ease-out infinite;
  }
  @keyframes cw-joint-a {
    0%, 10% { transform: rotate(0deg); }
    30%, 70% { transform: rotate(-20deg); }
    90%, 100% { transform: rotate(0deg); }
  }
  @keyframes cw-joint-b {
    0%, 10% { transform: rotate(0deg); }
    30%, 70% { transform: rotate(20deg); }
    90%, 100% { transform: rotate(0deg); }
  }
  .cw-spider.walking .cw-joint-a {
    animation: cw-joint-a 0.4s ease-out infinite;
  }
  .cw-spider.walking .cw-joint-b {
    animation: cw-joint-b 0.4s ease-out infinite;
  }
  .cw-spider-bubble {
    position: absolute; bottom: calc(100% + 12px); left: 50%;
    transform: translateX(-50%);
    background: transparent; color: #aa2838;
    border: 1px solid #aa2838;
    font-family: 'DM Mono', monospace;
    font-size: 10px; font-weight: 500;
    padding: 5px 10px; border-radius: 6px;
    white-space: nowrap; opacity: 0;
    transition: opacity 0.3s ease;
  }
  .cw-spider-bubble::after {
    content: ''; position: absolute; top: 100%; left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent; border-top-color: #aa2838;
  }
  .cw-spider-bubble.visible { opacity: 1; }
  @keyframes cw-sensor-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
`;

// ── Public API ─────────────────────────────────────────────

export interface SpiderOverlayHandle {
  spawnFor: (targetSelector: string, label?: string) => void;
}

interface Props {
  patrolSelectors: string[];
  patrol?: boolean;
}

// ── Component ──────────────────────────────────────────────

const SpiderOverlay = forwardRef<SpiderOverlayHandle, Props>(
  function SpiderOverlay({ patrolSelectors, patrol = true }, ref) {
    const [spiders, setSpiders] = useState<ActiveSpider[]>([]);
    const timersRef = useRef<Set<string>>(new Set());
    const patrolRef = useRef(patrolSelectors);
    patrolRef.current = patrolSelectors;

    const spawn = useCallback((target: { x: number; y: number }, label: string) => {
      const start = pickRandomEdge();
      const exit = getExitPoint(start.edge);
      const dIn = Math.sqrt((target.x - start.x) ** 2 + (target.y - start.y) ** 2);
      const dOut = Math.sqrt((exit.x - target.x) ** 2 + (exit.y - target.y) ** 2);
      const spider: ActiveSpider = {
        id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        startX: start.x, startY: start.y,
        targetX: target.x, targetY: target.y,
        exitX: exit.x, exitY: exit.y,
        phase: "crawling-in",
        mounted: false,
        crawlInDuration: Math.max(1.5, dIn / 150),
        crawlOutDuration: Math.max(1.5, dOut / 150),
        entryEdge: start.edge,
        createdAt: Date.now(),
      };
      setSpiders(prev => prev.length >= 5 ? prev : [...prev, spider]);
    }, []);

    const spawnFor = useCallback((selector: string, label = "Scanning...") => {
      const target = getElementCenter(selector);
      if (target) spawn(target, label);
    }, [spawn]);

    useImperativeHandle(ref, () => ({ spawnFor }), [spawnFor]);

    // Patrol timer: first spider at 3-5s, then every 15-20s
    useEffect(() => {
      if (!patrol) return;
      let first = true;
      const tryPatrol = () => {
        const sels = [...patrolRef.current].sort(() => Math.random() - 0.5);
        for (const sel of sels) {
          const target = getElementCenter(sel);
          if (target) { spawn(target, deriveLabel(target.el)); return; }
        }
      };
      const scheduleNext = (): ReturnType<typeof setTimeout> => {
        const delay = first ? 3000 + Math.random() * 2000 : 15000 + Math.random() * 5000;
        first = false;
        return setTimeout(() => {
          tryPatrol();
          handle = scheduleNext();
        }, delay);
      };
      let handle = scheduleNext();
      return () => clearTimeout(handle);
    }, [patrol, spawn]);

    // Spider lifecycle
    useEffect(() => {
      spiders.forEach(spider => {
        const tk = `${spider.id}:${spider.phase}:${spider.mounted ? 1 : 0}`;
        if (timersRef.current.has(tk)) return;
        timersRef.current.add(tk);

        if (spider.phase === "crawling-in" && !spider.mounted) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setSpiders(p => p.map(s => s.id === spider.id ? { ...s, mounted: true } : s));
            });
          });
        } else if (spider.phase === "crawling-in" && spider.mounted) {
          setTimeout(() => {
            setSpiders(p => p.map(s => s.id === spider.id ? { ...s, phase: "paused" } : s));
          }, spider.crawlInDuration * 1000);
        } else if (spider.phase === "paused") {
          setTimeout(() => {
            setSpiders(p => p.map(s =>
              s.id === spider.id ? { ...s, phase: "crawling-out", mounted: false } : s
            ));
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setSpiders(p => p.map(s => s.id === spider.id ? { ...s, mounted: true } : s));
              });
            });
          }, 1500);
        } else if (spider.phase === "crawling-out" && spider.mounted) {
          setTimeout(() => {
            timersRef.current.forEach(k => {
              if (k.startsWith(spider.id)) timersRef.current.delete(k);
            });
            setSpiders(p => p.filter(s => s.id !== spider.id));
          }, spider.crawlOutDuration * 1000);
        }
      });
      const now = Date.now();
      if (spiders.some(s => now - s.createdAt > 30000)) {
        setSpiders(p => p.filter(s => Date.now() - s.createdAt <= 30000));
      }
    }, [spiders]);

    // ── Render ──────────────────────────────────────────────

    return (
      <>
        <style>{spiderCss}</style>
        {spiders.length > 0 && (
          <div className="cw-spider-overlay">
            {spiders.map(spider => {
              let x: number, y: number;
              if (spider.phase === "crawling-in") {
                x = spider.mounted ? spider.targetX : spider.startX;
                y = spider.mounted ? spider.targetY : spider.startY;
              } else if (spider.phase === "paused") {
                x = spider.targetX;
                y = spider.targetY;
              } else {
                x = spider.mounted ? spider.exitX : spider.targetX;
                y = spider.mounted ? spider.exitY : spider.targetY;
              }
              const walking =
                (spider.phase === "crawling-in" && spider.mounted) ||
                (spider.phase === "crawling-out" && spider.mounted);
              const dur = spider.phase === "crawling-out"
                ? spider.crawlOutDuration : spider.crawlInDuration;
              const dx = spider.phase === "crawling-out"
                ? spider.exitX - spider.targetX : spider.targetX - spider.startX;
              const dy = spider.phase === "crawling-out"
                ? spider.exitY - spider.targetY : spider.targetY - spider.startY;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

              return (
                <div
                  key={spider.id}
                  className={`cw-spider${walking ? " walking moving" : ""}`}
                  style={{
                    transform: `translate(${x - 26}px, ${y - 20}px)`,
                    "--spider-dur": `${dur}s`,
                  } as React.CSSProperties}
                >
                  <div style={{ transform: `rotate(${angle}deg)`, width: 52, height: 40 }}>
                    <svg width="52" height="40" viewBox="0 0 52 40" fill="none">
                      {/* Left legs group A (front-left + mid-back-left) */}
                      <g className="cw-leg-a" style={{ transformOrigin: "26px 20px" }}>
                        <line x1="21" y1="14" x2="12" y2="7" stroke="#aa2838" strokeWidth="1.3" />
                        <g className="cw-joint-a" style={{ transformOrigin: "12px 7px" }}>
                          <circle cx="12" cy="7" r="1.2" fill="#881828" stroke="#aa2838" strokeWidth="0.5" />
                          <line x1="12" y1="7" x2="3" y2="1" stroke="#aa2838" strokeWidth="1" />
                        </g>
                        <line x1="21" y1="25" x2="10" y2="28" stroke="#aa2838" strokeWidth="1.3" />
                        <g className="cw-joint-a" style={{ transformOrigin: "10px 28px" }}>
                          <circle cx="10" cy="28" r="1.2" fill="#881828" stroke="#aa2838" strokeWidth="0.5" />
                          <line x1="10" y1="28" x2="2" y2="35" stroke="#aa2838" strokeWidth="1" />
                        </g>
                      </g>
                      {/* Left legs group B (mid-front-left + back-left) */}
                      <g className="cw-leg-b" style={{ transformOrigin: "26px 20px" }}>
                        <line x1="21" y1="18" x2="10" y2="13" stroke="#aa2838" strokeWidth="1.3" />
                        <g className="cw-joint-b" style={{ transformOrigin: "10px 13px" }}>
                          <circle cx="10" cy="13" r="1.2" fill="#881828" stroke="#aa2838" strokeWidth="0.5" />
                          <line x1="10" y1="13" x2="1" y2="9" stroke="#aa2838" strokeWidth="1" />
                        </g>
                        <line x1="21" y1="28" x2="12" y2="33" stroke="#aa2838" strokeWidth="1.3" />
                        <g className="cw-joint-b" style={{ transformOrigin: "12px 33px" }}>
                          <circle cx="12" cy="33" r="1.2" fill="#881828" stroke="#aa2838" strokeWidth="0.5" />
                          <line x1="12" y1="33" x2="4" y2="39" stroke="#aa2838" strokeWidth="1" />
                        </g>
                      </g>
                      {/* Right legs group B (front-right + mid-back-right) */}
                      <g className="cw-leg-b" style={{ transformOrigin: "26px 20px" }}>
                        <line x1="31" y1="14" x2="40" y2="7" stroke="#aa2838" strokeWidth="1.3" />
                        <g className="cw-joint-b" style={{ transformOrigin: "40px 7px" }}>
                          <circle cx="40" cy="7" r="1.2" fill="#881828" stroke="#aa2838" strokeWidth="0.5" />
                          <line x1="40" y1="7" x2="49" y2="1" stroke="#aa2838" strokeWidth="1" />
                        </g>
                        <line x1="31" y1="25" x2="42" y2="28" stroke="#aa2838" strokeWidth="1.3" />
                        <g className="cw-joint-b" style={{ transformOrigin: "42px 28px" }}>
                          <circle cx="42" cy="28" r="1.2" fill="#881828" stroke="#aa2838" strokeWidth="0.5" />
                          <line x1="42" y1="28" x2="50" y2="35" stroke="#aa2838" strokeWidth="1" />
                        </g>
                      </g>
                      {/* Right legs group A (mid-front-right + back-right) */}
                      <g className="cw-leg-a" style={{ transformOrigin: "26px 20px" }}>
                        <line x1="31" y1="18" x2="42" y2="13" stroke="#aa2838" strokeWidth="1.3" />
                        <g className="cw-joint-a" style={{ transformOrigin: "42px 13px" }}>
                          <circle cx="42" cy="13" r="1.2" fill="#881828" stroke="#aa2838" strokeWidth="0.5" />
                          <line x1="42" y1="13" x2="51" y2="9" stroke="#aa2838" strokeWidth="1" />
                        </g>
                        <line x1="31" y1="28" x2="40" y2="33" stroke="#aa2838" strokeWidth="1.3" />
                        <g className="cw-joint-a" style={{ transformOrigin: "40px 33px" }}>
                          <circle cx="40" cy="33" r="1.2" fill="#881828" stroke="#aa2838" strokeWidth="0.5" />
                          <line x1="40" y1="33" x2="48" y2="39" stroke="#aa2838" strokeWidth="1" />
                        </g>
                      </g>
                      {/* Body chassis */}
                      <path d="M21 28L19 24L19 16L21 12L31 12L33 16L33 24L31 28Z"
                        fill="#120608" stroke="#aa2838" strokeWidth="0.7" />
                      {/* Head module */}
                      <path d="M23 12L22 8L26 5L30 8L29 12"
                        fill="#120608" stroke="#aa2838" strokeWidth="0.7" />
                      {/* Sensor strip (no eyes) */}
                      <line x1="24" y1="8.5" x2="28" y2="8.5"
                        stroke="#ff3344" strokeWidth="1.2" strokeLinecap="round"
                        style={{ animation: "cw-sensor-pulse 1.5s ease-in-out infinite" }} />
                    </svg>
                  </div>
                  <div className={`cw-spider-bubble${spider.phase === "paused" ? " visible" : ""}`}>
                    {spider.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }
);

export default SpiderOverlay;
