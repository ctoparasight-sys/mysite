"use client";

// =================================================================
// app/bounties/page.tsx — Bounty Listing / Browse Feed
//
// Shows open bounties from KV, filterable by disease tag.
// Similar layout to /explore.
// =================================================================

import { useState, useEffect } from "react";
import type { BountySummary, BountyStatus } from "@/types/bounty";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');

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
    --danger:  #ff6b6b;
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
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      linear-gradient(rgba(79,140,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(79,140,255,0.025) 1px, transparent 1px);
    background-size: 56px 56px;
  }

  .bf-wrap {
    max-width: 800px; margin: 0 auto;
    padding: 36px 24px 100px; position: relative; z-index: 1;
  }

  .bf-nav {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 40px; padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .bf-wordmark {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 22px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.3px;
  }
  .bf-wordmark em { color: var(--accent); font-style: italic; }
  .bf-nav-right { display: flex; gap: 10px; align-items: center; }

  .bf-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: var(--r);
    font-size: 13px; font-weight: 500; font-family: var(--sans);
    cursor: pointer; transition: all var(--t);
    border: 1px solid var(--border); background: transparent;
    color: var(--text); text-decoration: none;
  }
  .bf-btn:hover { border-color: var(--subtle); color: var(--bright); }
  .bf-btn-primary { background: var(--accent); border-color: var(--accent); color: white; }
  .bf-btn-primary:hover { background: #6fa3ff; border-color: #6fa3ff; }

  .bf-header {
    display: flex; align-items: flex-end; justify-content: space-between;
    margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
  }
  .bf-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 28px; font-weight: 700; color: var(--bright);
    letter-spacing: -0.5px;
  }
  .bf-count {
    font-family: var(--mono); font-size: 12px; color: var(--subtle);
  }

  .bf-filters {
    display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;
  }
  .bf-filter {
    padding: 6px 14px; border-radius: 20px; font-size: 12px;
    font-family: var(--mono); border: 1px solid var(--border);
    background: transparent; color: var(--subtle); cursor: pointer;
    transition: all var(--t);
  }
  .bf-filter:hover { border-color: var(--subtle); color: var(--text); }
  .bf-filter.active { border-color: var(--accent); color: var(--accent); background: rgba(79,140,255,0.08); }

  .bf-list { display: flex; flex-direction: column; gap: 12px; }

  .bf-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 20px 22px;
    text-decoration: none; display: block;
    transition: border-color var(--t), transform var(--t);
  }
  .bf-card:hover { transform: translateX(4px); border-color: var(--subtle); }

  .bf-card-top {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px; margin-bottom: 10px;
  }
  .bf-card-tag {
    font-family: var(--mono); font-size: 11px; color: var(--accent);
    letter-spacing: 0.05em; margin-bottom: 4px;
  }
  .bf-card-amount {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 22px; font-weight: 700; color: var(--accent2);
    white-space: nowrap;
  }
  .bf-card-criteria {
    font-size: 14px; color: var(--bright); line-height: 1.5;
    margin-bottom: 12px;
  }
  .bf-card-foot {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    font-family: var(--mono); font-size: 10px; color: var(--subtle);
  }
  .bf-card-status {
    padding: 3px 10px; border-radius: 10px; font-size: 10px;
    font-family: var(--mono); letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .bf-empty {
    text-align: center; padding: 48px 24px;
    font-family: var(--mono); font-size: 13px; color: var(--subtle);
  }

  .bf-loading {
    text-align: center; padding: 80px 24px;
    font-family: var(--mono); font-size: 13px; color: var(--subtle);
  }
  @keyframes bf-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
  .bf-loading { animation: bf-pulse 1.5s ease infinite; }

  @keyframes bf-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .bf-fade { animation: bf-in 350ms ease both; }
`;

const STATUS_STYLES: Record<BountyStatus, { bg: string; border: string; color: string }> = {
  open:      { bg: "rgba(46,221,170,0.08)", border: "rgba(46,221,170,0.3)", color: "#2eddaa" },
  finalized: { bg: "rgba(79,140,255,0.08)", border: "rgba(79,140,255,0.3)", color: "#4f8cff" },
  cancelled: { bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.3)", color: "#ff6b6b" },
};

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

function timeLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86400000);
  if (d > 30) return `${Math.floor(d / 30)}mo left`;
  if (d > 0) return `${d}d left`;
  const h = Math.floor(ms / 3600000);
  return `${h}h left`;
}

export default function BountiesPage() {
  const [bounties, setBounties] = useState<BountySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BountyStatus | "">("");
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => {
      if (d.address) setAddress(d.address);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/bounty/list?${params}`)
      .then(r => r.json())
      .then(d => setBounties(d.bounties ?? []))
      .catch(() => setBounties([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <>
      <style>{css}</style>
      <div className="bf-wrap bf-fade">
        <div className="bf-nav">
          <a href="/" className="bf-wordmark">carrier<em>wave</em></a>
          <div className="bf-nav-right">
            <a href="/explore" className="bf-btn">Explore</a>
            {address && <a href="/register" className="bf-btn">Register</a>}
            {address && <a href="/bounties/create" className="bf-btn bf-btn-primary">+ Create Bounty</a>}
          </div>
        </div>

        <div className="bf-header">
          <div>
            <div className="bf-title">Bounties</div>
            <div className="bf-count">{loading ? "..." : `${bounties.length} bounties`}</div>
          </div>
        </div>

        <div className="bf-filters">
          {(["", "open", "finalized", "cancelled"] as const).map(s => (
            <button
              key={s}
              className={`bf-filter${statusFilter === s ? " active" : ""}`}
              onClick={() => setStatusFilter(s as BountyStatus | "")}
            >
              {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bf-loading">Loading bounties...</div>
        ) : bounties.length === 0 ? (
          <div className="bf-empty">
            No bounties yet.
            {address && <> <a href="/bounties/create" style={{ color: "var(--accent)" }}>Create the first one</a></>}
          </div>
        ) : (
          <div className="bf-list">
            {bounties.map((b, idx) => {
              const ss = STATUS_STYLES[b.status];
              return (
                <a
                  key={b.id}
                  href={`/bounties/${b.id}`}
                  className="bf-card"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="bf-card-top">
                    <div style={{ flex: 1 }}>
                      <div className="bf-card-tag">{b.diseaseTag}</div>
                      <div className="bf-card-criteria">{b.criteria}</div>
                    </div>
                    <div className="bf-card-amount">{b.amount} ETH</div>
                  </div>
                  <div className="bf-card-foot">
                    <span
                      className="bf-card-status"
                      style={{ background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}
                    >
                      {b.status}
                    </span>
                    <span>{b.claimCount} claim{b.claimCount !== 1 ? "s" : ""}</span>
                    <span>{timeLeft(b.deadline)}</span>
                    <span>by {shortAddr(b.funderAddress)}</span>
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
