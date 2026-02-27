"use client";

// =================================================================
// app/register/page.tsx — Scientist Registration
//
// Simple form: institution name + split % slider
// Calls CWBountyPool.registerScientist() on-chain, then saves to KV.
// =================================================================

// @ts-ignore
import { createWalletClient, custom, parseAbi } from "viem";
// @ts-ignore
import { mainnet, sepolia } from "viem/chains";
import { useState, useEffect } from "react";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "1");
const viemChain = CHAIN_ID === 11155111 ? sepolia : mainnet;
const hexChainId = `0x${CHAIN_ID.toString(16)}` as const;

const BOUNTY_CONTRACT = process.env.NEXT_PUBLIC_BOUNTY_CONTRACT as `0x${string}` | undefined;

const BOUNTY_ABI = parseAbi([
  "function registerScientist(string calldata institutionName, uint16 institutionSplitBps) external",
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

  .reg-wrap {
    max-width: 560px; margin: 0 auto;
    padding: 36px 24px 100px; position: relative; z-index: 1;
  }

  .reg-nav {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 40px; padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .reg-wordmark {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 22px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.3px;
  }
  .reg-wordmark em { color: var(--accent); font-style: italic; }

  .reg-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: var(--r);
    font-size: 13px; font-weight: 500; font-family: var(--sans);
    cursor: pointer; transition: all var(--t);
    border: 1px solid var(--border); background: transparent;
    color: var(--text); text-decoration: none;
  }
  .reg-btn:hover { border-color: var(--subtle); color: var(--bright); }
  .reg-btn-primary {
    background: var(--accent); border-color: var(--accent); color: white;
    padding: 12px 28px; font-size: 14px; width: 100%;
    justify-content: center;
  }
  .reg-btn-primary:hover { background: #6fa3ff; border-color: #6fa3ff; }
  .reg-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .reg-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 28px; font-weight: 700; color: var(--bright);
    letter-spacing: -0.5px; margin-bottom: 8px;
  }
  .reg-subtitle {
    color: var(--subtle); font-size: 14px; margin-bottom: 32px;
    line-height: 1.6;
  }

  .reg-field { margin-bottom: 24px; }
  .reg-label {
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--subtle);
    margin-bottom: 8px; display: block;
  }
  .reg-input {
    width: 100%; padding: 12px 16px; border-radius: var(--r);
    border: 1px solid var(--border); background: var(--surface);
    color: var(--bright); font-family: var(--sans); font-size: 14px;
    outline: none; transition: border-color var(--t);
  }
  .reg-input:focus { border-color: var(--accent); }

  .reg-slider-wrap {
    display: flex; align-items: center; gap: 16px;
  }
  .reg-slider {
    flex: 1; appearance: none; height: 4px; background: var(--muted);
    border-radius: 2px; outline: none;
  }
  .reg-slider::-webkit-slider-thumb {
    appearance: none; width: 18px; height: 18px; border-radius: 50%;
    background: var(--accent); cursor: pointer;
    border: 2px solid var(--bg);
  }
  .reg-slider-val {
    font-family: var(--mono); font-size: 16px; color: var(--bright);
    min-width: 52px; text-align: right;
  }

  .reg-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 24px; margin-bottom: 24px;
  }

  .reg-error {
    background: rgba(255,107,107,0.08); border: 1px solid rgba(255,107,107,0.3);
    border-radius: var(--r); padding: 12px 16px; margin-bottom: 16px;
    font-size: 13px; color: var(--danger);
  }

  .reg-success {
    background: rgba(46,221,170,0.08); border: 1px solid rgba(46,221,170,0.3);
    border-radius: var(--r); padding: 16px 20px; text-align: center;
    font-size: 14px; color: var(--accent2);
  }
  .reg-success a { color: var(--accent); text-decoration: none; }
  .reg-success a:hover { text-decoration: underline; }

  .reg-hint {
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
    margin-top: 6px;
  }

  .reg-gate {
    text-align: center; padding: 80px 24px;
  }
  .reg-gate-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 22px; font-weight: 700; color: var(--bright);
    margin-bottom: 10px;
  }
  .reg-gate-sub { font-size: 14px; color: var(--subtle); margin-bottom: 24px; }

  @keyframes reg-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .reg-fade { animation: reg-in 350ms ease both; }
`;

export default function RegisterPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [institutionName, setInstitutionName] = useState("");
  const [splitPercent, setSplitPercent] = useState(20);
  const [regState, setRegState] = useState<"idle" | "waiting" | "mining" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => {
      if (d.address) setAddress(d.address);
    }).finally(() => setLoading(false));
  }, []);

  async function handleRegister() {
    if (!institutionName.trim()) { setError("Institution name is required."); return; }
    if (!BOUNTY_CONTRACT) { setError("Bounty contract not configured."); return; }

    const ethereum = (window as any).ethereum;
    if (!ethereum) { setError("No wallet detected."); return; }

    try {
      setRegState("waiting"); setError("");

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
      const splitBps = splitPercent * 100;

      setRegState("mining");
      const txHash = await client.writeContract({
        address: BOUNTY_CONTRACT,
        abi: BOUNTY_ABI,
        functionName: "registerScientist",
        args: [institutionName.trim(), splitBps],
      });

      setRegState("saving");
      await fetch("/api/scientist/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionName: institutionName.trim(),
          institutionSplitBps: splitBps,
          txHash,
          chainId: CHAIN_ID,
        }),
      });

      setRegState("done");
    } catch (err: any) {
      setError(err?.shortMessage ?? err?.message ?? "Registration failed");
      setRegState("error");
    }
  }

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="reg-wrap" style={{ textAlign: "center", paddingTop: 100, fontFamily: "var(--mono)", fontSize: 13, color: "var(--subtle)" }}>
        Loading...
      </div>
    </>
  );

  if (!address) return (
    <>
      <style>{css}</style>
      <div className="reg-wrap">
        <div className="reg-nav">
          <a href="/" className="reg-wordmark">carrier<em>wave</em></a>
        </div>
        <div className="reg-gate">
          <div className="reg-gate-title">Sign in to register</div>
          <div className="reg-gate-sub">Connect your wallet on the homepage first.</div>
          <a href="/" className="reg-btn reg-btn-primary" style={{ width: "auto", display: "inline-flex" }}>Sign in</a>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="reg-wrap reg-fade">
        <div className="reg-nav">
          <a href="/" className="reg-wordmark">carrier<em>wave</em></a>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/bounties" className="reg-btn">Bounties</a>
            <a href="/profile" className="reg-btn">Profile</a>
          </div>
        </div>

        <div className="reg-title">Scientist Registration</div>
        <div className="reg-subtitle">
          Register your institutional affiliation on-chain. When you claim bounties,
          payouts split automatically between you and your institution.
        </div>

        {regState === "done" ? (
          <div className="reg-success">
            Registration complete. You can now <a href="/bounties">browse and claim bounties</a>.
          </div>
        ) : (
          <div className="reg-card">
            {error && <div className="reg-error">{error}</div>}

            <div className="reg-field">
              <label className="reg-label">Institution Name</label>
              <input
                className="reg-input"
                type="text"
                placeholder="e.g. Harvard Medical School"
                value={institutionName}
                onChange={e => setInstitutionName(e.target.value)}
                disabled={regState !== "idle" && regState !== "error"}
              />
            </div>

            <div className="reg-field">
              <label className="reg-label">Institution Split</label>
              <div className="reg-slider-wrap">
                <input
                  className="reg-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={splitPercent}
                  onChange={e => setSplitPercent(Number(e.target.value))}
                  disabled={regState !== "idle" && regState !== "error"}
                />
                <div className="reg-slider-val">{splitPercent}%</div>
              </div>
              <div className="reg-hint">
                Percentage of bounty earnings sent to your institution. You keep {100 - splitPercent}%.
              </div>
            </div>

            <button
              className="reg-btn reg-btn-primary"
              onClick={handleRegister}
              disabled={regState === "waiting" || regState === "mining" || regState === "saving"}
            >
              {regState === "waiting" ? "Confirm in wallet..." :
               regState === "mining" ? "Registering on-chain..." :
               regState === "saving" ? "Saving..." :
               "Register on-chain"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
