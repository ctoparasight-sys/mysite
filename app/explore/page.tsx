"use client";

// =================================================================
// app/explore/page.tsx
//
// Carrierwave — Research Object Explorer
// Wired to /api/ro/list — real data from Vercel KV.
// =================================================================

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { ROSummary, ROType, ConfidenceLevel } from "@/types/ro";
import type { LandscapeReport } from "@/types/landscape";
import SpiderOverlay, { type SpiderOverlayHandle } from "../SpiderOverlay";

// ── Label / color maps ────────────────────────────────────────

const TYPE_LABELS: Record<ROType, string> = {
  new_finding:               "New Finding",
  negative_result:           "Negative Result",
  replication_successful:    "Replication ✓",
  replication_unsuccessful:  "Replication ✗",
  methodology:               "Methodology",
  materials_reagents:        "Reagents",
  data_update:               "Data Update",
};

const TYPE_COLORS: Record<ROType, string> = {
  new_finding:               "#4f8cff",
  negative_result:           "#ff9f43",
  replication_successful:    "#2eddaa",
  replication_unsuccessful:  "#ff6b6b",
  methodology:               "#a29bfe",
  materials_reagents:        "#74b9ff",
  data_update:               "#81ecec",
};

const CONF_COLORS: Record<ConfidenceLevel, string> = {
  1: "#ff9f43",
  2: "#4f8cff",
  3: "#2eddaa",
};

const CONF_LABELS: Record<ConfidenceLevel, string> = {
  1: "Preliminary",
  2: "Replicated",
  3: "Validated",
};

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Styles ────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@300;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #0b0e14;
    --surface: #121620;
    --surface2:#161b26;
    --border:  #1f2535;
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
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
  }

  body::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(79,140,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(79,140,255,0.03) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
    z-index: 0;
  }

  .cw-page {
    max-width: 1160px;
    margin: 0 auto;
    padding: 36px 24px 100px;
    position: relative;
    z-index: 1;
  }

  /* Topbar */
  .cw-topbar {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 32px; padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .cw-wordmark {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 28px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.5px;
  }
  .cw-wordmark em { color: var(--accent); font-style: italic; }
  .cw-wordmark-sub {
    font-family: var(--mono); font-size: 10px;
    color: var(--subtle); letter-spacing: 0.1em;
    text-transform: uppercase; margin-top: 3px;
  }
  .cw-topbar-right { display: flex; align-items: center; gap: 12px; }

  /* Buttons */
  .cw-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 18px; border-radius: var(--r);
    font-size: 13px; font-weight: 500; font-family: var(--sans);
    cursor: pointer; transition: all var(--t);
    border: 1px solid transparent; text-decoration: none;
  }
  .cw-btn-primary { background: var(--accent); color: white; }
  .cw-btn-primary:hover { background: #6fa3ff; transform: translateY(-1px); }
  .cw-btn-ghost { background: transparent; border-color: var(--border); color: var(--text); }
  .cw-btn-ghost:hover { border-color: var(--subtle); color: var(--bright); }
  .cw-btn-sm { padding: 6px 12px; font-size: 12px; }

  /* Stats bar */
  .cw-stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); overflow: hidden; margin-bottom: 24px;
  }
  .cw-stat {
    padding: 16px; text-align: center;
    border-right: 1px solid var(--border);
    transition: background var(--t);
  }
  .cw-stat:last-child { border-right: none; }
  .cw-stat:hover { background: var(--surface2); }
  .cw-stat-num {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 28px; color: var(--bright); line-height: 1; margin-bottom: 5px;
  }
  .cw-stat-num.green { color: var(--accent2); }
  .cw-stat-label {
    font-family: var(--mono); font-size: 10px;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--subtle);
  }

  /* Layout */
  .cw-layout {
    display: grid; grid-template-columns: 1fr 300px;
    gap: 24px; align-items: start;
  }
  @media (max-width: 900px) { .cw-layout { grid-template-columns: 1fr; } }

  /* Controls */
  .cw-controls { margin-bottom: 18px; display: flex; flex-direction: column; gap: 10px; }
  .cw-search-wrap { position: relative; }
  .cw-search-icon {
    position: absolute; left: 13px; top: 50%;
    transform: translateY(-50%); color: var(--subtle);
    font-size: 16px; pointer-events: none;
  }
  .cw-search {
    width: 100%; background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--r);
    color: var(--bright); font-family: var(--sans); font-size: 14px;
    padding: 11px 14px 11px 40px; outline: none;
    transition: border-color var(--t), box-shadow var(--t);
  }
  .cw-search:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(79,140,255,0.1);
  }
  .cw-search::placeholder { color: var(--subtle); }

  .cw-filter-row { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
  .cw-filter-label {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--subtle); margin-right: 2px;
  }
  .cw-pill {
    padding: 5px 12px; border-radius: 16px;
    border: 1px solid var(--border); background: var(--surface);
    color: var(--subtle); font-size: 11px; font-family: var(--mono);
    cursor: pointer; transition: all var(--t); user-select: none;
  }
  .cw-pill:hover { border-color: var(--accent); color: var(--text); }
  .cw-pill.on { border-color: var(--accent); background: rgba(79,140,255,0.12); color: var(--accent); }
  .cw-pill.on-green { border-color: var(--accent2); background: rgba(46,221,170,0.1); color: var(--accent2); }
  .cw-sort {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px; color: var(--subtle); font-family: var(--mono);
    font-size: 11px; padding: 5px 28px 5px 12px; outline: none; cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%234a5580' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
  }

  .cw-result-count {
    font-family: var(--mono); font-size: 11px; color: var(--subtle); margin-bottom: 14px;
  }
  .cw-result-count span { color: var(--accent); }

  /* RO Cards */
  .cw-list { display: flex; flex-direction: column; gap: 10px; }
  .cw-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 18px 20px 16px;
    cursor: pointer; transition: border-color var(--t), transform var(--t), box-shadow var(--t);
    text-decoration: none; display: block; position: relative; overflow: hidden;
  }
  .cw-card:hover {
    transform: translateX(4px);
    box-shadow: -4px 0 24px rgba(79,140,255,0.08);
  }
  .cw-card-top {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 12px; margin-bottom: 8px;
  }
  .cw-card-title {
    font-size: 14px; font-weight: 600; color: var(--bright);
    line-height: 1.45; flex: 1;
  }
  .cw-badges { display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
  .cw-badge {
    padding: 3px 9px; border-radius: 10px; font-family: var(--mono);
    font-size: 10px; border: 1px solid; white-space: nowrap;
  }
  .cw-claim {
    font-family: var(--mono); font-size: 11px; color: var(--accent2);
    background: rgba(46,221,170,0.06); border: 1px solid rgba(46,221,170,0.14);
    border-radius: 6px; padding: 7px 10px; line-height: 1.55; margin-bottom: 12px;
  }
  .cw-card-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .cw-meta {
    display: flex; gap: 12px; flex-wrap: wrap;
    font-family: var(--mono); font-size: 10px; color: var(--subtle);
  }
  .cw-meta-item { display: flex; align-items: center; gap: 4px; }
  .cw-dots { display: flex; gap: 3px; }
  .cw-dot { width: 7px; height: 7px; border-radius: 50%; }
  .cw-dtags { display: flex; gap: 4px; flex-wrap: wrap; }
  .cw-dtag {
    padding: 2px 7px; border-radius: 8px; font-size: 10px; font-family: var(--mono);
    background: rgba(79,140,255,0.1); border: 1px solid rgba(79,140,255,0.2); color: var(--accent);
  }

  /* Sidebar */
  .cw-sidebar { display: flex; flex-direction: column; gap: 14px; }
  .cw-sc {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 18px;
  }
  .cw-sc-title {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--subtle); margin-bottom: 14px;
    display: flex; align-items: center; gap: 8px;
  }
  .cw-sc-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* Landscape panel */
  .cw-landscape {
    background: linear-gradient(135deg, rgba(79,140,255,0.06) 0%, rgba(46,221,170,0.04) 100%);
    border: 1px solid rgba(79,140,255,0.2);
    border-radius: var(--r); padding: 18px;
  }
  .cw-land-label {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--accent);
    display: flex; align-items: center; gap: 7px; margin-bottom: 12px;
  }
  .cw-land-label::before { content: '◈'; font-size: 13px; }
  .cw-land-hl {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 13px; font-style: italic; color: var(--bright);
    line-height: 1.4; margin-bottom: 10px;
  }
  .cw-land-body { font-size: 12px; color: var(--text); line-height: 1.65; margin-bottom: 14px; }
  .cw-land-sec { margin-bottom: 12px; }
  .cw-land-sec-title {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--subtle); margin-bottom: 7px;
  }
  .cw-land-item {
    font-size: 12px; color: var(--text); padding: 3px 0 3px 16px;
    position: relative; line-height: 1.45;
  }
  .cw-land-item::before { position: absolute; left: 0; font-family: var(--mono); font-size: 11px; }
  .cw-land-item.hot::before  { content: '→'; color: var(--accent); }
  .cw-land-item.gap::before  { content: '○'; color: var(--warn); }
  .cw-land-item.rep::before  { content: '◎'; color: var(--accent2); }

  /* Type bars */
  .cw-tbar { margin-bottom: 9px; cursor: pointer; }
  .cw-tbar:hover .cw-tbar-name { color: var(--accent); }
  .cw-tbar-head { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .cw-tbar-name { font-family: var(--mono); font-size: 11px; color: var(--text); transition: color var(--t); }
  .cw-tbar-count { font-family: var(--mono); font-size: 11px; color: var(--subtle); }
  .cw-tbar-bg { height: 3px; background: var(--muted); border-radius: 2px; overflow: hidden; }
  .cw-tbar-fill { height: 100%; border-radius: 2px; transition: width 700ms cubic-bezier(.4,0,.2,1); }

  .cw-srow {
    display: flex; justify-content: space-between; margin-bottom: 7px; cursor: pointer;
  }
  .cw-srow:hover span:first-child { color: var(--accent); }
  .cw-sname { font-family: var(--mono); font-size: 12px; color: var(--text); transition: color var(--t); }
  .cw-sname.italic { font-style: italic; }
  .cw-scount { font-family: var(--mono); font-size: 11px; color: var(--subtle); }

  /* Loading / empty */
  .cw-loading {
    text-align: center; padding: 60px 24px;
    font-family: var(--mono); font-size: 12px; color: var(--subtle);
  }
  @keyframes cw-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
  .cw-loading { animation: cw-pulse 1.5s ease infinite; }

  .cw-empty {
    text-align: center; padding: 48px 24px;
    color: var(--subtle); font-family: var(--mono); font-size: 13px;
  }

  /* Animations */
  @keyframes cw-fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .cw-fade { animation: cw-fadeIn 400ms ease both; }

  @media (max-width: 600px) {
    .cw-stats { grid-template-columns: repeat(2, 1fr); }
    .cw-stat { border-bottom: 1px solid var(--border); }
  }

`;

// ── Component ─────────────────────────────────────────────────

export default function ExplorePage() {
  const [allROs, setAllROs]           = useState<ROSummary[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState<ROType | "">("");
  const [confFilter, setConfFilter]   = useState<ConfidenceLevel | 0>(0);
  const [commFilter, setCommFilter]   = useState(false);
  const [mintFilter, setMintFilter]   = useState(false);
  const [sort, setSort]               = useState<"newest" | "confidence" | "relationships">("newest");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [landscape, setLandscape] = useState<LandscapeReport | null>(null);
  const [landscapeLoading, setLandscapeLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  // Spider agent
  const spiderRef = useRef<SpiderOverlayHandle>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const pollingRef = useRef(false);

  // Fetch all ROs from the real API
  const fetchROs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", sort });
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/ro/list?${params}`);
      const json = await res.json();
      setAllROs(json.ros ?? []);
    } catch {
      setAllROs([]);
    }
    setLoading(false);
  }, [sort, typeFilter]);

  useEffect(() => { fetchROs(); }, [fetchROs]);

  // Keyboard shortcut: / focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch AI landscape report
  useEffect(() => {
    setLandscapeLoading(true);
    fetch("/api/ro/landscape")
      .then(r => r.json())
      .then(data => setLandscape(data as LandscapeReport))
      .catch(() => setLandscape(null))
      .finally(() => setLandscapeLoading(false));
  }, []);

  // Spawn spider for newest RO after initial load
  useEffect(() => {
    if (loading || initialLoadDoneRef.current || allROs.length === 0) return;
    initialLoadDoneRef.current = true;
    allROs.forEach(ro => knownIdsRef.current.add(ro.id));
    const newestId = allROs[0]?.id;
    if (newestId) {
      setTimeout(() => {
        spiderRef.current?.spawnFor(
          `a[href="/ro/${newestId}"] .cw-card-title`,
          `RO ${newestId.slice(-4)} read by Agent`,
        );
      }, 600);
    }
  }, [loading, allROs]);

  // Poll for new ROs every 30s
  useEffect(() => {
    const iv = setInterval(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const res = await fetch("/api/ro/list?limit=50&sort=newest");
        const json = await res.json();
        const fresh: ROSummary[] = json.ros ?? [];
        const newIds = fresh.filter(ro => !knownIdsRef.current.has(ro.id)).map(ro => ro.id);
        fresh.forEach(ro => knownIdsRef.current.add(ro.id));
        if (newIds.length > 0) {
          setAllROs(fresh);
          newIds.forEach((id, i) => {
            setTimeout(() => {
              spiderRef.current?.spawnFor(
                `a[href="/ro/${id}"] .cw-card-title`,
                `RO ${id.slice(-4)} read by Agent`,
              );
            }, i * 500);
          });
        }
      } catch { /* ignore polling errors */ }
      pollingRef.current = false;
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  // Client-side filtering (search + conf + comm + mint)
  const filtered = useMemo(() => {
    const q = (search || sidebarSearch).toLowerCase();
    return allROs.filter(ro => {
      if (confFilter && ro.confidence < confFilter) return false;
      if (commFilter && !ro.hasCommercialRelevance) return false;
      if (mintFilter && !ro.minted) return false;
      if (q) {
        const hay = [ro.title, ro.claim, ro.abstract, ro.species, ...ro.diseaseAreaTags]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allROs, search, sidebarSearch, confFilter, commFilter, mintFilter]);

  // Sidebar breakdowns from full set
  const typeBreakdown = useMemo(() => {
    const counts: Partial<Record<ROType, number>> = {};
    allROs.forEach(ro => { counts[ro.roType] = (counts[ro.roType] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [ROType, number][];
  }, [allROs]);

  const maxTypeCount = Math.max(...typeBreakdown.map(([, c]) => c), 1);

  const speciesCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allROs.forEach(ro => { counts[ro.species] = (counts[ro.species] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allROs]);

  const diseaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allROs.forEach(ro => ro.diseaseAreaTags.forEach(t => { counts[t] = (counts[t] ?? 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allROs]);

  const stats = useMemo(() => ({
    total:      allROs.length,
    validated:  allROs.filter(r => r.confidence === 3).length,
    minted:     allROs.filter(r => r.minted).length,
    commercial: allROs.filter(r => r.hasCommercialRelevance).length,
  }), [allROs]);

  const clearFilters = () => {
    setSearch(""); setSidebarSearch(""); setTypeFilter("");
    setConfFilter(0); setCommFilter(false); setMintFilter(false);
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <SpiderOverlay
        ref={spiderRef}
        patrolSelectors={[".cw-card", ".cw-stat", ".cw-tbar", ".cw-land-item"]}
      />
      <div className="cw-page cw-fade">

        {/* Topbar */}
        <div className="cw-topbar">
          <div>
            <a href="/" className="cw-wordmark">carrier<em>wave</em></a>
            <div className="cw-wordmark-sub">Open Research Infrastructure</div>
          </div>
          <div className="cw-topbar-right">
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--subtle)" }}>
              <kbd style={{ background: "var(--muted)", padding: "2px 6px", borderRadius: 4, fontFamily: "var(--mono)", fontSize: 11 }}>/</kbd> to search
            </span>
            <a href="/upload" className="cw-btn cw-btn-ghost cw-btn-sm">+ Submit RO</a>
          </div>
        </div>

        {/* Stats */}
        <div className="cw-stats">
          {[
            { num: loading ? "…" : stats.total,      label: "Research Objects",        green: false },
            { num: loading ? "…" : stats.validated,  label: "Independently Validated", green: true  },
            { num: loading ? "…" : stats.minted,     label: "On-chain",                green: false },
            { num: loading ? "…" : stats.commercial, label: "Commercial Relevance",    green: false },
          ].map(s => (
            <div key={s.label} className="cw-stat">
              <div className={`cw-stat-num${s.green ? " green" : ""}`}>{s.num}</div>
              <div className="cw-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="cw-layout">

          {/* ── Feed ── */}
          <div>
            <div className="cw-controls">
              {/* Search */}
              <div className="cw-search-wrap">
                <span className="cw-search-icon">⌕</span>
                <input
                  ref={searchRef}
                  className="cw-search"
                  type="text"
                  placeholder="Search titles, claims, species, disease areas…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSidebarSearch(""); }}
                />
              </div>

              {/* Type filter */}
              <div className="cw-filter-row">
                <span className="cw-filter-label">Type</span>
                <div className={`cw-pill${typeFilter === "" ? " on" : ""}`} onClick={() => setTypeFilter("")}>All</div>
                {(Object.entries(TYPE_LABELS) as [ROType, string][]).map(([k, v]) => (
                  <div
                    key={k}
                    className={`cw-pill${typeFilter === k ? " on" : ""}`}
                    style={typeFilter === k ? { borderColor: TYPE_COLORS[k], background: `${TYPE_COLORS[k]}20`, color: TYPE_COLORS[k] } : {}}
                    onClick={() => setTypeFilter(typeFilter === k ? "" : k)}
                  >{v}</div>
                ))}
              </div>

              {/* Other filters + sort */}
              <div className="cw-filter-row">
                <span className="cw-filter-label">Filter</span>
                {([1, 2, 3] as ConfidenceLevel[]).map(c => (
                  <div
                    key={c}
                    className={`cw-pill${confFilter === c ? " on" : ""}`}
                    style={confFilter === c ? { borderColor: CONF_COLORS[c], background: `${CONF_COLORS[c]}20`, color: CONF_COLORS[c] } : {}}
                    onClick={() => setConfFilter(confFilter === c ? 0 : c)}
                  >Conf ≥ {c}</div>
                ))}
                <div className={`cw-pill${commFilter ? " on" : ""}`} onClick={() => setCommFilter(f => !f)}>Commercial</div>
                <div className={`cw-pill${mintFilter ? " on-green" : ""}`} onClick={() => setMintFilter(f => !f)}>On-chain</div>
                <span className="cw-filter-label" style={{ marginLeft: 8 }}>Sort</span>
                <select className="cw-sort" value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
                  <option value="newest">Newest</option>
                  <option value="confidence">Highest confidence</option>
                  <option value="relationships">Most related</option>
                </select>
              </div>
            </div>

            {/* Result count */}
            <div className="cw-result-count">
              {loading ? "Loading…" : <>
                Showing <span>{filtered.length}</span> research object{filtered.length !== 1 ? "s" : ""}
                {search ? ` matching "${search}"` : ""}
                {sidebarSearch ? ` in "${sidebarSearch}"` : ""}
              </>}
            </div>

            {/* Cards */}
            {loading ? (
              <div className="cw-loading">Fetching research objects…</div>
            ) : filtered.length === 0 ? (
              <div className="cw-empty">
                {allROs.length === 0
                  ? <>No research objects yet. <a href="/upload" style={{ color: "var(--accent)" }}>Submit the first one →</a></>
                  : <>No results — <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={clearFilters}>clear filters</span></>
                }
              </div>
            ) : (
              <div className="cw-list">
                {filtered.map((ro, idx) => {
                  const tc = TYPE_COLORS[ro.roType];
                  const cc = CONF_COLORS[ro.confidence];
                  return (
                    <a
                      key={ro.id}
                      href={`/ro/${ro.id}`}
                      className="cw-card"
                      style={{ animationDelay: `${idx * 40}ms`, borderLeft: `3px solid ${tc}60` }}
                    >
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tc, borderRadius: "var(--r) 0 0 var(--r)", opacity: 0.8 }} />

                      <div className="cw-card-top">
                        <div className="cw-card-title">{ro.title}</div>
                        <div className="cw-badges">
                          <span className="cw-badge" style={{ color: tc, borderColor: `${tc}44`, background: `${tc}12` }}>
                            {TYPE_LABELS[ro.roType]}
                          </span>
                          {ro.minted && (
                            <span className="cw-badge" style={{ color: "var(--accent2)", borderColor: "rgba(46,221,170,.3)", background: "rgba(46,221,170,.08)" }}>
                              ⬡ on-chain
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="cw-claim">{ro.claim}</div>

                      <div className="cw-card-foot">
                        <div className="cw-meta">
                          <div className="cw-meta-item">
                            <div className="cw-dots">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="cw-dot" style={{ background: i <= ro.confidence ? cc : "var(--muted)" }} />
                              ))}
                            </div>
                            <span style={{ color: cc }}>{CONF_LABELS[ro.confidence]}</span>
                          </div>
                          <div className="cw-meta-item">n={ro.replicateCount}</div>
                          <div className="cw-meta-item">🧬 {ro.species}</div>
                          <div className="cw-meta-item">{timeAgo(ro.timestamp)}</div>
                          {ro.relationshipCount > 0 && (
                            <div className="cw-meta-item">⟷ {ro.relationshipCount} rel.</div>
                          )}
                          <div className="cw-meta-item" style={{ color: "var(--muted)" }}>{shortAddr(ro.walletAddress)}</div>
                        </div>
                        {ro.diseaseAreaTags.length > 0 && (
                          <div className="cw-dtags">
                            {ro.diseaseAreaTags.slice(0, 2).map(t => (
                              <span key={t} className="cw-dtag">{t}</span>
                            ))}
                            {ro.diseaseAreaTags.length > 2 && (
                              <span className="cw-dtag">+{ro.diseaseAreaTags.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="cw-sidebar">

            {/* AI Landscape */}
            <div className="cw-landscape">
              <div className="cw-land-label">Field Landscape</div>
              {landscapeLoading ? (
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--subtle)", animation: "cw-pulse 1.5s ease infinite" }}>
                  Analyzing research landscape…
                </div>
              ) : landscape && landscape.status === "ok" ? (
                <>
                  <div className="cw-land-hl">{`"${landscape.headline}"`}</div>
                  <div className="cw-land-body">{landscape.summary}</div>

                  {landscape.hotAreas.length > 0 && (
                    <div className="cw-land-sec">
                      <div className="cw-land-sec-title">Hot Areas</div>
                      {landscape.hotAreas.map((item, i) => (
                        <div key={i} className="cw-land-item hot" title={item.detail}>{item.label}</div>
                      ))}
                    </div>
                  )}

                  {landscape.gaps.length > 0 && (
                    <div className="cw-land-sec">
                      <div className="cw-land-sec-title">Knowledge Gaps</div>
                      {landscape.gaps.map((item, i) => (
                        <div key={i} className="cw-land-item gap" title={item.detail}>{item.label}</div>
                      ))}
                    </div>
                  )}

                  {landscape.replicationTargets.length > 0 && (
                    <div className="cw-land-sec">
                      <div className="cw-land-sec-title">Replication Targets</div>
                      {landscape.replicationTargets.map((item, i) => (
                        <div key={i} className="cw-land-item rep" title={item.detail}>{item.label}</div>
                      ))}
                    </div>
                  )}

                  {landscape.contradictions.length > 0 && (
                    <div className="cw-land-sec">
                      <div className="cw-land-sec-title">Contradictions</div>
                      {landscape.contradictions.map((item, i) => (
                        <div key={i} className="cw-land-item" style={{ color: "var(--warn)" }} title={item.detail}>{item.label}</div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--subtle)", marginTop: 12, textAlign: "right" }}>
                    {landscape.roCount} ROs analyzed
                  </div>
                </>
              ) : (
                <>
                  <div className="cw-land-hl">"Early-stage feed — submit more ROs to generate an AI landscape report"</div>
                  <div className="cw-land-body">
                    The landscape AI synthesizes patterns across submitted research objects to identify hot areas, gaps, and replication targets. It activates once enough ROs are present.
                  </div>
                  <div className="cw-land-sec">
                    <div className="cw-land-sec-title">How it works</div>
                    <div className="cw-land-item hot">Submit findings, replications, negative results</div>
                    <div className="cw-land-item hot">AI clusters by topic, species, disease area</div>
                    <div className="cw-land-item rep">Landscape report updates continuously</div>
                  </div>
                </>
              )}
            </div>

            {/* Type breakdown */}
            {typeBreakdown.length > 0 && (
              <div className="cw-sc">
                <div className="cw-sc-title">By Type</div>
                {typeBreakdown.map(([type, count]) => (
                  <div key={type} className="cw-tbar" onClick={() => setTypeFilter(typeFilter === type ? "" : type)}>
                    <div className="cw-tbar-head">
                      <span className="cw-tbar-name" style={typeFilter === type ? { color: TYPE_COLORS[type] } : {}}>{TYPE_LABELS[type]}</span>
                      <span className="cw-tbar-count">{count}</span>
                    </div>
                    <div className="cw-tbar-bg">
                      <div className="cw-tbar-fill" style={{ width: `${(count / maxTypeCount) * 100}%`, background: TYPE_COLORS[type] }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Species */}
            {speciesCounts.length > 0 && (
              <div className="cw-sc">
                <div className="cw-sc-title">Species</div>
                {speciesCounts.map(([sp, count]) => (
                  <div key={sp} className="cw-srow" onClick={() => { setSidebarSearch(sp); setSearch(""); }}>
                    <span className={`cw-sname${sp !== "Universal" ? " italic" : ""}`}>{sp}</span>
                    <span className="cw-scount">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Disease areas */}
            {diseaseCounts.length > 0 && (
              <div className="cw-sc">
                <div className="cw-sc-title">Disease Areas</div>
                {diseaseCounts.map(([tag, count]) => (
                  <div key={tag} className="cw-srow" onClick={() => { setSidebarSearch(tag); setSearch(""); }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", transition: "color var(--t)" }}>{tag}</span>
                    <span className="cw-scount">{count}</span>
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      </div>
    </>
  );
}
