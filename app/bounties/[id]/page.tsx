"use client";

// =================================================================
// app/bounties/[id]/page.tsx — Bounty Detail + Claims
//
// Shows bounty details, claims list.
// Scientists can submit claims. Funders can approve/reject/finalize.
// =================================================================

// @ts-ignore
import { createWalletClient, custom, parseAbi } from "viem";
// @ts-ignore
import { mainnet, sepolia } from "viem/chains";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import type { StoredBounty, StoredClaim } from "@/types/bounty";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "1");
const viemChain = CHAIN_ID === 11155111 ? sepolia : mainnet;
const hexChainId = `0x${CHAIN_ID.toString(16)}` as const;
const explorerBase = CHAIN_ID === 11155111 ? "https://sepolia.etherscan.io" : "https://etherscan.io";

const BOUNTY_CONTRACT = process.env.NEXT_PUBLIC_BOUNTY_CONTRACT as `0x${string}` | undefined;

const BOUNTY_ABI = parseAbi([
  "function submitClaim(uint256 bountyId, string calldata roId, string calldata justification) external returns (uint256)",
  "function approveClaim(uint256 bountyId, uint256 claimIndex, uint16 shareBps) external",
  "function rejectClaim(uint256 bountyId, uint256 claimIndex) external",
  "function finalizeBounty(uint256 bountyId) external",
  "function cancelBounty(uint256 bountyId) external",
]);

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

  .bd-wrap {
    max-width: 800px; margin: 0 auto;
    padding: 36px 24px 100px; position: relative; z-index: 1;
  }

  .bd-nav {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 40px; padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .bd-wordmark {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 22px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.3px;
  }
  .bd-wordmark em { color: var(--accent); font-style: italic; }

  .bd-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: var(--r);
    font-size: 13px; font-weight: 500; font-family: var(--sans);
    cursor: pointer; transition: all var(--t);
    border: 1px solid var(--border); background: transparent;
    color: var(--text); text-decoration: none;
  }
  .bd-btn:hover { border-color: var(--subtle); color: var(--bright); }
  .bd-btn-primary { background: var(--accent); border-color: var(--accent); color: white; }
  .bd-btn-primary:hover { background: #6fa3ff; border-color: #6fa3ff; }
  .bd-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .bd-btn-green { background: var(--accent2); border-color: var(--accent2); color: #080b11; }
  .bd-btn-green:hover { background: #50e8b8; }
  .bd-btn-green:disabled { opacity: 0.5; cursor: not-allowed; }
  .bd-btn-danger { border-color: var(--danger); color: var(--danger); }
  .bd-btn-danger:hover { background: rgba(255,107,107,0.1); }
  .bd-btn-sm { padding: 5px 12px; font-size: 11px; }

  /* Header card */
  .bd-header {
    background: linear-gradient(135deg, rgba(79,140,255,0.07) 0%, rgba(46,221,170,0.04) 100%);
    border: 1px solid rgba(79,140,255,0.2);
    border-radius: 16px; padding: 28px 32px; margin-bottom: 24px;
  }
  .bd-tag {
    font-family: var(--mono); font-size: 11px; color: var(--accent);
    letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;
  }
  .bd-criteria {
    font-size: 18px; font-weight: 500; color: var(--bright);
    line-height: 1.5; margin-bottom: 16px;
  }
  .bd-meta {
    display: flex; gap: 20px; flex-wrap: wrap;
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
  }
  .bd-meta-val { color: var(--bright); font-weight: 500; }
  .bd-amount {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 32px; font-weight: 700; color: var(--accent2);
    margin-bottom: 16px;
  }
  .bd-status-badge {
    display: inline-block; padding: 4px 12px; border-radius: 12px;
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* Section */
  .bd-section-title {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--subtle);
    display: flex; align-items: center; gap: 10px;
    margin: 28px 0 14px;
  }
  .bd-section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* Claims list */
  .bd-claim {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 16px 20px; margin-bottom: 10px;
  }
  .bd-claim-top {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px; margin-bottom: 8px;
  }
  .bd-claim-ro {
    font-size: 13px; color: var(--accent);
    font-family: var(--mono); text-decoration: none;
  }
  .bd-claim-ro:hover { text-decoration: underline; }
  .bd-claim-scientist {
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
  }
  .bd-claim-just {
    font-size: 13px; color: var(--text); line-height: 1.5; margin-bottom: 10px;
  }
  .bd-claim-status {
    display: inline-block; padding: 3px 10px; border-radius: 10px;
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .bd-claim-actions {
    display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap;
  }
  .bd-share-input {
    width: 80px; padding: 5px 8px; border-radius: 6px;
    border: 1px solid var(--border); background: var(--surface2);
    color: var(--bright); font-family: var(--mono); font-size: 12px;
    outline: none;
  }
  .bd-share-input:focus { border-color: var(--accent); }

  /* Submit claim form */
  .bd-form {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 20px; margin-top: 16px;
  }
  .bd-form-field { margin-bottom: 14px; }
  .bd-form-label {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--subtle);
    margin-bottom: 6px; display: block;
  }
  .bd-form-input {
    width: 100%; padding: 10px 14px; border-radius: var(--r);
    border: 1px solid var(--border); background: var(--surface2);
    color: var(--bright); font-family: var(--sans); font-size: 13px;
    outline: none;
  }
  .bd-form-input:focus { border-color: var(--accent); }
  .bd-form-textarea {
    width: 100%; padding: 10px 14px; border-radius: var(--r);
    border: 1px solid var(--border); background: var(--surface2);
    color: var(--bright); font-family: var(--sans); font-size: 13px;
    outline: none; resize: vertical; min-height: 80px;
  }
  .bd-form-textarea:focus { border-color: var(--accent); }

  .bd-error {
    background: rgba(255,107,107,0.08); border: 1px solid rgba(255,107,107,0.3);
    border-radius: var(--r); padding: 10px 14px; margin-bottom: 12px;
    font-size: 12px; color: var(--danger);
  }
  .bd-success-msg {
    background: rgba(46,221,170,0.08); border: 1px solid rgba(46,221,170,0.3);
    border-radius: var(--r); padding: 10px 14px; margin-bottom: 12px;
    font-size: 12px; color: var(--accent2);
  }

  .bd-tx-link {
    font-family: var(--mono); font-size: 11px; color: var(--accent);
    text-decoration: none;
  }
  .bd-tx-link:hover { text-decoration: underline; }

  .bd-loading {
    text-align: center; padding: 80px 24px;
    font-family: var(--mono); font-size: 13px; color: var(--subtle);
  }
  @keyframes bd-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
  .bd-loading { animation: bd-pulse 1.5s ease infinite; }

  @keyframes bd-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .bd-fade { animation: bd-in 350ms ease both; }
`;

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

function timeLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86400000);
  if (d > 30) return `${Math.floor(d / 30)} months left`;
  if (d > 0) return `${d} days left`;
  const h = Math.floor(ms / 3600000);
  return `${h} hours left`;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  open:      { bg: "rgba(46,221,170,0.08)", border: "rgba(46,221,170,0.3)", color: "#2eddaa" },
  finalized: { bg: "rgba(79,140,255,0.08)", border: "rgba(79,140,255,0.3)", color: "#4f8cff" },
  cancelled: { bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.3)", color: "#ff6b6b" },
  pending:   { bg: "rgba(255,159,67,0.08)", border: "rgba(255,159,67,0.3)", color: "#ff9f43" },
  approved:  { bg: "rgba(46,221,170,0.08)", border: "rgba(46,221,170,0.3)", color: "#2eddaa" },
  rejected:  { bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.3)", color: "#ff6b6b" },
};

export default function BountyDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [bounty, setBounty] = useState<StoredBounty | null>(null);
  const [claims, setClaims] = useState<StoredClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);

  // Claim form state
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimRoId, setClaimRoId] = useState("");
  const [claimJustification, setClaimJustification] = useState("");
  const [claimState, setClaimState] = useState<"idle" | "waiting" | "mining" | "saving" | "done" | "error">("idle");
  const [claimError, setClaimError] = useState("");

  // Approve state per claim
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});
  const [actionState, setActionState] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");

  // Finalize/cancel state
  const [finalizeState, setFinalizeState] = useState<"idle" | "waiting" | "mining" | "saving" | "done" | "error">("idle");
  const [finalizeError, setFinalizeError] = useState("");

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => {
      if (d.address) setAddress(d.address);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/bounty/${id}`)
      .then(r => r.json())
      .then(d => {
        setBounty(d.bounty ?? null);
        setClaims(d.claims ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const isFunder = bounty && address &&
    bounty.funderAddress.toLowerCase() === address.toLowerCase();
  const isExpired = bounty && new Date(bounty.deadline).getTime() < Date.now();

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

  // ── Submit Claim ─────────────────────────────────────────────
  async function handleSubmitClaim() {
    if (!bounty || !BOUNTY_CONTRACT) return;
    if (!claimRoId.trim()) { setClaimError("RO ID is required."); return; }
    if (!claimJustification.trim()) { setClaimError("Justification is required."); return; }

    try {
      setClaimState("waiting"); setClaimError("");
      const client = await getWalletClient();

      setClaimState("mining");
      const txHash = await client.writeContract({
        address: BOUNTY_CONTRACT,
        abi: BOUNTY_ABI,
        functionName: "submitClaim",
        args: [BigInt(bounty.onChainId), claimRoId.trim(), claimJustification.trim()],
      });

      setClaimState("saving");
      await fetch("/api/claim/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bountyId: id,
          onChainBountyId: bounty.onChainId,
          onChainClaimIndex: claims.length,
          roId: claimRoId.trim(),
          justification: claimJustification.trim(),
          txHash,
          chainId: CHAIN_ID,
        }),
      });

      setClaimState("done");
      // Refresh
      const res = await fetch(`/api/bounty/${id}`).then(r => r.json());
      setBounty(res.bounty); setClaims(res.claims ?? []);
      setShowClaimForm(false); setClaimRoId(""); setClaimJustification("");
      setClaimState("idle");
    } catch (err: any) {
      setClaimError(err?.shortMessage ?? err?.message ?? "Failed");
      setClaimState("error");
    }
  }

  // ── Approve / Reject Claim ──────────────────────────────────
  async function handleApproveClaim(claim: StoredClaim) {
    if (!bounty || !BOUNTY_CONTRACT) return;
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
        args: [BigInt(bounty.onChainId), BigInt(claim.onChainClaimIndex), shareBps],
      });

      await fetch("/api/claim/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: claim.id, status: "approved", shareBps, txHash }),
      });

      setActionState(s => ({ ...s, [claim.id]: "done" }));
      const res = await fetch(`/api/bounty/${id}`).then(r => r.json());
      setBounty(res.bounty); setClaims(res.claims ?? []);
    } catch (err: any) {
      setActionError(err?.shortMessage ?? err?.message ?? "Failed");
      setActionState(s => ({ ...s, [claim.id]: "error" }));
    }
  }

  async function handleRejectClaim(claim: StoredClaim) {
    if (!bounty || !BOUNTY_CONTRACT) return;

    try {
      setActionState(s => ({ ...s, [claim.id]: "rejecting" }));
      setActionError("");
      const client = await getWalletClient();

      const txHash = await client.writeContract({
        address: BOUNTY_CONTRACT,
        abi: BOUNTY_ABI,
        functionName: "rejectClaim",
        args: [BigInt(bounty.onChainId), BigInt(claim.onChainClaimIndex)],
      });

      await fetch("/api/claim/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: claim.id, status: "rejected", shareBps: 0, txHash }),
      });

      setActionState(s => ({ ...s, [claim.id]: "done" }));
      const res = await fetch(`/api/bounty/${id}`).then(r => r.json());
      setBounty(res.bounty); setClaims(res.claims ?? []);
    } catch (err: any) {
      setActionError(err?.shortMessage ?? err?.message ?? "Failed");
      setActionState(s => ({ ...s, [claim.id]: "error" }));
    }
  }

  // ── Finalize / Cancel ───────────────────────────────────────
  async function handleFinalize() {
    if (!bounty || !BOUNTY_CONTRACT) return;
    try {
      setFinalizeState("waiting"); setFinalizeError("");
      const client = await getWalletClient();

      setFinalizeState("mining");
      const txHash = await client.writeContract({
        address: BOUNTY_CONTRACT,
        abi: BOUNTY_ABI,
        functionName: "finalizeBounty",
        args: [BigInt(bounty.onChainId)],
      });

      setFinalizeState("saving");
      await fetch("/api/bounty/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: id, action: "finalize", txHash }),
      });

      setFinalizeState("done");
      const res = await fetch(`/api/bounty/${id}`).then(r => r.json());
      setBounty(res.bounty); setClaims(res.claims ?? []);
    } catch (err: any) {
      setFinalizeError(err?.shortMessage ?? err?.message ?? "Failed");
      setFinalizeState("error");
    }
  }

  async function handleCancel() {
    if (!bounty || !BOUNTY_CONTRACT) return;
    try {
      setFinalizeState("waiting"); setFinalizeError("");
      const client = await getWalletClient();

      setFinalizeState("mining");
      const txHash = await client.writeContract({
        address: BOUNTY_CONTRACT,
        abi: BOUNTY_ABI,
        functionName: "cancelBounty",
        args: [BigInt(bounty.onChainId)],
      });

      setFinalizeState("saving");
      await fetch("/api/bounty/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: id, action: "cancel", txHash }),
      });

      setFinalizeState("done");
      const res = await fetch(`/api/bounty/${id}`).then(r => r.json());
      setBounty(res.bounty); setClaims(res.claims ?? []);
    } catch (err: any) {
      setFinalizeError(err?.shortMessage ?? err?.message ?? "Failed");
      setFinalizeState("error");
    }
  }

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="bd-wrap"><div className="bd-loading">Loading bounty...</div></div>
    </>
  );

  if (!bounty) return (
    <>
      <style>{css}</style>
      <div className="bd-wrap">
        <div className="bd-nav">
          <a href="/" className="bd-wordmark">carrier<em>wave</em></a>
        </div>
        <div style={{ textAlign: "center", padding: "80px 24px", fontFamily: "var(--mono)", fontSize: 13, color: "var(--subtle)" }}>
          Bounty not found. <a href="/bounties" style={{ color: "var(--accent)" }}>Browse bounties</a>
        </div>
      </div>
    </>
  );

  const approvedShares = claims
    .filter(c => c.status === "approved")
    .reduce((sum, c) => sum + c.shareBps, 0);
  const ss = STATUS_STYLES[bounty.status] ?? STATUS_STYLES.open;

  return (
    <>
      <style>{css}</style>
      <div className="bd-wrap bd-fade">
        <div className="bd-nav">
          <a href="/" className="bd-wordmark">carrier<em>wave</em></a>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/bounties" className="bd-btn">All Bounties</a>
            <a href="/dashboard" className="bd-btn">Dashboard</a>
          </div>
        </div>

        {/* Header */}
        <div className="bd-header">
          <div className="bd-tag">{bounty.diseaseTag}</div>
          <div className="bd-amount">{bounty.amount} ETH</div>
          <div className="bd-criteria">{bounty.criteria}</div>
          <div className="bd-meta">
            <span>
              <span className="bd-status-badge" style={{ background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}>
                {bounty.status}
              </span>
            </span>
            <span>Funder: <span className="bd-meta-val">{shortAddr(bounty.funderAddress)}</span></span>
            <span>Deadline: <span className="bd-meta-val">{timeLeft(bounty.deadline)}</span></span>
            <span>{claims.length} claim{claims.length !== 1 ? "s" : ""}</span>
            {bounty.txHash && (
              <a href={`${explorerBase}/tx/${bounty.txHash}`} target="_blank" rel="noopener" className="bd-tx-link">
                View tx
              </a>
            )}
          </div>
        </div>

        {/* Funder actions */}
        {isFunder && bounty.status === "open" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            {finalizeError && <div className="bd-error" style={{ width: "100%" }}>{finalizeError}</div>}
            <button
              className="bd-btn bd-btn-green"
              onClick={handleFinalize}
              disabled={finalizeState === "waiting" || finalizeState === "mining" || finalizeState === "saving" || approvedShares !== 10000}
              title={approvedShares !== 10000 ? `Approved shares: ${approvedShares}/10000 bps` : ""}
            >
              {finalizeState === "waiting" ? "Confirm..." :
               finalizeState === "mining" ? "Finalizing..." :
               finalizeState === "saving" ? "Saving..." :
               `Finalize (${approvedShares}/10000 bps)`}
            </button>
            {isExpired && (
              <button
                className="bd-btn bd-btn-danger"
                onClick={handleCancel}
                disabled={finalizeState === "waiting" || finalizeState === "mining" || finalizeState === "saving"}
              >
                Cancel & Refund
              </button>
            )}
          </div>
        )}

        {/* Claims section */}
        <div className="bd-section-title">
          Claims ({claims.length})
        </div>

        {claims.length === 0 ? (
          <div style={{ padding: "24px 0", fontFamily: "var(--mono)", fontSize: 12, color: "var(--subtle)", textAlign: "center" }}>
            No claims yet.
          </div>
        ) : (
          claims.map(claim => {
            const cs = STATUS_STYLES[claim.status] ?? STATUS_STYLES.pending;
            return (
              <div key={claim.id} className="bd-claim">
                <div className="bd-claim-top">
                  <div>
                    <a href={`/ro/${claim.roId}`} className="bd-claim-ro">
                      RO: {claim.roId.slice(0, 8)}...
                    </a>
                    <div className="bd-claim-scientist">
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
                      className="bd-claim-status"
                      style={{ background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color }}
                    >
                      {claim.status}
                    </span>
                  </div>
                </div>
                <div className="bd-claim-just">{claim.justification}</div>

                {/* Funder approve/reject controls */}
                {isFunder && bounty.status === "open" && claim.status === "pending" && (
                  <div className="bd-claim-actions">
                    {actionError && <div className="bd-error" style={{ width: "100%" }}>{actionError}</div>}
                    <input
                      className="bd-share-input"
                      type="number"
                      min="1"
                      max="10000"
                      placeholder="bps"
                      value={shareInputs[claim.id] ?? ""}
                      onChange={e => setShareInputs(s => ({ ...s, [claim.id]: e.target.value }))}
                    />
                    <button
                      className="bd-btn bd-btn-green bd-btn-sm"
                      onClick={() => handleApproveClaim(claim)}
                      disabled={actionState[claim.id] === "approving"}
                    >
                      {actionState[claim.id] === "approving" ? "..." : "Approve"}
                    </button>
                    <button
                      className="bd-btn bd-btn-danger bd-btn-sm"
                      onClick={() => handleRejectClaim(claim)}
                      disabled={actionState[claim.id] === "rejecting"}
                    >
                      {actionState[claim.id] === "rejecting" ? "..." : "Reject"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Submit claim form (for scientists) */}
        {address && bounty.status === "open" && !isFunder && (
          <>
            {!showClaimForm ? (
              <button
                className="bd-btn bd-btn-primary"
                onClick={() => setShowClaimForm(true)}
                style={{ marginTop: 16 }}
              >
                Submit a Claim
              </button>
            ) : (
              <div className="bd-form">
                {claimError && <div className="bd-error">{claimError}</div>}
                {claimState === "done" && <div className="bd-success-msg">Claim submitted.</div>}

                <div className="bd-form-field">
                  <label className="bd-form-label">Research Object ID</label>
                  <input
                    className="bd-form-input"
                    type="text"
                    placeholder="Paste your RO UUID"
                    value={claimRoId}
                    onChange={e => setClaimRoId(e.target.value)}
                    disabled={claimState !== "idle" && claimState !== "error"}
                  />
                </div>

                <div className="bd-form-field">
                  <label className="bd-form-label">Justification</label>
                  <textarea
                    className="bd-form-textarea"
                    placeholder="Explain how your RO meets the bounty criteria..."
                    value={claimJustification}
                    onChange={e => setClaimJustification(e.target.value)}
                    disabled={claimState !== "idle" && claimState !== "error"}
                  />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="bd-btn bd-btn-primary"
                    onClick={handleSubmitClaim}
                    disabled={claimState === "waiting" || claimState === "mining" || claimState === "saving"}
                    style={{ flex: 1 }}
                  >
                    {claimState === "waiting" ? "Confirm in wallet..." :
                     claimState === "mining" ? "Submitting on-chain..." :
                     claimState === "saving" ? "Saving..." :
                     "Submit Claim On-chain"}
                  </button>
                  <button className="bd-btn" onClick={() => setShowClaimForm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}

        {!address && bounty.status === "open" && (
          <div style={{ marginTop: 20, textAlign: "center", fontFamily: "var(--mono)", fontSize: 12, color: "var(--subtle)" }}>
            <a href="/" style={{ color: "var(--accent)" }}>Sign in</a> to submit a claim
          </div>
        )}
      </div>
    </>
  );
}
