"use client";
// @ts-ignore
import { createWalletClient, createPublicClient, custom, http, parseAbi, formatEther } from "viem";
// @ts-ignore
import { mainnet, sepolia } from "viem/chains";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "1");
const viemChain = CHAIN_ID === 11155111 ? sepolia : mainnet;
const hexChainId = `0x${CHAIN_ID.toString(16)}` as const;
const explorerBase = CHAIN_ID === 11155111 ? "https://sepolia.etherscan.io" : "https://etherscan.io";

// =================================================================
// app/ro/[id]/page.tsx — Research Object Detail Page
//
// Fetches full RO from GET /api/ro/submit?id=<uuid>
// Shows: all metadata, claim, figure, data file, reagents,
//        relationships, content hash, mint button (placeholder)
// =================================================================

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────

type ROType = "new_finding" | "negative_result" | "replication_successful"
  | "replication_unsuccessful" | "methodology" | "materials_reagents" | "data_update";
type ConfidenceLevel = 1 | 2 | 3;

interface Reagent { name: string; type: string; identifier: string; source: string; }
interface Relationship { type: string; targetId?: string; targetDOI?: string; note?: string; }

interface StoredRO {
  id: string;
  walletAddress: string;
  contentHash: string;
  timestamp: string;
  roType: ROType;
  dataType: string;
  species: string;
  experimentalSystem: string;
  orcid?: string;
  title: string;
  abstract: string;
  claim: string;
  description: string;
  methods: string;
  reagents: Reagent[];
  confidence: ConfidenceLevel;
  replicateCount: number;
  statisticalMethod: string;
  relationships: Relationship[];
  hasCommercialRelevance: boolean;
  diseaseAreaTags: string[];
  ipStatus: string;
  license: string;
  figureUrl?: string;
  dataFileUrl?: string;
  txHash?: string;
  chainId?: number;
  tokenId?: string;
}

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

const CONF_COLORS: Record<ConfidenceLevel, string> = { 1: "#ff9f43", 2: "#4f8cff", 3: "#2eddaa" };
const CONF_LABELS: Record<ConfidenceLevel, string> = { 1: "Preliminary", 2: "Replicated", 3: "Validated" };

const REL_COLORS: Record<string, string> = {
  replicates: "#2eddaa", contradicts: "#ff6b6b", extends: "#4f8cff",
  derives_from: "#ff9f43", uses_method_from: "#a78bfa",
};
const REL_LABELS: Record<string, string> = {
  replicates: "replicates", contradicts: "contradicts", extends: "extends",
  derives_from: "derives from", uses_method_from: "uses method from",
};
const REL_REVERSE: Record<string, string> = {
  replicates: "replicated by", contradicts: "contradicted by", extends: "extended by",
  derives_from: "derived by", uses_method_from: "method used by",
};

// ── Helpers ───────────────────────────────────────────────────

function fmt(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
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
    font-family: var(--sans); font-size: 15px; line-height: 1.65;
    min-height: 100vh;
  }

  body::before {
    content: ''; position: fixed; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(79,140,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(79,140,255,0.025) 1px, transparent 1px);
    background-size: 56px 56px;
  }

  .ro-wrap {
    max-width: 900px; margin: 0 auto;
    padding: 36px 24px 100px; position: relative; z-index: 1;
  }

  /* Nav */
  .ro-nav {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 40px; padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .ro-wordmark {
    font-family: Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.3px;
  }
  .ro-wordmark em { color: var(--accent); font-style: italic; }
  .ro-back {
    font-family: var(--mono); font-size: 12px; color: var(--subtle);
    text-decoration: none; transition: color var(--t);
    display: flex; align-items: center; gap: 6px;
  }
  .ro-back:hover { color: var(--accent); }

  /* Header */
  .ro-header { margin-bottom: 32px; }
  .ro-eyebrow {
    display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
  }
  .ro-badge {
    padding: 4px 12px; border-radius: 12px; font-family: var(--mono);
    font-size: 11px; border: 1px solid; font-weight: 500;
  }
  .ro-minted-badge {
    padding: 4px 12px; border-radius: 12px; font-family: var(--mono); font-size: 11px;
    border: 1px solid rgba(46,221,170,.3); background: rgba(46,221,170,.08); color: var(--accent2);
  }
  .ro-timestamp {
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
  }

  .ro-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: clamp(22px, 4vw, 32px); font-weight: 700;
    color: var(--bright); line-height: 1.2; letter-spacing: -0.8px;
    margin-bottom: 20px;
  }

  .ro-claim {
    font-family: var(--mono); font-size: 13px; color: var(--accent2);
    background: rgba(46,221,170,0.06); border: 1px solid rgba(46,221,170,0.18);
    border-radius: 8px; padding: 14px 16px; line-height: 1.65;
  }
  .ro-claim-label {
    font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--accent2); opacity: 0.7; display: block; margin-bottom: 6px;
  }

  /* Layout */
  .ro-layout {
    display: grid; grid-template-columns: 1fr 280px;
    gap: 24px; align-items: start; margin-top: 32px;
  }
  @media (max-width: 750px) { .ro-layout { grid-template-columns: 1fr; } }

  /* Sections */
  .ro-section { margin-bottom: 24px; }
  .ro-section-title {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--subtle);
    display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
  }
  .ro-section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  .ro-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 20px;
  }

  .ro-text { font-size: 14px; color: var(--text); line-height: 1.75; }

  /* Meta grid */
  .ro-meta-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px;
    background: var(--border); border-radius: var(--r); overflow: hidden;
    border: 1px solid var(--border);
  }
  .ro-meta-cell {
    background: var(--surface); padding: 14px 16px;
    transition: background var(--t);
  }
  .ro-meta-cell:hover { background: var(--surface2); }
  .ro-meta-key {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--subtle); margin-bottom: 5px;
  }
  .ro-meta-val {
    font-size: 13px; color: var(--bright); font-weight: 500;
  }
  .ro-meta-val.italic { font-style: italic; color: var(--text); }

  /* Confidence */
  .ro-conf {
    display: flex; align-items: center; gap: 10px;
  }
  .ro-conf-dots { display: flex; gap: 5px; }
  .ro-conf-dot { width: 10px; height: 10px; border-radius: 50%; }

  /* Reagents */
  .ro-reagent {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px 16px; padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .ro-reagent:last-child { border-bottom: none; padding-bottom: 0; }
  .ro-reagent-name {
    font-size: 13px; font-weight: 500; color: var(--bright);
    grid-column: 1 / -1;
  }
  .ro-reagent-field { font-family: var(--mono); font-size: 11px; color: var(--subtle); }
  .ro-reagent-field span { color: var(--text); }

  /* Figure */
  .ro-figure {
    width: 100%; border-radius: var(--r); overflow: hidden;
    border: 1px solid var(--border); background: var(--surface);
  }
  .ro-figure img {
    width: 100%; display: block; object-fit: contain;
    max-height: 500px; background: #0a0d14;
  }
  .ro-figure-caption {
    padding: 10px 14px; font-family: var(--mono); font-size: 10px;
    color: var(--subtle); border-top: 1px solid var(--border);
    display: flex; justify-content: space-between;
  }

  /* Data file */
  .ro-datafile {
    display: flex; align-items: center; gap: 12px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 14px 16px;
    text-decoration: none; transition: border-color var(--t);
  }
  .ro-datafile:hover { border-color: var(--accent); }
  .ro-datafile-icon { font-size: 22px; }
  .ro-datafile-name { font-family: var(--mono); font-size: 12px; color: var(--accent); }
  .ro-datafile-label { font-size: 11px; color: var(--subtle); margin-top: 2px; }

  /* Sidebar */
  .ro-sidebar { display: flex; flex-direction: column; gap: 16px; }

  /* Hash card */
  .ro-hash-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 18px;
  }
  .ro-hash-label {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--subtle); margin-bottom: 10px;
  }
  .ro-hash {
    font-family: var(--mono); font-size: 10px; color: var(--text);
    word-break: break-all; line-height: 1.7;
    background: var(--surface2); border-radius: 6px; padding: 10px;
    border: 1px solid var(--border);
  }
  .ro-hash-copy {
    margin-top: 10px; width: 100%;
    background: transparent; border: 1px solid var(--border);
    border-radius: 6px; color: var(--subtle); font-family: var(--mono);
    font-size: 11px; padding: 7px; cursor: pointer; transition: all var(--t);
  }
  .ro-hash-copy:hover { border-color: var(--accent); color: var(--accent); }

  /* Wallet card */
  .ro-wallet-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 18px;
  }
  .ro-wallet-label {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--subtle); margin-bottom: 10px;
  }
  .ro-wallet-addr {
    font-family: var(--mono); font-size: 12px; color: var(--bright);
    word-break: break-all;
  }

  /* Mint card */
  .ro-mint-card {
    background: linear-gradient(135deg, rgba(46,221,170,0.06) 0%, rgba(79,140,255,0.04) 100%);
    border: 1px solid rgba(46,221,170,0.2);
    border-radius: var(--r); padding: 20px;
  }
  .ro-mint-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 15px; font-weight: 700; color: var(--bright);
    margin-bottom: 8px; letter-spacing: -0.3px;
  }
  .ro-mint-desc {
    font-size: 12px; color: var(--text); line-height: 1.65; margin-bottom: 16px;
  }
  .ro-mint-btn {
    width: 100%; padding: 12px;
    background: var(--accent2); color: #081a12;
    border: none; border-radius: 8px;
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 14px; font-weight: 700; cursor: pointer;
    transition: all var(--t); letter-spacing: -0.2px;
  }
  .ro-mint-btn:hover {
    background: #3ef5c0; transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(46,221,170,0.25);
  }
  .ro-mint-btn:disabled {
    opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none;
  }
  .ro-minted-info {
    font-family: var(--mono); font-size: 11px; color: var(--accent2);
    line-height: 1.7;
  }
  .ro-minted-info a { color: var(--accent2); }

  /* Tags */
  .ro-tags { display: flex; flex-wrap: wrap; gap: 7px; }
  .ro-tag {
    padding: 4px 12px; border-radius: 12px; font-family: var(--mono); font-size: 11px;
    background: rgba(79,140,255,0.1); border: 1px solid rgba(79,140,255,0.2); color: var(--accent);
  }

  /* Relationships */
  .ro-rel {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 0; border-bottom: 1px solid var(--border);
  }
  .ro-rel:last-child { border-bottom: none; }
  .ro-rel-badge {
    padding: 3px 10px; border-radius: 10px; font-family: var(--mono);
    font-size: 10px; border: 1px solid; font-weight: 500; white-space: nowrap;
    flex-shrink: 0;
  }
  .ro-rel-link {
    font-size: 13px; color: var(--accent); text-decoration: none;
    transition: color var(--t); overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ro-rel-link:hover { color: var(--bright); text-decoration: underline; }
  .ro-rel-note {
    font-family: var(--mono); font-size: 10px; color: var(--subtle);
    margin-left: auto; flex-shrink: 0;
  }
  .ro-rel-subhead {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--subtle); margin-bottom: 8px;
    margin-top: 12px;
  }
  .ro-rel-subhead:first-child { margin-top: 0; }

  /* Loading / error */
  .ro-loading {
    text-align: center; padding: 80px 24px;
    font-family: var(--mono); font-size: 13px; color: var(--subtle);
  }
  @keyframes ro-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
  .ro-loading { animation: ro-pulse 1.5s ease infinite; }

  .ro-error {
    text-align: center; padding: 80px 24px;
    font-family: var(--mono); font-size: 13px; color: var(--warn);
  }

  @keyframes ro-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .ro-fade { animation: ro-in 400ms ease both; }
`;

// ── Component ─────────────────────────────────────────────────

export default function RODetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [ro, setRO]         = useState<StoredRO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [copied, setCopied] = useState(false);
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const [mintState, setMintState]   = useState<"idle"|"waiting"|"mining"|"done"|"error">("idle");
  const [mintError, setMintError]   = useState("");
  const [mintFee, setMintFee]       = useState<bigint | null>(null);
  const [incoming, setIncoming]     = useState<{ sourceId: string; sourceTitle: string; type: string }[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/ro/submit?id=${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.ro) setRO(d.ro);
        else setError(d.error ?? "Research object not found");
      })
      .catch(() => setError("Failed to load research object"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => {
      if (d.address) setMyAddress(d.address);
    });
  }, []);

  useEffect(() => {
    const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
    if (!CONTRACT) return;
    const publicClient = createPublicClient({ chain: viemChain, transport: http() });
    const feeAbi = parseAbi(["function mintFee() view returns (uint256)"]);
    publicClient.readContract({ address: CONTRACT, abi: feeAbi, functionName: "mintFee" })
      .then((fee: bigint) => setMintFee(fee))
      .catch(() => {}); // v1 contract won't have mintFee — leave null
  }, []);

  // Fetch incoming relationships from graph endpoint
  useEffect(() => {
    if (!id) return;
    fetch("/api/ro/graph")
      .then(r => r.json())
      .then(data => {
        if (!data.nodes || !data.edges) return;
        const nodeMap = new Map<string, { title: string }>();
        for (const n of data.nodes) nodeMap.set(n.id, { title: n.title });
        const inc = data.edges
          .filter((e: any) => e.target === id)
          .map((e: any) => ({
            sourceId: e.source,
            sourceTitle: nodeMap.get(e.source)?.title ?? e.source,
            type: e.type,
          }));
        setIncoming(inc);
      })
      .catch(() => {});
  }, [id]);

  async function handleMint() {
    if (!ro) return;
    const ethereum = (window as any).ethereum;
    if (!ethereum) { setMintError("No wallet detected."); setMintState("error"); return; }
    const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
    const ABI = parseAbi([
      "function mintRO(string calldata roId, string calldata contentHash) external payable returns (uint256)",
      "function mintFee() view returns (uint256)",
    ]);
    try {
      setMintState("waiting"); setMintError("");
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const account = accounts[0] as `0x${string}`;
      try {
        await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] });
      } catch (e: any) {
        if (e.code === 4902) await ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: hexChainId, chainName: viemChain.name, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: [viemChain.rpcUrls.default.http[0]], blockExplorerUrls: [explorerBase] }] });
      }
      // Read mint fee from contract
      const publicClient = createPublicClient({ chain: viemChain, transport: custom(ethereum) });
      const fee = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: "mintFee" }) as bigint;
      const client = createWalletClient({ account, chain: viemChain, transport: custom(ethereum) });
      setMintState("mining");
      const txHash = await client.writeContract({ address: CONTRACT, abi: ABI, functionName: "mintRO", args: [ro.id, ro.contentHash], value: fee });
      await fetch("/api/ro/mint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roId: ro.id, txHash, chainId: CHAIN_ID }) });
      setMintState("done");
      const updated = await fetch(`/api/ro/submit?id=${ro.id}`).then(r => r.json());
      if (updated.ro) setRO(updated.ro);
    } catch (err: any) {
      setMintError(err?.shortMessage ?? err?.message ?? "Mint failed");
      setMintState("error");
    }
  }

  function copyHash() {
    if (!ro) return;
    navigator.clipboard.writeText(ro.contentHash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isOwner = ro && myAddress &&
    ro.walletAddress.toLowerCase() === myAddress.toLowerCase();

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="ro-wrap"><div className="ro-loading">Loading research object…</div></div>
    </>
  );

  if (error || !ro) return (
    <>
      <style>{css}</style>
      <div className="ro-wrap">
        <div className="ro-error">{error || "Research object not found"}</div>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/explore" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>
            ← Back to feed
          </a>
        </div>
      </div>
    </>
  );

  const tc = TYPE_COLORS[ro.roType];
  const cc = CONF_COLORS[ro.confidence];

  return (
    <>
      <style>{css}</style>
      <div className="ro-wrap ro-fade">

        {/* Nav */}
        <div className="ro-nav">
          <a href="/" className="ro-wordmark">carrier<em>wave</em></a>
          <a href="/explore" className="ro-back">← Back to feed</a>
        </div>

        {/* Header */}
        <div className="ro-header">
          <div className="ro-eyebrow">
            <span className="ro-badge" style={{ color: tc, borderColor: `${tc}44`, background: `${tc}12` }}>
              {TYPE_LABELS[ro.roType]}
            </span>
            {ro.txHash && <span className="ro-minted-badge">⬡ on-chain</span>}
            {isOwner && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent2)", background: "rgba(46,221,170,0.08)", border: "1px solid rgba(46,221,170,0.2)", borderRadius: 8, padding: "3px 10px" }}>
                your RO
              </span>
            )}
            <span className="ro-timestamp">{fmtDate(ro.timestamp)}</span>
          </div>

          <div className="ro-title">{ro.title}</div>

          <div className="ro-claim">
            <span className="ro-claim-label">Primary claim</span>
            {ro.claim}
          </div>
        </div>

        {/* Figure */}
        {ro.figureUrl && (
          <div className="ro-section">
            <div className="ro-section-title">Figure</div>
            <div className="ro-figure">
              <img src={ro.figureUrl} alt={ro.title} />
              <div className="ro-figure-caption">
                <span>{ro.title}</span>
                <a href={ro.figureUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "none" }}>
                  Open full size ↗
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="ro-layout">

          {/* ── Main content ── */}
          <div>

            {/* Abstract */}
            <div className="ro-section">
              <div className="ro-section-title">Abstract</div>
              <div className="ro-card">
                <div className="ro-text">{ro.abstract}</div>
              </div>
            </div>

            {/* Description */}
            <div className="ro-section">
              <div className="ro-section-title">Full description</div>
              <div className="ro-card">
                <div className="ro-text">{ro.description}</div>
              </div>
            </div>

            {/* Methods */}
            <div className="ro-section">
              <div className="ro-section-title">Methods</div>
              <div className="ro-card">
                <div className="ro-text" style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.8 }}>
                  {ro.methods}
                </div>
              </div>
            </div>

            {/* Experimental details */}
            <div className="ro-section">
              <div className="ro-section-title">Experimental details</div>
              <div className="ro-meta-grid">
                <div className="ro-meta-cell">
                  <div className="ro-meta-key">Species</div>
                  <div className="ro-meta-val italic">{ro.species}</div>
                </div>
                <div className="ro-meta-cell">
                  <div className="ro-meta-key">System</div>
                  <div className="ro-meta-val">{fmt(ro.experimentalSystem)}</div>
                </div>
                <div className="ro-meta-cell">
                  <div className="ro-meta-key">Data type</div>
                  <div className="ro-meta-val">{fmt(ro.dataType)}</div>
                </div>
                <div className="ro-meta-cell">
                  <div className="ro-meta-key">Statistical method</div>
                  <div className="ro-meta-val">{fmt(ro.statisticalMethod)}</div>
                </div>
                <div className="ro-meta-cell">
                  <div className="ro-meta-key">Replicates</div>
                  <div className="ro-meta-val">n = {ro.replicateCount}</div>
                </div>
                <div className="ro-meta-cell">
                  <div className="ro-meta-key">Confidence</div>
                  <div className="ro-meta-val">
                    <div className="ro-conf">
                      <div className="ro-conf-dots">
                        {[1,2,3].map(i => (
                          <div key={i} className="ro-conf-dot"
                            style={{ background: i <= ro.confidence ? cc : "var(--muted)" }} />
                        ))}
                      </div>
                      <span style={{ color: cc, fontSize: 13 }}>{CONF_LABELS[ro.confidence]}</span>
                    </div>
                  </div>
                </div>
                {ro.orcid && (
                  <div className="ro-meta-cell" style={{ gridColumn: "1 / -1" }}>
                    <div className="ro-meta-key">ORCID</div>
                    <div className="ro-meta-val">
                      <a href={`https://orcid.org/${ro.orcid}`} target="_blank" rel="noopener noreferrer"
                        style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 12 }}>
                        {ro.orcid} ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reagents */}
            {ro.reagents?.length > 0 && (
              <div className="ro-section">
                <div className="ro-section-title">Reagents</div>
                <div className="ro-card">
                  {ro.reagents.map((r, i) => (
                    <div key={i} className="ro-reagent">
                      <div className="ro-reagent-name">{r.name}</div>
                      <div className="ro-reagent-field">
                        Type: <span>{fmt(r.type)}</span>
                      </div>
                      <div className="ro-reagent-field">
                        ID: <span>{r.identifier || "—"}</span>
                      </div>
                      <div className="ro-reagent-field">
                        Source: <span>{r.source || "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data file */}
            {ro.dataFileUrl && (
              <div className="ro-section">
                <div className="ro-section-title">Data file</div>
                <a href={ro.dataFileUrl} target="_blank" rel="noopener noreferrer" className="ro-datafile">
                  <div className="ro-datafile-icon">📦</div>
                  <div>
                    <div className="ro-datafile-name">Download data file ↗</div>
                    <div className="ro-datafile-label">Raw data attached to this research object</div>
                  </div>
                </a>
              </div>
            )}

            {/* Disease tags */}
            {ro.diseaseAreaTags?.length > 0 && (
              <div className="ro-section">
                <div className="ro-section-title">Disease areas</div>
                <div className="ro-tags">
                  {ro.diseaseAreaTags.map(t => (
                    <span key={t} className="ro-tag">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Relationships */}
            {(ro.relationships?.length > 0 || incoming.length > 0) && (
              <div className="ro-section">
                <div className="ro-section-title">Relationships</div>
                <div className="ro-card">
                  {ro.relationships?.length > 0 && (
                    <>
                      {incoming.length > 0 && <div className="ro-rel-subhead">Outgoing</div>}
                      {ro.relationships.map((rel, i) => {
                        const rc = REL_COLORS[rel.type] ?? "#4a5580";
                        return (
                          <div key={`out-${i}`} className="ro-rel">
                            <span className="ro-rel-badge" style={{ color: rc, borderColor: `${rc}44`, background: `${rc}12` }}>
                              {REL_LABELS[rel.type] ?? rel.type}
                            </span>
                            {rel.targetId ? (
                              <a href={`/ro/${rel.targetId}`} className="ro-rel-link">{rel.targetId.slice(0, 8)}...</a>
                            ) : rel.targetDOI ? (
                              <a href={`https://doi.org/${rel.targetDOI}`} target="_blank" rel="noopener noreferrer" className="ro-rel-link">{rel.targetDOI} ↗</a>
                            ) : null}
                            {rel.note && <span className="ro-rel-note">{rel.note}</span>}
                          </div>
                        );
                      })}
                    </>
                  )}
                  {incoming.length > 0 && (
                    <>
                      {ro.relationships?.length > 0 && <div className="ro-rel-subhead">Incoming</div>}
                      {incoming.map((inc, i) => {
                        const rc = REL_COLORS[inc.type] ?? "#4a5580";
                        return (
                          <div key={`in-${i}`} className="ro-rel">
                            <span className="ro-rel-badge" style={{ color: rc, borderColor: `${rc}44`, background: `${rc}12` }}>
                              {REL_REVERSE[inc.type] ?? inc.type}
                            </span>
                            <a href={`/ro/${inc.sourceId}`} className="ro-rel-link">{inc.sourceTitle}</a>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Rights */}
            <div className="ro-section">
              <div className="ro-section-title">Rights & licensing</div>
              <div className="ro-meta-grid">
                <div className="ro-meta-cell">
                  <div className="ro-meta-key">License</div>
                  <div className="ro-meta-val">{ro.license}</div>
                </div>
                <div className="ro-meta-cell">
                  <div className="ro-meta-key">IP status</div>
                  <div className="ro-meta-val">{fmt(ro.ipStatus)}</div>
                </div>
                <div className="ro-meta-cell" style={{ gridColumn: "1 / -1" }}>
                  <div className="ro-meta-key">Commercial relevance</div>
                  <div className="ro-meta-val" style={{ color: ro.hasCommercialRelevance ? "var(--accent2)" : "var(--subtle)" }}>
                    {ro.hasCommercialRelevance ? "Yes — flagged for commercial landscape reports" : "No"}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── Sidebar ── */}
          <div className="ro-sidebar">

            {/* Mint card */}
            <div className="ro-mint-card">
              <div className="ro-mint-title">
                {ro.txHash ? "⬡ On-chain" : "Mint this RO"}
              </div>
              {ro.txHash ? (
                <div className="ro-minted-info">
                  <div style={{ marginBottom: 6 }}>Token ID: {ro.tokenId ?? "—"}</div>
                  <div style={{ marginBottom: 6 }}>Chain: {ro.chainId ?? "—"}</div>
                  <div style={{ wordBreak: "break-all" }}>
                    Tx: <a href={`${explorerBase}/tx/${ro.txHash}`} target="_blank" rel="noopener noreferrer">
                      {ro.txHash.slice(0, 10)}…{ro.txHash.slice(-6)} ↗
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <div className="ro-mint-desc">
                    Minting creates an on-chain record of this RO — permanent, immutable, and publicly verifiable. The content hash is stored on-chain.
                  </div>
                  {mintFee !== null && (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent2)", marginBottom: 12 }}>
                      Mint fee: {formatEther(mintFee)} ETH
                    </div>
                  )}
                  <button
                    className="ro-mint-btn"
                    disabled={!isOwner || mintState === "waiting" || mintState === "mining"}
                    onClick={handleMint}
                    title={isOwner ? "Mint this RO on-chain" : "Only the submitting wallet can mint"}
                  >
                    {mintState === "waiting" || mintState === "mining"
                      ? "⏳ Minting…"
                      : `⬡ ${isOwner
                          ? `Mint on-chain${mintFee !== null ? ` (${formatEther(mintFee)} ETH)` : ""}`
                          : "Sign in to mint"}`}
                  </button>
                  {!isOwner && (
                    <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--subtle)", textAlign: "center" }}>
                      Only the submitting wallet can mint
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Content hash */}
            <div className="ro-hash-card">
              <div className="ro-hash-label">Content hash · SHA-256</div>
              <div className="ro-hash">{ro.contentHash}</div>
              <button className="ro-hash-copy" onClick={copyHash}>
                {copied ? "✓ Copied" : "Copy hash"}
              </button>
            </div>

            {/* Submitter wallet */}
            <div className="ro-wallet-card">
              <div className="ro-wallet-label">Submitted by</div>
              <div className="ro-wallet-addr">{ro.walletAddress}</div>
              {ro.orcid && (
                <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11, color: "var(--subtle)" }}>
                  ORCID: <a href={`https://orcid.org/${ro.orcid}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{ro.orcid}</a>
                </div>
              )}
            </div>

            {/* ID */}
            <div className="ro-hash-card">
              <div className="ro-hash-label">RO identifier</div>
              <div className="ro-hash" style={{ fontSize: 11 }}>{ro.id}</div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
