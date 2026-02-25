"use client";

// =================================================================
// app/profile/page.tsx — Wallet Profile Page
//
// Shows all ROs submitted by a wallet address.
// - Signed-in user sees their own profile at /profile
// - Anyone can view a public profile at /profile?wallet=0x...
// =================================================================

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { ROSummary, ROType, ConfidenceLevel } from "@/types/ro";

// ── Maps ──────────────────────────────────────────────────────

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
  1: "#ff9f43", 2: "#4f8cff", 3: "#2eddaa",
};
const CONF_LABELS: Record<ConfidenceLevel, string> = {
  1: "Preliminary", 2: "Replicated", 3: "Validated",
};

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function shortAddr(addr: string): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

function avgConfidence(ros: ROSummary[]): string {
  if (!ros.length) return "—";
  const avg = ros.reduce((s, r) => s + r.confidence, 0) / ros.length;
  return avg.toFixed(1);
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
    --warn:    #ff9f43;
    --mono:    'DM Mono', monospace;
    --sans:    'DM Sans', system-ui, sans-serif;
    --r:       10px;
    --t:       160ms ease;
  }

  body {
    background: var(--bg); color: var(--text);
    font-family: var(--sans); font-size: 14px;
    line-height: 1.6; min-height: 100vh;
  }

  body::before {
    content: ''; position: fixed; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(79,140,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(79,140,255,0.025) 1px, transparent 1px);
    background-size: 56px 56px;
  }

  .pr-wrap {
    max-width: 900px; margin: 0 auto;
    padding: 36px 24px 100px; position: relative; z-index: 1;
  }

  /* Nav */
  .pr-nav {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 40px; padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .pr-wordmark {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 22px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.3px;
  }
  .pr-wordmark em { color: var(--accent); font-style: italic; }
  .pr-nav-right { display: flex; gap: 10px; align-items: center; }
  .pr-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: var(--r);
    font-size: 13px; font-weight: 500; font-family: var(--sans);
    cursor: pointer; transition: all var(--t);
    border: 1px solid var(--border); background: transparent;
    color: var(--text); text-decoration: none;
  }
  .pr-btn:hover { border-color: var(--subtle); color: var(--bright); }
  .pr-btn-primary { background: var(--accent); border-color: var(--accent); color: white; }
  .pr-btn-primary:hover { background: #6fa3ff; border-color: #6fa3ff; }

  /* Identity card */
  .pr-identity {
    background: linear-gradient(135deg, rgba(79,140,255,0.07) 0%, rgba(46,221,170,0.04) 100%);
    border: 1px solid rgba(79,140,255,0.2);
    border-radius: 16px; padding: 28px 32px;
    margin-bottom: 28px;
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 20px; flex-wrap: wrap;
  }
  .pr-identity-left { display: flex; align-items: center; gap: 20px; }
  .pr-avatar {
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono); font-size: 16px; font-weight: 700;
    color: white; flex-shrink: 0;
    box-shadow: 0 4px 20px rgba(79,140,255,0.3);
  }
  .pr-identity-info {}
  .pr-address {
    font-family: var(--mono); font-size: 14px; color: var(--bright);
    letter-spacing: 0.02em; margin-bottom: 6px;
  }
  .pr-address-full {
    font-family: var(--mono); font-size: 10px; color: var(--subtle);
    word-break: break-all; max-width: 360px;
  }
  .pr-orcid {
    margin-top: 8px; font-family: var(--mono); font-size: 11px; color: var(--subtle);
  }
  .pr-orcid a { color: var(--accent); text-decoration: none; }
  .pr-orcid a:hover { text-decoration: underline; }
  .pr-identity-right { display: flex; gap: 10px; flex-wrap: wrap; }
  .pr-share-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: var(--r);
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
    border: 1px solid var(--border); background: transparent;
    cursor: pointer; transition: all var(--t);
  }
  .pr-share-btn:hover { border-color: var(--accent); color: var(--accent); }
  .pr-own-badge {
    padding: 5px 12px; border-radius: var(--r);
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em;
    text-transform: uppercase;
    background: rgba(46,221,170,0.08); border: 1px solid rgba(46,221,170,0.2);
    color: var(--accent2);
  }

  /* Stats row */
  .pr-stats {
    display: grid; grid-template-columns: repeat(5, 1fr);
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); overflow: hidden; margin-bottom: 28px;
  }
  @media (max-width: 600px) { .pr-stats { grid-template-columns: repeat(3, 1fr); } }
  .pr-stat {
    padding: 18px 14px; text-align: center;
    border-right: 1px solid var(--border);
    transition: background var(--t);
  }
  .pr-stat:last-child { border-right: none; }
  .pr-stat:hover { background: var(--surface2); }
  .pr-stat-num {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 26px; color: var(--bright); line-height: 1; margin-bottom: 5px;
  }
  .pr-stat-num.green { color: var(--accent2); }
  .pr-stat-num.blue  { color: var(--accent); }
  .pr-stat-num.gold  { color: var(--warn); }
  .pr-stat-label {
    font-family: var(--mono); font-size: 9px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--subtle);
    line-height: 1.4;
  }

  /* Section title */
  .pr-section-title {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--subtle);
    display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
  }
  .pr-section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* Type breakdown */
  .pr-type-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px; margin-bottom: 28px;
  }
  .pr-type-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 12px 14px;
    cursor: pointer; transition: all var(--t);
  }
  .pr-type-card:hover { border-color: var(--subtle); transform: translateY(-1px); }
  .pr-type-card.active { border-color: var(--accent); background: rgba(79,140,255,0.08); }
  .pr-type-count {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 22px; font-weight: 700; line-height: 1; margin-bottom: 4px;
  }
  .pr-type-label {
    font-family: var(--mono); font-size: 10px; color: var(--subtle);
    letter-spacing: 0.05em;
  }

  /* RO list */
  .pr-list { display: flex; flex-direction: column; gap: 10px; }
  .pr-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 16px 18px;
    text-decoration: none; display: block;
    transition: border-color var(--t), transform var(--t);
    position: relative; overflow: hidden;
  }
  .pr-card:hover { transform: translateX(4px); border-color: var(--subtle); }
  .pr-card-top {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 12px; margin-bottom: 8px;
  }
  .pr-card-title {
    font-size: 14px; font-weight: 600; color: var(--bright);
    line-height: 1.4; flex: 1;
  }
  .pr-card-badge {
    padding: 3px 9px; border-radius: 10px; font-family: var(--mono);
    font-size: 10px; border: 1px solid; white-space: nowrap; flex-shrink: 0;
  }
  .pr-card-claim {
    font-family: var(--mono); font-size: 11px; color: var(--accent2);
    background: rgba(46,221,170,0.06); border: 1px solid rgba(46,221,170,0.14);
    border-radius: 6px; padding: 6px 10px; line-height: 1.55; margin-bottom: 10px;
  }
  .pr-card-foot {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    font-family: var(--mono); font-size: 10px; color: var(--subtle);
  }
  .pr-conf-dots { display: flex; gap: 3px; }
  .pr-conf-dot { width: 7px; height: 7px; border-radius: 50%; }

  /* Empty */
  .pr-empty {
    text-align: center; padding: 48px 24px;
    font-family: var(--mono); font-size: 13px; color: var(--subtle);
  }

  /* Loading */
  .pr-loading {
    text-align: center; padding: 80px 24px;
    font-family: var(--mono); font-size: 13px; color: var(--subtle);
  }
  @keyframes pr-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
  .pr-loading { animation: pr-pulse 1.5s ease infinite; }

  /* Gate */
  .pr-gate {
    text-align: center; padding: 80px 24px;
  }
  .pr-gate-icon { font-size: 40px; margin-bottom: 20px; display: block; }
  .pr-gate-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 22px; font-weight: 700; color: var(--bright);
    margin-bottom: 10px; letter-spacing: -0.4px;
  }
  .pr-gate-sub { font-size: 14px; color: var(--subtle); margin-bottom: 24px; }

  /* Copied toast */
  .pr-toast {
    position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
    background: var(--surface2); border: 1px solid var(--accent2);
    border-radius: 20px; padding: 8px 20px;
    font-family: var(--mono); font-size: 12px; color: var(--accent2);
    z-index: 100; pointer-events: none;
    animation: pr-toast-in 200ms ease both;
  }
  @keyframes pr-toast-in { from { opacity:0; transform: translateX(-50%) translateY(8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }

  @keyframes pr-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .pr-fade { animation: pr-in 350ms ease both; }
`;

// ── Component ─────────────────────────────────────────────────

export default function ProfileContent() {
  const searchParams = useSearchParams();
  const walletParam = searchParams.get("wallet");

  const [myAddress, setMyAddress]   = useState<string | null>(null);
  const [ros, setROs]               = useState<ROSummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [typeFilter, setTypeFilter] = useState<ROType | "">("");
  const [copied, setCopied]         = useState(false);

  // Resolve which wallet to show
  const targetWallet = walletParam ?? myAddress;
  const isOwn = !walletParam || (myAddress && walletParam.toLowerCase() === myAddress.toLowerCase());

  // Get signed-in address
  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => {
      if (d.address) setMyAddress(d.address);
    });
  }, []);

  // Fetch ROs for the target wallet
  useEffect(() => {
    if (!targetWallet) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/ro/list?wallet=${targetWallet}&limit=50`)
      .then(r => r.json())
      .then(d => setROs(d.ros ?? []))
      .catch(() => setROs([]))
      .finally(() => setLoading(false));
  }, [targetWallet]);

  function copyProfileUrl() {
    if (!targetWallet) return;
    const url = `${window.location.origin}/profile?wallet=${targetWallet}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Stats
  const stats = useMemo(() => ({
    total:      ros.length,
    minted:     ros.filter(r => r.minted).length,
    validated:  ros.filter(r => r.confidence === 3).length,
    commercial: ros.filter(r => r.hasCommercialRelevance).length,
    avgConf:    avgConfidence(ros),
  }), [ros]);

  // Type breakdown
  const typeBreakdown = useMemo(() => {
    const counts: Partial<Record<ROType, number>> = {};
    ros.forEach(r => { counts[r.roType] = (counts[r.roType] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [ROType, number][];
  }, [ros]);

  // Filtered list
  const filtered = useMemo(() =>
    typeFilter ? ros.filter(r => r.roType === typeFilter) : ros,
    [ros, typeFilter]
  );

  // ORCID — take from first RO that has one (not in summary, so we skip for now)
  // Could be fetched separately if needed

  // ── Not signed in and no wallet param ────────────────────────
  if (!loading && !targetWallet) {
    return (
      <>
        <style>{css}</style>
        <div className="pr-wrap">
          <div className="pr-nav">
            <a href="/" className="pr-wordmark">carrier<em>wave</em></a>
          </div>
          <div className="pr-gate">
            <span className="pr-gate-icon">⬡</span>
            <div className="pr-gate-title">Sign in to view your profile</div>
            <div className="pr-gate-sub">Your wallet is your identity on Carrierwave.</div>
            <a href="/" className="pr-btn pr-btn-primary">← Sign in on homepage</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      {copied && <div className="pr-toast">✓ Profile URL copied</div>}

      <div className="pr-wrap pr-fade">

        {/* Nav */}
        <div className="pr-nav">
          <a href="/" className="pr-wordmark">carrier<em>wave</em></a>
          <div className="pr-nav-right">
            <a href="/explore" className="pr-btn">← Feed</a>
            {myAddress && isOwn && (
              <a href="/upload" className="pr-btn pr-btn-primary">+ Submit RO</a>
            )}
          </div>
        </div>

        {/* Identity card */}
        {targetWallet && (
          <div className="pr-identity">
            <div className="pr-identity-left">
              <div className="pr-avatar">
                {targetWallet.slice(2, 4).toUpperCase()}
              </div>
              <div className="pr-identity-info">
                <div className="pr-address">{shortAddr(targetWallet)}</div>
                <div className="pr-address-full">{targetWallet}</div>
              </div>
            </div>
            <div className="pr-identity-right">
              {isOwn && <div className="pr-own-badge">your profile</div>}
              <button className="pr-share-btn" onClick={copyProfileUrl}>
                ↗ Copy profile URL
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="pr-stats">
          <div className="pr-stat">
            <div className="pr-stat-num blue">{loading ? "…" : stats.total}</div>
            <div className="pr-stat-label">Research<br/>Objects</div>
          </div>
          <div className="pr-stat">
            <div className="pr-stat-num green">{loading ? "…" : stats.minted}</div>
            <div className="pr-stat-label">Minted<br/>On-chain</div>
          </div>
          <div className="pr-stat">
            <div className="pr-stat-num green">{loading ? "…" : stats.validated}</div>
            <div className="pr-stat-label">Independently<br/>Validated</div>
          </div>
          <div className="pr-stat">
            <div className="pr-stat-num gold">{loading ? "…" : stats.commercial}</div>
            <div className="pr-stat-label">Commercial<br/>Relevance</div>
          </div>
          <div className="pr-stat">
            <div className="pr-stat-num">{loading ? "…" : stats.avgConf}</div>
            <div className="pr-stat-label">Avg<br/>Confidence</div>
          </div>
        </div>

        {/* Type breakdown */}
        {!loading && typeBreakdown.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="pr-section-title">By type</div>
            <div className="pr-type-grid">
              {typeBreakdown.map(([type, count]) => (
                <div
                  key={type}
                  className={`pr-type-card${typeFilter === type ? " active" : ""}`}
                  onClick={() => setTypeFilter(typeFilter === type ? "" : type)}
                >
                  <div className="pr-type-count" style={{ color: TYPE_COLORS[type] }}>{count}</div>
                  <div className="pr-type-label">{TYPE_LABELS[type]}</div>
                </div>
              ))}
              {typeFilter && (
                <div className="pr-type-card" onClick={() => setTypeFilter("")}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="pr-type-label" style={{ color: "var(--accent)" }}>✕ Clear filter</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RO list */}
        <div className="pr-section-title">
          {typeFilter ? TYPE_LABELS[typeFilter] : "All research objects"}
        </div>

        {loading ? (
          <div className="pr-loading">Loading research objects…</div>
        ) : filtered.length === 0 ? (
          <div className="pr-empty">
            {ros.length === 0
              ? isOwn
                ? <>No research objects yet. <a href="/upload" style={{ color: "var(--accent)" }}>Submit your first one →</a></>
                : "This wallet hasn't submitted any research objects yet."
              : "No results for this filter."
            }
          </div>
        ) : (
          <div className="pr-list">
            {filtered.map((ro, idx) => {
              const tc = TYPE_COLORS[ro.roType];
              const cc = CONF_COLORS[ro.confidence];
              return (
                <a
                  key={ro.id}
                  href={`/ro/${ro.id}`}
                  className="pr-card"
                  style={{ animationDelay: `${idx * 40}ms`, borderLeft: `3px solid ${tc}60` }}
                >
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tc, borderRadius: "var(--r) 0 0 var(--r)", opacity: 0.8 }} />
                  <div className="pr-card-top">
                    <div className="pr-card-title">{ro.title}</div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <span className="pr-card-badge" style={{ color: tc, borderColor: `${tc}44`, background: `${tc}12` }}>
                        {TYPE_LABELS[ro.roType]}
                      </span>
                      {ro.minted && (
                        <span className="pr-card-badge" style={{ color: "var(--accent2)", borderColor: "rgba(46,221,170,.3)", background: "rgba(46,221,170,.08)" }}>
                          ⬡
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pr-card-claim">{ro.claim}</div>
                  <div className="pr-card-foot">
                    <div className="pr-conf-dots">
                      {[1,2,3].map(i => (
                        <div key={i} className="pr-conf-dot"
                          style={{ background: i <= ro.confidence ? cc : "var(--muted)" }} />
                      ))}
                    </div>
                    <span style={{ color: cc }}>{CONF_LABELS[ro.confidence]}</span>
                    <span>n={ro.replicateCount}</span>
                    <span>🧬 {ro.species}</span>
                    <span>{timeAgo(ro.timestamp)}</span>
                    {ro.diseaseAreaTags.length > 0 && (
                      <span style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 10 }}>
                        {ro.diseaseAreaTags.slice(0, 2).join(" · ")}
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}

      </div>
    </>
  );
}
