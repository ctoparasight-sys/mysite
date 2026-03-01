"use client";

// =================================================================
// app/dashboard/page.tsx — Funder Dashboard
//
// Summary stats, bounty portfolio, claims queue, and analytics
// for funders managing bounties on Carrierwave.
// =================================================================

// @ts-ignore
import { createWalletClient, custom, parseAbi } from "viem";
// @ts-ignore
import { mainnet, sepolia } from "viem/chains";
import { useState, useEffect } from "react";
import type { StoredBounty, StoredClaim } from "@/types/bounty";
import type { DashboardSummary } from "@/types/dashboard";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "1");
const viemChain = CHAIN_ID === 11155111 ? sepolia : mainnet;
const hexChainId = `0x${CHAIN_ID.toString(16)}` as const;
const explorerBase = CHAIN_ID === 11155111 ? "https://sepolia.etherscan.io" : "https://etherscan.io";

const BOUNTY_CONTRACT = process.env.NEXT_PUBLIC_BOUNTY_CONTRACT as `0x${string}` | undefined;

const BOUNTY_ABI = parseAbi([
  "function approveClaim(uint256 bountyId, uint256 claimIndex, uint16 shareBps) external",
  "function rejectClaim(uint256 bountyId, uint256 claimIndex) external",
  "function finalizeBounty(uint256 bountyId) external",
  "function cancelBounty(uint256 bountyId) external",
]);

type Tab = "portfolio" | "claims" | "analytics";

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

  .fd-wrap {
    max-width: 960px; margin: 0 auto;
    padding: 36px 24px 100px; position: relative; z-index: 1;
  }

  /* Nav */
  .fd-nav {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 40px; padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .fd-wordmark {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 22px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.3px;
  }
  .fd-wordmark em { color: var(--accent); font-style: italic; }
  .fd-nav-right { display: flex; gap: 8px; align-items: center; }

  .fd-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: var(--r);
    font-size: 13px; font-weight: 500; font-family: var(--sans);
    cursor: pointer; transition: all var(--t);
    border: 1px solid var(--border); background: transparent;
    color: var(--text); text-decoration: none;
  }
  .fd-btn:hover { border-color: var(--subtle); color: var(--bright); }
  .fd-btn-primary { background: var(--accent); border-color: var(--accent); color: white; }
  .fd-btn-primary:hover { background: #6fa3ff; border-color: #6fa3ff; }
  .fd-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .fd-btn-green { background: var(--accent2); border-color: var(--accent2); color: #080b11; }
  .fd-btn-green:hover { background: #50e8b8; }
  .fd-btn-green:disabled { opacity: 0.5; cursor: not-allowed; }
  .fd-btn-danger { border-color: var(--danger); color: var(--danger); }
  .fd-btn-danger:hover { background: rgba(255,107,107,0.1); }
  .fd-btn-sm { padding: 5px 12px; font-size: 11px; }
  .fd-btn-active { border-color: var(--accent); color: var(--accent); background: rgba(79,140,255,0.08); }

  /* Header */
  .fd-header {
    margin-bottom: 28px;
  }
  .fd-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 28px; font-weight: 700; color: var(--bright);
    letter-spacing: -0.5px; margin-bottom: 6px;
  }
  .fd-subtitle {
    font-family: var(--mono); font-size: 12px; color: var(--subtle);
  }

  /* Summary cards */
  .fd-summary {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 12px; margin-bottom: 28px;
  }
  @media (max-width: 640px) { .fd-summary { grid-template-columns: repeat(2, 1fr); } }
  .fd-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 18px 16px; text-align: center;
    transition: all var(--t);
  }
  .fd-card:hover { border-color: var(--subtle); transform: translateY(-1px); }
  .fd-card-num {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 28px; font-weight: 700; color: var(--bright);
    line-height: 1; margin-bottom: 6px;
  }
  .fd-card-num.green { color: var(--accent2); }
  .fd-card-num.blue { color: var(--accent); }
  .fd-card-num.orange { color: var(--warn); }
  .fd-card-label {
    font-family: var(--mono); font-size: 9px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--subtle);
  }
  .fd-pending-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--warn); margin-left: 6px;
    animation: fd-pulse 1.5s ease infinite;
  }

  /* Tabs */
  .fd-tabs {
    display: flex; gap: 6px; margin-bottom: 24px;
    border-bottom: 1px solid var(--border); padding-bottom: 12px;
  }

  /* Portfolio bounty cards */
  .fd-bounty {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 18px 20px; margin-bottom: 10px;
    transition: all var(--t);
  }
  .fd-bounty:hover { border-color: var(--subtle); }
  .fd-bounty-top {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px; margin-bottom: 8px;
  }
  .fd-bounty-tag {
    font-family: var(--mono); font-size: 11px; color: var(--accent);
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .fd-bounty-criteria {
    font-size: 13px; color: var(--text); line-height: 1.5;
    margin-bottom: 10px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .fd-bounty-meta {
    display: flex; gap: 14px; flex-wrap: wrap; align-items: center;
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
  }
  .fd-bounty-meta-val { color: var(--bright); font-weight: 500; }
  .fd-bounty-actions {
    display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;
  }
  .fd-status-badge {
    display: inline-block; padding: 3px 10px; border-radius: 10px;
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* Claim cards */
  .fd-claim {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 16px 20px; margin-bottom: 10px;
  }
  .fd-claim-context {
    font-family: var(--mono); font-size: 10px; color: var(--subtle);
    letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px;
  }
  .fd-claim-top {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px; margin-bottom: 6px;
  }
  .fd-claim-ro {
    font-size: 13px; color: var(--accent); font-family: var(--mono);
    text-decoration: none;
  }
  .fd-claim-ro:hover { text-decoration: underline; }
  .fd-claim-scientist {
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
  }
  .fd-claim-just {
    font-size: 13px; color: var(--text); line-height: 1.5; margin-bottom: 10px;
  }
  .fd-claim-actions {
    display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap;
  }
  .fd-share-input {
    width: 80px; padding: 5px 8px; border-radius: 6px;
    border: 1px solid var(--border); background: var(--surface2);
    color: var(--bright); font-family: var(--mono); font-size: 12px;
    outline: none;
  }
  .fd-share-input:focus { border-color: var(--accent); }

  /* Analytics */
  .fd-analytics-section {
    margin-bottom: 28px;
  }
  .fd-section-title {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--subtle);
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 14px;
  }
  .fd-section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  .fd-bar-track {
    display: flex; height: 28px; border-radius: 6px;
    overflow: hidden; background: var(--surface);
    border: 1px solid var(--border);
  }
  .fd-bar-seg {
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono); font-size: 10px; color: white;
    min-width: 24px; transition: width 0.3s ease;
  }

  .fd-stat-row {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 12px; margin-bottom: 8px;
  }
  .fd-stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 16px; text-align: center;
  }
  .fd-stat-num {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 24px; font-weight: 700; line-height: 1; margin-bottom: 4px;
  }
  .fd-stat-label {
    font-family: var(--mono); font-size: 9px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--subtle);
  }

  /* Gate screens */
  .fd-gate {
    text-align: center; padding: 100px 24px;
  }
  .fd-gate-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 24px; font-weight: 700; color: var(--bright);
    margin-bottom: 12px;
  }
  .fd-gate-text {
    font-size: 14px; color: var(--subtle); margin-bottom: 28px;
    max-width: 400px; margin-left: auto; margin-right: auto;
  }

  .fd-error {
    background: rgba(255,107,107,0.08); border: 1px solid rgba(255,107,107,0.3);
    border-radius: var(--r); padding: 10px 14px; margin-bottom: 12px;
    font-size: 12px; color: var(--danger);
  }

  .fd-loading {
    text-align: center; padding: 80px 24px;
    font-family: var(--mono); font-size: 13px; color: var(--subtle);
  }

  @keyframes fd-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
  .fd-loading { animation: fd-pulse 1.5s ease infinite; }

  @keyframes fd-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .fd-fade { animation: fd-in 350ms ease both; }
`;

// ── Helpers ──────────────────────────────────────────────────────

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

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  open:      { bg: "rgba(46,221,170,0.08)", border: "rgba(46,221,170,0.3)", color: "#2eddaa" },
  finalized: { bg: "rgba(79,140,255,0.08)", border: "rgba(79,140,255,0.3)", color: "#4f8cff" },
  cancelled: { bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.3)", color: "#ff6b6b" },
  pending:   { bg: "rgba(255,159,67,0.08)", border: "rgba(255,159,67,0.3)", color: "#ff9f43" },
  approved:  { bg: "rgba(46,221,170,0.08)", border: "rgba(46,221,170,0.3)", color: "#2eddaa" },
  rejected:  { bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.3)", color: "#ff6b6b" },
};

// ── Component ───────────────────────────────────────────────────

export default function DashboardPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const [bounties, setBounties] = useState<StoredBounty[]>([]);
  const [claims, setClaims] = useState<StoredClaim[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const [tab, setTab] = useState<Tab>("portfolio");

  // On-chain action states
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});
  const [actionState, setActionState] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [finalizeState, setFinalizeState] = useState<Record<string, string>>({});
  const [finalizeError, setFinalizeError] = useState("");

  // Check auth
  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => { if (d.address) setAddress(d.address); })
      .finally(() => setAuthLoading(false));
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => {
        setBounties(d.bounties ?? []);
        setClaims(d.claims ?? []);
        setSummary(d.summary ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  // ── Wallet client helper ────────────────────────────────────

  async function getWalletClient() {
    const ethereum = (window as any).ethereum;
    if (!ethereum) throw new Error("No wallet detected");
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    const account = accounts[0] as `0x${string}`;
    try {
      await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] });
    } catch (e: any) {
      if (e.code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: hexChainId,
            chainName: viemChain.name,
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [viemChain.rpcUrls.default.http[0]],
          }],
        });
      }
    }
    return createWalletClient({ account, chain: viemChain, transport: custom(ethereum) });
  }

  // ── Refresh data helper ─────────────────────────────────────

  async function refreshData() {
    const d = await fetch("/api/dashboard").then(r => r.json());
    setBounties(d.bounties ?? []);
    setClaims(d.claims ?? []);
    setSummary(d.summary ?? null);
  }

  // ── Approve claim ───────────────────────────────────────────

  async function handleApproveClaim(claim: StoredClaim) {
    if (!BOUNTY_CONTRACT) return;
    const shareBps = parseInt(shareInputs[claim.id] ?? "0");
    if (!shareBps || shareBps <= 0 || shareBps > 10000) {
      setActionError("Share must be 1-10000 bps");
      return;
    }
    try {
      setActionState(s => ({ ...s, [claim.id]: "approving" }));
      setActionError("");
      const client = await getWalletClient();
      const txHash = await client.writeContract({
        address: BOUNTY_CONTRACT,
        abi: BOUNTY_ABI,
        functionName: "approveClaim",
        args: [BigInt(claim.onChainBountyId), BigInt(claim.onChainClaimIndex), shareBps],
      });
      await fetch("/api/claim/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: claim.id, status: "approved", shareBps, txHash }),
      });
      setActionState(s => ({ ...s, [claim.id]: "done" }));
      await refreshData();
    } catch (err: any) {
      setActionError(err?.shortMessage ?? err?.message ?? "Failed");
      setActionState(s => ({ ...s, [claim.id]: "error" }));
    }
  }

  // ── Reject claim ────────────────────────────────────────────

  async function handleRejectClaim(claim: StoredClaim) {
    if (!BOUNTY_CONTRACT) return;
    try {
      setActionState(s => ({ ...s, [claim.id]: "rejecting" }));
      setActionError("");
      const client = await getWalletClient();
      const txHash = await client.writeContract({
        address: BOUNTY_CONTRACT,
        abi: BOUNTY_ABI,
        functionName: "rejectClaim",
        args: [BigInt(claim.onChainBountyId), BigInt(claim.onChainClaimIndex)],
      });
      await fetch("/api/claim/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: claim.id, status: "rejected", shareBps: 0, txHash }),
      });
      setActionState(s => ({ ...s, [claim.id]: "done" }));
      await refreshData();
    } catch (err: any) {
      setActionError(err?.shortMessage ?? err?.message ?? "Failed");
      setActionState(s => ({ ...s, [claim.id]: "error" }));
    }
  }

  // ── Finalize bounty ─────────────────────────────────────────

  async function handleFinalize(bounty: StoredBounty) {
    if (!BOUNTY_CONTRACT) return;
    try {
      setFinalizeState(s => ({ ...s, [bounty.id]: "mining" }));
      setFinalizeError("");
      const client = await getWalletClient();
      const txHash = await client.writeContract({
        address: BOUNTY_CONTRACT,
        abi: BOUNTY_ABI,
        functionName: "finalizeBounty",
        args: [BigInt(bounty.onChainId)],
      });
      setFinalizeState(s => ({ ...s, [bounty.id]: "saving" }));
      await fetch("/api/bounty/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id, action: "finalize", txHash }),
      });
      setFinalizeState(s => ({ ...s, [bounty.id]: "done" }));
      await refreshData();
    } catch (err: any) {
      setFinalizeError(err?.shortMessage ?? err?.message ?? "Failed");
      setFinalizeState(s => ({ ...s, [bounty.id]: "error" }));
    }
  }

  // ── Cancel bounty ───────────────────────────────────────────

  async function handleCancel(bounty: StoredBounty) {
    if (!BOUNTY_CONTRACT) return;
    try {
      setFinalizeState(s => ({ ...s, [bounty.id]: "mining" }));
      setFinalizeError("");
      const client = await getWalletClient();
      const txHash = await client.writeContract({
        address: BOUNTY_CONTRACT,
        abi: BOUNTY_ABI,
        functionName: "cancelBounty",
        args: [BigInt(bounty.onChainId)],
      });
      setFinalizeState(s => ({ ...s, [bounty.id]: "saving" }));
      await fetch("/api/bounty/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id, action: "cancel", txHash }),
      });
      setFinalizeState(s => ({ ...s, [bounty.id]: "done" }));
      await refreshData();
    } catch (err: any) {
      setFinalizeError(err?.shortMessage ?? err?.message ?? "Failed");
      setFinalizeState(s => ({ ...s, [bounty.id]: "error" }));
    }
  }

  // ── Derived data ────────────────────────────────────────────

  const pendingClaims = claims.filter(c => c.status === "pending");

  // Sort bounties: open first, then by newest
  const sortedBounties = [...bounties].sort((a, b) => {
    if (a.status === "open" && b.status !== "open") return -1;
    if (a.status !== "open" && b.status === "open") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Claims with bounty context, pending first
  const sortedClaims = [...claims].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  function getBountyForClaim(claim: StoredClaim): StoredBounty | undefined {
    return bounties.find(b => b.id === claim.bountyId);
  }

  function getApprovedShares(bountyId: string): number {
    return claims
      .filter(c => c.bountyId === bountyId && c.status === "approved")
      .reduce((sum, c) => sum + c.shareBps, 0);
  }

  function getClaimCount(bountyId: string): number {
    return claims.filter(c => c.bountyId === bountyId).length;
  }

  // ── Nav (shared) ────────────────────────────────────────────

  const nav = (
    <div className="fd-nav">
      <a href="/" className="fd-wordmark">carrier<em>wave</em></a>
      <div className="fd-nav-right">
        <a href="/explore" className="fd-btn">Explore</a>
        <a href="/bounties" className="fd-btn">Bounties</a>
        <a href="/graph" className="fd-btn">Graph</a>
        <a href="/bounties/create" className="fd-btn fd-btn-primary">+ Create Bounty</a>
      </div>
    </div>
  );

  // ── Gate: loading auth ──────────────────────────────────────

  if (authLoading) return (
    <>
      <style>{css}</style>
      <div className="fd-wrap"><div className="fd-loading">Loading...</div></div>
    </>
  );

  // ── Gate: not signed in ─────────────────────────────────────

  if (!address) return (
    <>
      <style>{css}</style>
      <div className="fd-wrap fd-fade">
        {nav}
        <div className="fd-gate">
          <div className="fd-gate-title">Funder Dashboard</div>
          <div className="fd-gate-text">
            Sign in with your wallet to view your bounty portfolio, review claims, and track analytics.
          </div>
          <a href="/" className="fd-btn fd-btn-primary">Sign in with wallet</a>
        </div>
      </div>
    </>
  );

  // ── Gate: loading data ──────────────────────────────────────

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="fd-wrap">
        {nav}
        <div className="fd-loading">Loading dashboard...</div>
      </div>
    </>
  );

  // ── Gate: no bounties ───────────────────────────────────────

  if (bounties.length === 0) return (
    <>
      <style>{css}</style>
      <div className="fd-wrap fd-fade">
        {nav}
        <div className="fd-gate">
          <div className="fd-gate-title">No bounties yet</div>
          <div className="fd-gate-text">
            Create your first bounty to start funding scientific research and tracking claims from your dashboard.
          </div>
          <a href="/bounties/create" className="fd-btn fd-btn-primary">+ Create Your First Bounty</a>
        </div>
      </div>
    </>
  );

  // ── Analytics charts ────────────────────────────────────────

  const totalEth = (summary?.ethByStatus.open ?? 0) + (summary?.ethByStatus.finalized ?? 0) + (summary?.ethByStatus.cancelled ?? 0);

  function renderAnalytics() {
    if (!summary) return null;

    const maxDisease = Math.max(...summary.diseaseBreakdown.map(d => d.eth), 0.001);
    const maxTimeline = Math.max(...summary.timeline.map(t => t.count), 1);

    return (
      <>
        {/* ETH by Status */}
        <div className="fd-analytics-section">
          <div className="fd-section-title">ETH by status</div>
          {totalEth > 0 ? (
            <>
              <div className="fd-bar-track">
                {summary.ethByStatus.open > 0 && (
                  <div
                    className="fd-bar-seg"
                    style={{
                      width: `${(summary.ethByStatus.open / totalEth) * 100}%`,
                      background: "#2eddaa",
                    }}
                  >
                    {summary.ethByStatus.open.toFixed(3)}
                  </div>
                )}
                {summary.ethByStatus.finalized > 0 && (
                  <div
                    className="fd-bar-seg"
                    style={{
                      width: `${(summary.ethByStatus.finalized / totalEth) * 100}%`,
                      background: "#4f8cff",
                    }}
                  >
                    {summary.ethByStatus.finalized.toFixed(3)}
                  </div>
                )}
                {summary.ethByStatus.cancelled > 0 && (
                  <div
                    className="fd-bar-seg"
                    style={{
                      width: `${(summary.ethByStatus.cancelled / totalEth) * 100}%`,
                      background: "#ff6b6b",
                    }}
                  >
                    {summary.ethByStatus.cancelled.toFixed(3)}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--subtle)" }}>
                <span><span style={{ color: "#2eddaa" }}>&#9632;</span> Open</span>
                <span><span style={{ color: "#4f8cff" }}>&#9632;</span> Finalized</span>
                <span><span style={{ color: "#ff6b6b" }}>&#9632;</span> Cancelled</span>
              </div>
            </>
          ) : (
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--subtle)", padding: 16, textAlign: "center" }}>
              No ETH data yet
            </div>
          )}
        </div>

        {/* Claims by Status */}
        <div className="fd-analytics-section">
          <div className="fd-section-title">Claims by status</div>
          <div className="fd-stat-row">
            <div className="fd-stat-card">
              <div className="fd-stat-num" style={{ color: "var(--warn)" }}>{summary.claimsByStatus.pending}</div>
              <div className="fd-stat-label">Pending</div>
            </div>
            <div className="fd-stat-card">
              <div className="fd-stat-num" style={{ color: "var(--accent2)" }}>{summary.claimsByStatus.approved}</div>
              <div className="fd-stat-label">Approved</div>
            </div>
            <div className="fd-stat-card">
              <div className="fd-stat-num" style={{ color: "var(--danger)" }}>{summary.claimsByStatus.rejected}</div>
              <div className="fd-stat-label">Rejected</div>
            </div>
          </div>
        </div>

        {/* Disease Breakdown */}
        {summary.diseaseBreakdown.length > 0 && (
          <div className="fd-analytics-section">
            <div className="fd-section-title">Disease breakdown</div>
            {summary.diseaseBreakdown.map(d => (
              <div key={d.tag} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontFamily: "var(--mono)", fontSize: 11 }}>
                  <span style={{ color: "var(--text)" }}>{d.tag}</span>
                  <span style={{ color: "var(--subtle)" }}>{d.count} bounties / {d.eth.toFixed(3)} ETH</span>
                </div>
                <svg width="100%" height="14" style={{ display: "block" }}>
                  <rect x="0" y="0" width="100%" height="14" rx="4" fill="var(--surface)" />
                  <rect x="0" y="0" width={`${(d.eth / maxDisease) * 100}%`} height="14" rx="4" fill="var(--accent)" opacity="0.6" />
                </svg>
              </div>
            ))}
          </div>
        )}

        {/* Timeline */}
        {summary.timeline.length > 0 && (
          <div className="fd-analytics-section">
            <div className="fd-section-title">Monthly bounty creation</div>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 120 }}>
              {summary.timeline.map(t => (
                <div key={t.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <svg width="100%" height={100} style={{ display: "block" }}>
                    <rect
                      x="10%"
                      y={100 - (t.count / maxTimeline) * 100}
                      width="80%"
                      height={(t.count / maxTimeline) * 100}
                      rx="3"
                      fill="var(--accent2)"
                      opacity="0.6"
                    />
                  </svg>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--subtle)", marginTop: 4 }}>
                    {t.month.slice(5)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Main render ─────────────────────────────────────────────

  return (
    <>
      <style>{css}</style>
      <div className="fd-wrap fd-fade">
        {nav}

        {/* Header */}
        <div className="fd-header">
          <div className="fd-title">Funder Dashboard</div>
          <div className="fd-subtitle">{shortAddr(address)}</div>
        </div>

        {/* Summary Cards */}
        <div className="fd-summary">
          <div className="fd-card">
            <div className="fd-card-num green">{(summary?.totalEthLocked ?? 0).toFixed(3)}</div>
            <div className="fd-card-label">ETH Locked</div>
          </div>
          <div className="fd-card">
            <div className="fd-card-num blue">{summary?.activeBounties ?? 0}</div>
            <div className="fd-card-label">Active Bounties</div>
          </div>
          <div className="fd-card">
            <div className="fd-card-num">{summary?.totalClaims ?? 0}</div>
            <div className="fd-card-label">Total Claims</div>
          </div>
          <div className="fd-card">
            <div className="fd-card-num orange">
              {summary?.pendingClaims ?? 0}
              {(summary?.pendingClaims ?? 0) > 0 && <span className="fd-pending-dot" />}
            </div>
            <div className="fd-card-label">Pending Actions</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="fd-tabs">
          <button
            className={`fd-btn fd-btn-sm ${tab === "portfolio" ? "fd-btn-active" : ""}`}
            onClick={() => setTab("portfolio")}
          >
            Portfolio
          </button>
          <button
            className={`fd-btn fd-btn-sm ${tab === "claims" ? "fd-btn-active" : ""}`}
            onClick={() => setTab("claims")}
          >
            Claims Queue{pendingClaims.length > 0 ? ` (${pendingClaims.length})` : ""}
          </button>
          <button
            className={`fd-btn fd-btn-sm ${tab === "analytics" ? "fd-btn-active" : ""}`}
            onClick={() => setTab("analytics")}
          >
            Analytics
          </button>
        </div>

        {/* ── Portfolio Tab ─────────────────────────────────── */}
        {tab === "portfolio" && (
          <>
            {finalizeError && <div className="fd-error">{finalizeError}</div>}
            {sortedBounties.map(b => {
              const ss = STATUS_STYLES[b.status] ?? STATUS_STYLES.open;
              const isExpired = new Date(b.deadline).getTime() < Date.now();
              const approved = getApprovedShares(b.id);
              const claimCt = getClaimCount(b.id);
              const fState = finalizeState[b.id];
              const busy = fState === "mining" || fState === "saving";

              return (
                <div key={b.id} className="fd-bounty">
                  <div className="fd-bounty-top">
                    <div>
                      <div className="fd-bounty-tag">{b.diseaseTag}</div>
                    </div>
                    <span
                      className="fd-status-badge"
                      style={{ background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="fd-bounty-criteria">{b.criteria}</div>
                  <div className="fd-bounty-meta">
                    <span><span className="fd-bounty-meta-val">{b.amount} ETH</span></span>
                    <span>{claimCt} claim{claimCt !== 1 ? "s" : ""}</span>
                    <span>{timeLeft(b.deadline)}</span>
                    {b.status === "open" && <span>Approved: {approved}/10000 bps</span>}
                  </div>
                  <div className="fd-bounty-actions">
                    <a href={`/bounties/${b.id}`} className="fd-btn fd-btn-sm">View</a>
                    {b.status === "open" && approved === 10000 && (
                      <button
                        className="fd-btn fd-btn-green fd-btn-sm"
                        onClick={() => handleFinalize(b)}
                        disabled={busy}
                      >
                        {busy ? "Finalizing..." : "Finalize"}
                      </button>
                    )}
                    {b.status === "open" && isExpired && (
                      <button
                        className="fd-btn fd-btn-danger fd-btn-sm"
                        onClick={() => handleCancel(b)}
                        disabled={busy}
                      >
                        {busy ? "Cancelling..." : "Cancel & Refund"}
                      </button>
                    )}
                    {b.txHash && (
                      <a
                        href={`${explorerBase}/tx/${b.txHash}`}
                        target="_blank"
                        rel="noopener"
                        className="fd-btn fd-btn-sm"
                        style={{ color: "var(--subtle)", fontSize: 10 }}
                      >
                        Etherscan
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── Claims Queue Tab ─────────────────────────────── */}
        {tab === "claims" && (
          <>
            {actionError && <div className="fd-error">{actionError}</div>}
            {sortedClaims.length === 0 ? (
              <div style={{ padding: "40px 0", fontFamily: "var(--mono)", fontSize: 12, color: "var(--subtle)", textAlign: "center" }}>
                No claims yet across your bounties.
              </div>
            ) : (
              sortedClaims.map(claim => {
                const bountyCtx = getBountyForClaim(claim);
                const cs = STATUS_STYLES[claim.status] ?? STATUS_STYLES.pending;
                const aState = actionState[claim.id];
                const busy = aState === "approving" || aState === "rejecting";

                return (
                  <div key={claim.id} className="fd-claim">
                    {bountyCtx && (
                      <div className="fd-claim-context">
                        {bountyCtx.diseaseTag} / {bountyCtx.amount} ETH
                      </div>
                    )}
                    <div className="fd-claim-top">
                      <div>
                        <a href={`/ro/${claim.roId}`} className="fd-claim-ro">
                          RO: {claim.roId.slice(0, 8)}...
                        </a>
                        <div className="fd-claim-scientist">
                          by {shortAddr(claim.scientistAddress)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {claim.status === "approved" && (
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent2)" }}>
                            {claim.shareBps} bps
                          </span>
                        )}
                        <span
                          className="fd-status-badge"
                          style={{ background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color }}
                        >
                          {claim.status}
                        </span>
                      </div>
                    </div>
                    <div className="fd-claim-just">{claim.justification}</div>

                    {claim.status === "pending" && bountyCtx?.status === "open" && (
                      <div className="fd-claim-actions">
                        <input
                          className="fd-share-input"
                          type="number"
                          min="1"
                          max="10000"
                          placeholder="bps"
                          value={shareInputs[claim.id] ?? ""}
                          onChange={e => setShareInputs(s => ({ ...s, [claim.id]: e.target.value }))}
                        />
                        <button
                          className="fd-btn fd-btn-green fd-btn-sm"
                          onClick={() => handleApproveClaim(claim)}
                          disabled={busy}
                        >
                          {aState === "approving" ? "..." : "Approve"}
                        </button>
                        <button
                          className="fd-btn fd-btn-danger fd-btn-sm"
                          onClick={() => handleRejectClaim(claim)}
                          disabled={busy}
                        >
                          {aState === "rejecting" ? "..." : "Reject"}
                        </button>
                        {bountyCtx && (
                          <a href={`/bounties/${bountyCtx.id}`} className="fd-btn fd-btn-sm" style={{ marginLeft: "auto" }}>
                            View Bounty
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ── Analytics Tab ────────────────────────────────── */}
        {tab === "analytics" && renderAnalytics()}
      </div>
    </>
  );
}
