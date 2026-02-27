"use client";

// =================================================================
// app/bounties/create/page.tsx — Create Bounty Form (Funders)
//
// Form: disease tag, criteria, deadline, ETH amount
// Calls CWBountyPool.createBounty() on-chain, then saves to KV.
// =================================================================

// @ts-ignore
import { createWalletClient, custom, parseAbi, parseEther } from "viem";
// @ts-ignore
import { mainnet, sepolia } from "viem/chains";
import { useState, useEffect } from "react";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "1");
const viemChain = CHAIN_ID === 11155111 ? sepolia : mainnet;
const hexChainId = `0x${CHAIN_ID.toString(16)}` as const;

const BOUNTY_CONTRACT = process.env.NEXT_PUBLIC_BOUNTY_CONTRACT as `0x${string}` | undefined;

const BOUNTY_ABI = parseAbi([
  "function createBounty(string calldata diseaseTag, string calldata criteria, uint256 deadline) external payable returns (uint256)",
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

  .bc-wrap {
    max-width: 600px; margin: 0 auto;
    padding: 36px 24px 100px; position: relative; z-index: 1;
  }

  .bc-nav {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 40px; padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .bc-wordmark {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 22px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.3px;
  }
  .bc-wordmark em { color: var(--accent); font-style: italic; }

  .bc-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: var(--r);
    font-size: 13px; font-weight: 500; font-family: var(--sans);
    cursor: pointer; transition: all var(--t);
    border: 1px solid var(--border); background: transparent;
    color: var(--text); text-decoration: none;
  }
  .bc-btn:hover { border-color: var(--subtle); color: var(--bright); }
  .bc-btn-primary {
    background: var(--accent); border-color: var(--accent); color: white;
    padding: 12px 28px; font-size: 14px; width: 100%;
    justify-content: center;
  }
  .bc-btn-primary:hover { background: #6fa3ff; border-color: #6fa3ff; }
  .bc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .bc-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 28px; font-weight: 700; color: var(--bright);
    letter-spacing: -0.5px; margin-bottom: 8px;
  }
  .bc-subtitle {
    color: var(--subtle); font-size: 14px; margin-bottom: 32px;
    line-height: 1.6;
  }

  .bc-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 24px; margin-bottom: 24px;
  }

  .bc-field { margin-bottom: 24px; }
  .bc-label {
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--subtle);
    margin-bottom: 8px; display: block;
  }
  .bc-input {
    width: 100%; padding: 12px 16px; border-radius: var(--r);
    border: 1px solid var(--border); background: var(--surface2);
    color: var(--bright); font-family: var(--sans); font-size: 14px;
    outline: none; transition: border-color var(--t);
  }
  .bc-input:focus { border-color: var(--accent); }
  .bc-textarea {
    width: 100%; padding: 12px 16px; border-radius: var(--r);
    border: 1px solid var(--border); background: var(--surface2);
    color: var(--bright); font-family: var(--sans); font-size: 14px;
    outline: none; transition: border-color var(--t);
    resize: vertical; min-height: 100px;
  }
  .bc-textarea:focus { border-color: var(--accent); }

  .bc-hint {
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
    margin-top: 6px;
  }

  .bc-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  }
  @media (max-width: 500px) { .bc-row { grid-template-columns: 1fr; } }

  .bc-error {
    background: rgba(255,107,107,0.08); border: 1px solid rgba(255,107,107,0.3);
    border-radius: var(--r); padding: 12px 16px; margin-bottom: 16px;
    font-size: 13px; color: var(--danger);
  }

  .bc-success {
    background: rgba(46,221,170,0.08); border: 1px solid rgba(46,221,170,0.3);
    border-radius: var(--r); padding: 16px 20px; text-align: center;
    font-size: 14px; color: var(--accent2);
  }
  .bc-success a { color: var(--accent); text-decoration: none; }
  .bc-success a:hover { text-decoration: underline; }

  .bc-gate {
    text-align: center; padding: 80px 24px;
  }
  .bc-gate-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 22px; font-weight: 700; color: var(--bright);
    margin-bottom: 10px;
  }
  .bc-gate-sub { font-size: 14px; color: var(--subtle); margin-bottom: 24px; }

  @keyframes bc-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .bc-fade { animation: bc-in 350ms ease both; }
`;

export default function CreateBountyPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [diseaseTag, setDiseaseTag] = useState("");
  const [criteria, setCriteria] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("90");
  const [ethAmount, setEthAmount] = useState("");

  const [txState, setTxState] = useState<"idle" | "waiting" | "mining" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState("");

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => {
      if (d.address) setAddress(d.address);
    }).finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!diseaseTag.trim()) { setError("Disease tag is required."); return; }
    if (!criteria.trim()) { setError("Criteria is required."); return; }
    if (!ethAmount || parseFloat(ethAmount) <= 0) { setError("ETH amount must be positive."); return; }
    if (!BOUNTY_CONTRACT) { setError("Bounty contract not configured."); return; }

    const ethereum = (window as any).ethereum;
    if (!ethereum) { setError("No wallet detected."); return; }

    try {
      setTxState("waiting"); setError("");

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

      const client = createWalletClient({ account, chain: viemChain, transport: custom(ethereum) });
      const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400);

      setTxState("mining");
      const txHash = await client.writeContract({
        address: BOUNTY_CONTRACT,
        abi: BOUNTY_ABI,
        functionName: "createBounty",
        args: [diseaseTag.trim(), criteria.trim(), deadlineTimestamp],
        value: parseEther(ethAmount),
      });

      // We don't have the on-chain bountyId from the tx receipt easily in viem writeContract,
      // so we use a placeholder. In production, parse the receipt logs.
      setTxState("saving");
      const res = await fetch("/api/bounty/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onChainId: 0, // Will be updated when we parse events
          amount: ethAmount,
          diseaseTag: diseaseTag.trim(),
          criteria: criteria.trim(),
          deadline: new Date(Number(deadlineTimestamp) * 1000).toISOString(),
          txHash,
          chainId: CHAIN_ID,
        }),
      });
      const data = await res.json();
      setCreatedId(data.bounty?.id ?? "");

      setTxState("done");
    } catch (err: any) {
      setError(err?.shortMessage ?? err?.message ?? "Transaction failed");
      setTxState("error");
    }
  }

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="bc-wrap" style={{ textAlign: "center", paddingTop: 100, fontFamily: "var(--mono)", fontSize: 13, color: "var(--subtle)" }}>
        Loading...
      </div>
    </>
  );

  if (!address) return (
    <>
      <style>{css}</style>
      <div className="bc-wrap">
        <div className="bc-nav">
          <a href="/" className="bc-wordmark">carrier<em>wave</em></a>
        </div>
        <div className="bc-gate">
          <div className="bc-gate-title">Sign in to create a bounty</div>
          <div className="bc-gate-sub">Connect your wallet on the homepage first.</div>
          <a href="/" className="bc-btn bc-btn-primary" style={{ width: "auto", display: "inline-flex" }}>Sign in</a>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="bc-wrap bc-fade">
        <div className="bc-nav">
          <a href="/" className="bc-wordmark">carrier<em>wave</em></a>
          <a href="/bounties" className="bc-btn">Bounties</a>
        </div>

        <div className="bc-title">Create Bounty</div>
        <div className="bc-subtitle">
          Lock ETH for a specific research question. Scientists submit claims
          with their research objects, and you decide who earns the payout.
        </div>

        {txState === "done" ? (
          <div className="bc-success">
            Bounty created successfully.{" "}
            {createdId ? <a href={`/bounties/${createdId}`}>View bounty</a> : <a href="/bounties">Browse bounties</a>}
          </div>
        ) : (
          <div className="bc-card">
            {error && <div className="bc-error">{error}</div>}

            <div className="bc-field">
              <label className="bc-label">Disease / Research Area</label>
              <input
                className="bc-input"
                type="text"
                placeholder="e.g. ALS, Duchenne Muscular Dystrophy"
                value={diseaseTag}
                onChange={e => setDiseaseTag(e.target.value)}
                disabled={txState !== "idle" && txState !== "error"}
              />
            </div>

            <div className="bc-field">
              <label className="bc-label">Criteria</label>
              <textarea
                className="bc-textarea"
                placeholder="Describe the research question or result criteria that qualifies for this bounty..."
                value={criteria}
                onChange={e => setCriteria(e.target.value)}
                disabled={txState !== "idle" && txState !== "error"}
              />
              <div className="bc-hint">Be specific about what constitutes a qualifying result.</div>
            </div>

            <div className="bc-row">
              <div className="bc-field">
                <label className="bc-label">Deadline (days from now)</label>
                <input
                  className="bc-input"
                  type="number"
                  min="1"
                  max="730"
                  value={deadlineDays}
                  onChange={e => setDeadlineDays(e.target.value)}
                  disabled={txState !== "idle" && txState !== "error"}
                />
              </div>

              <div className="bc-field">
                <label className="bc-label">ETH Amount</label>
                <input
                  className="bc-input"
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="0.1"
                  value={ethAmount}
                  onChange={e => setEthAmount(e.target.value)}
                  disabled={txState !== "idle" && txState !== "error"}
                />
              </div>
            </div>

            <button
              className="bc-btn bc-btn-primary"
              onClick={handleCreate}
              disabled={txState === "waiting" || txState === "mining" || txState === "saving"}
            >
              {txState === "waiting" ? "Confirm in wallet..." :
               txState === "mining" ? "Creating on-chain..." :
               txState === "saving" ? "Saving..." :
               `Lock ${ethAmount || "0"} ETH & Create Bounty`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
