"use client";

// =================================================================
// app/page.tsx — Carrierwave Landing Page
//
// Structure:
//   1. Nav — wordmark + sign in / wallet address
//   2. Hero — headline, mission, two CTAs
//   3. What is an RO — three-column explainer
//   4. Live stats — from mock data (wire to /api/ro/list later)
//   5. Manifesto strip — one pull quote from the white paper
//   6. Footer
// =================================================================

import { useEffect, useState } from "react";
import { SiweMessage } from "siwe";
import { getAddress } from "ethers";
import SpiderOverlay from "./SpiderOverlay";

// ── Styles ────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;700&family=DM+Mono:ital,wght@0,400;0,500;1,400&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #080b11;
    --surface: #0f1420;
    --surface2:#131926;
    --border:  #1a2035;
    --muted:   #263050;
    --subtle:  #4a5580;
    --text:    #c0c8e0;
    --bright:  #e8edf8;
    --accent:  #4f8cff;
    --accent2: #2eddaa;
    --warn:    #ff6b6b;
    --mono:    'DM Mono', monospace;
    --sans:    'DM Sans', system-ui, sans-serif;
    --r:       10px;
    --t:       180ms ease;
  }

  html { scroll-behavior: smooth; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.65;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Subtle grid */
  body::before {
    content: '';
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(79,140,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(79,140,255,0.025) 1px, transparent 1px);
    background-size: 56px 56px;
  }

  /* Glow blobs */
  .cw-blob {
    position: fixed; border-radius: 50%;
    filter: blur(120px); pointer-events: none; z-index: 0;
  }
  .cw-blob-1 {
    width: 600px; height: 600px;
    top: -200px; left: -100px;
    background: radial-gradient(circle, rgba(79,140,255,0.07) 0%, transparent 70%);
  }
  .cw-blob-2 {
    width: 500px; height: 500px;
    bottom: -100px; right: -100px;
    background: radial-gradient(circle, rgba(46,221,170,0.05) 0%, transparent 70%);
  }

  * { position: relative; z-index: 1; }

  /* ── Nav ── */
  .cw-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 40px;
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 100;
    background: rgba(8,11,17,0.85);
  }
  .cw-wordmark {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 22px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.3px;
  }
  .cw-wordmark em { color: var(--accent); font-style: italic; }
  .cw-nav-right { display: flex; align-items: center; gap: 12px; }
  .cw-nav-links { display: flex; gap: 6px; }

  /* ── Buttons ── */
  .cw-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 20px; border-radius: var(--r);
    font-size: 13px; font-weight: 500; font-family: var(--sans);
    cursor: pointer; transition: all var(--t);
    border: 1px solid transparent; text-decoration: none;
    white-space: nowrap;
  }
  .cw-btn-primary {
    background: var(--accent); color: #fff;
    box-shadow: 0 0 0 0 rgba(79,140,255,0);
  }
  .cw-btn-primary:hover {
    background: #6fa3ff; transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(79,140,255,0.25);
  }
  .cw-btn-ghost {
    background: transparent;
    border-color: var(--border); color: var(--text);
  }
  .cw-btn-ghost:hover { border-color: var(--subtle); color: var(--bright); }
  .cw-btn-outline {
    background: transparent;
    border-color: rgba(79,140,255,0.4); color: var(--accent);
  }
  .cw-btn-outline:hover {
    border-color: var(--accent); background: rgba(79,140,255,0.08);
    transform: translateY(-1px);
  }
  .cw-btn-lg { padding: 14px 28px; font-size: 15px; border-radius: 12px; }
  .cw-btn-sm { padding: 7px 14px; font-size: 12px; }

  /* ── Hero ── */
  .cw-hero {
    max-width: 820px; margin: 0 auto;
    padding: 100px 40px 80px;
    text-align: center;
  }
  .cw-hero-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--accent);
    background: rgba(79,140,255,0.08); border: 1px solid rgba(79,140,255,0.2);
    border-radius: 20px; padding: 5px 14px; margin-bottom: 32px;
  }
  .cw-hero-eyebrow::before { content: '◈'; font-size: 12px; }

  .cw-hero-headline {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: clamp(36px, 6vw, 64px);
    font-weight: 700; line-height: 1.08;
    color: var(--bright); letter-spacing: -1.5px;
    margin-bottom: 24px;
  }
  .cw-hero-headline em { color: var(--accent); font-style: italic; }
  .cw-hero-headline .line2 { color: var(--text); font-weight: 300; }

  .cw-hero-sub {
    font-size: 18px; color: var(--text); line-height: 1.65;
    max-width: 580px; margin: 0 auto 48px;
    font-weight: 300;
  }
  .cw-hero-sub strong { color: var(--bright); font-weight: 500; }

  .cw-hero-ctas {
    display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
    margin-bottom: 20px;
  }
  .cw-hero-wallet-note {
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .cw-hero-wallet-note a { color: var(--accent); text-decoration: none; }
  .cw-hero-wallet-note a:hover { text-decoration: underline; }

  /* Sign-in status */
  .cw-signed-in {
    display: inline-flex; align-items: center; gap: 10px;
    background: rgba(46,221,170,0.08); border: 1px solid rgba(46,221,170,0.25);
    border-radius: 12px; padding: 12px 20px;
    font-family: var(--mono); font-size: 12px; color: var(--accent2);
    margin-bottom: 20px;
  }
  .cw-signed-in-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--accent2);
    box-shadow: 0 0 6px var(--accent2);
  }
  .cw-signed-in-addr { color: var(--bright); }

  /* ── What is an RO ── */
  .cw-section {
    max-width: 1080px; margin: 0 auto; padding: 80px 40px;
  }
  .cw-section-label {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--subtle);
    display: flex; align-items: center; gap: 12px; margin-bottom: 48px;
  }
  .cw-section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  .cw-ro-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
  }
  @media (max-width: 700px) { .cw-ro-grid { grid-template-columns: 1fr; } }

  .cw-ro-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 28px 24px;
    transition: border-color var(--t), transform var(--t), box-shadow var(--t);
  }
  .cw-ro-card:hover {
    border-color: rgba(79,140,255,0.3);
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.3);
  }
  .cw-ro-icon {
    font-size: 28px; margin-bottom: 16px; display: block;
    filter: drop-shadow(0 0 12px rgba(79,140,255,0.4));
  }
  .cw-ro-card h3 {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 16px; font-weight: 600; color: var(--bright);
    margin-bottom: 10px; letter-spacing: -0.2px;
  }
  .cw-ro-card p {
    font-size: 13px; color: var(--text); line-height: 1.65;
  }
  .cw-ro-card p strong { color: var(--accent); font-weight: 500; }

  /* ── Stats ── */
  .cw-stats-section {
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .cw-stats-inner {
    max-width: 1080px; margin: 0 auto; padding: 60px 40px;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
    background: var(--border);
  }
  @media (max-width: 700px) {
    .cw-stats-inner { grid-template-columns: repeat(2, 1fr); }
  }
  .cw-stat {
    background: var(--surface); padding: 32px 24px; text-align: center;
    transition: background var(--t);
  }
  .cw-stat:hover { background: var(--surface2); }
  .cw-stat-num {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 42px; font-weight: 700; line-height: 1;
    color: var(--bright); margin-bottom: 8px;
    letter-spacing: -1px;
  }
  .cw-stat-num.accent { color: var(--accent); }
  .cw-stat-num.green { color: var(--accent2); }
  .cw-stat-label {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--subtle); line-height: 1.5;
  }

  /* ── Manifesto strip ── */
  .cw-manifesto {
    max-width: 800px; margin: 0 auto; padding: 80px 40px;
    text-align: center;
  }
  .cw-manifesto blockquote {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: clamp(20px, 3vw, 28px); font-weight: 300;
    font-style: italic; color: var(--bright); line-height: 1.4;
    letter-spacing: -0.3px;
  }
  .cw-manifesto blockquote em { color: var(--accent); font-style: normal; font-weight: 500; }
  .cw-manifesto cite {
    display: block; margin-top: 20px;
    font-family: var(--mono); font-size: 11px;
    color: var(--subtle); font-style: normal; letter-spacing: 0.08em;
  }

  /* ── Final CTA ── */
  .cw-final-cta {
    max-width: 600px; margin: 0 auto; padding: 0 40px 100px;
    text-align: center;
  }
  .cw-final-cta h2 {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 28px; font-weight: 700; color: var(--bright);
    margin-bottom: 14px; letter-spacing: -0.5px;
  }
  .cw-final-cta p {
    font-size: 15px; color: var(--text); margin-bottom: 32px;
    line-height: 1.7;
  }

  /* ── Footer ── */
  .cw-footer {
    border-top: 1px solid var(--border);
    padding: 28px 40px;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
  }
  .cw-footer-left {
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
  }
  .cw-footer-links {
    display: flex; gap: 20px;
    font-family: var(--mono); font-size: 11px;
  }
  .cw-footer-links a {
    color: var(--subtle); text-decoration: none; transition: color var(--t);
  }
  .cw-footer-links a:hover { color: var(--accent); }

  /* ── Spinner ── */
  @keyframes cw-spin { to { transform: rotate(360deg); } }
  .cw-spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.2);
    border-top-color: #fff;
    animation: cw-spin 0.6s linear infinite;
    display: inline-block;
  }

  /* ── Wallet modal ── */
  .cw-modal-backdrop {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    animation: cw-fade-in 200ms ease;
  }
  @keyframes cw-fade-in { from { opacity: 0; } to { opacity: 1; } }

  .cw-modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px; padding: 32px; width: 400px; max-width: 90vw;
    animation: cw-modal-up 250ms ease;
  }
  @keyframes cw-modal-up {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .cw-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 8px;
  }
  .cw-modal-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 18px; font-weight: 700; color: var(--bright);
    letter-spacing: -0.3px;
  }
  .cw-modal-close {
    background: none; border: none; color: var(--subtle);
    font-size: 20px; cursor: pointer; padding: 4px 8px;
    border-radius: 6px; transition: all var(--t); line-height: 1;
  }
  .cw-modal-close:hover { color: var(--bright); background: rgba(255,255,255,0.05); }

  .cw-modal-sub {
    font-size: 13px; color: var(--subtle); margin-bottom: 24px; line-height: 1.5;
  }

  .cw-wallet-list { display: flex; flex-direction: column; gap: 10px; }

  .cw-wallet-option {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px; border-radius: 12px;
    background: var(--surface2); border: 1px solid var(--border);
    text-decoration: none; color: var(--text);
    transition: all var(--t); cursor: pointer;
  }
  .cw-wallet-option:hover {
    border-color: rgba(79,140,255,0.35);
    background: rgba(79,140,255,0.06);
    transform: translateX(3px);
  }
  .cw-wallet-icon {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; flex-shrink: 0;
  }
  .cw-wallet-info { flex: 1; min-width: 0; }
  .cw-wallet-name {
    font-size: 14px; font-weight: 600; color: var(--bright);
    margin-bottom: 2px;
  }
  .cw-wallet-desc {
    font-size: 11px; color: var(--subtle); font-family: var(--mono);
  }
  .cw-wallet-arrow { color: var(--subtle); font-size: 14px; transition: color var(--t); }
  .cw-wallet-option:hover .cw-wallet-arrow { color: var(--accent); }

  /* ── Animations ── */
  @keyframes cw-up { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  .cw-fade-up { animation: cw-up 600ms ease both; }
  .delay-1 { animation-delay: 100ms; }
  .delay-2 { animation-delay: 200ms; }
  .delay-3 { animation-delay: 300ms; }
  .delay-4 { animation-delay: 400ms; }
  .delay-5 { animation-delay: 500ms; }
`;

// ── RO type examples for the explainer ───────────────────────

const RO_TYPES = [
  {
    icon: "🔬",
    title: "A single experimental result",
    desc: "One figure. One claim. One dataset. No need to wait for a full paper — disclose it the day you run the experiment.",
    highlight: "Immediate priority",
  },
  {
    icon: "🔁",
    title: "A replication or negative result",
    desc: "Science that never gets published. On Carrierwave, a failed replication is as valuable as a positive finding — it updates everyone's priors.",
    highlight: "Failure has value",
  },
  {
    icon: "🧪",
    title: "A protocol or reagent",
    desc: "The method that took you two years to optimize. Shared as a citable, versioned object — with your name on it forever.",
    highlight: "Methods count",
  },
];

// ── Wallets ──────────────────────────────────────────────────

const WALLETS = [
  { name: "MetaMask",       desc: "The most popular browser wallet",    icon: "🦊", url: "https://metamask.io/download/", bg: "#f6851b" },
  { name: "Coinbase Wallet", desc: "Simple and beginner-friendly",      icon: "🔵", url: "https://www.coinbase.com/wallet", bg: "#0052ff" },
  { name: "Rainbow",        desc: "Beautiful mobile-first wallet",      icon: "🌈", url: "https://rainbow.me/",           bg: "#6b4ce6" },
  { name: "Rabby",          desc: "Security-focused with tx previews",  icon: "🐰", url: "https://rabby.io/",             bg: "#7c6af2" },
];

// ── Component ─────────────────────────────────────────────────

export default function HomePage() {
  const [address, setAddress]   = useState<string | null>(null);
  const [status, setStatus]     = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [walletModal, setWalletModal] = useState(false);

  // Restore session on load
  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => { if (d.address) setAddress(d.address); });
  }, []);

  async function signIn() {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setErrorMsg("No wallet detected. Please install a wallet first (see link below).");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const userAddress = getAddress(accounts[0]);

      const { nonce } = await fetch("/api/nonce").then(r => r.json());

      const message = new SiweMessage({
        domain: window.location.host,
        address: userAddress,
        statement: "Sign in to Carrierwave. Your signature is your identity.",
        uri: window.location.origin,
        version: "1",
        chainId: await ethereum.request({ method: "eth_chainId" }).then((c: string) => parseInt(c, 16)),
        nonce,
      });

      const messageToSign = message.prepareMessage();
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [messageToSign, userAddress],
      });

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSign, signature }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        setAddress(json.address);
        setStatus("idle");
      } else {
        throw new Error(json.error || "Verification failed");
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Sign-in failed");
      setStatus("error");
    }
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    setAddress(null);
    setStatus("idle");
  }

  const shortAddr = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  return (
    <>
      <style>{css}</style>
      {/* SpiderOverlay disabled temporarily
      <SpiderOverlay
        patrolSelectors={[".cw-ro-card", ".cw-stat", ".cw-hero-headline", ".cw-section-label"]}
      />
      */}
      <div className="cw-blob cw-blob-1" />
      <div className="cw-blob cw-blob-2" />

      {/* ── Nav ── */}
      <nav className="cw-nav">
        <a href="/" className="cw-wordmark">carrier<em>wave</em></a>
        <div className="cw-nav-right">
          <div className="cw-nav-links">
            <a href="/explore" className="cw-btn cw-btn-ghost cw-btn-sm">Explore</a>
            <a href="/bounties" className="cw-btn cw-btn-ghost cw-btn-sm">Bounties</a>
            <a href="/graph" className="cw-btn cw-btn-ghost cw-btn-sm">Graph</a>
            <button
              onClick={() => setWalletModal(true)}
              className="cw-btn cw-btn-ghost cw-btn-sm"
            >Get a wallet</button>
          </div>
          {address ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <a href="/profile" className="cw-btn cw-btn-ghost cw-btn-sm">My profile</a>
              <button onClick={signOut} className="cw-btn cw-btn-ghost cw-btn-sm">
                <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{shortAddr}</span>
                · Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={signIn}
              disabled={status === "loading"}
              className="cw-btn cw-btn-primary cw-btn-sm"
            >
              {status === "loading" ? <span className="cw-spinner" /> : "⬡"}
              Sign in with wallet
            </button>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="cw-hero">
        <div className="cw-hero-eyebrow cw-fade-up">Biological Knowledge Infrastructure</div>

        <h1 className="cw-hero-headline cw-fade-up delay-1">
          Scientific knowledge<br />
          <span className="line2">at an atomic resolution.</span>
        </h1>

        <p className="cw-hero-sub cw-fade-up delay-2">
          Result by result, Carrierwave maps what's known, infers what's next, and identifies the value for every stakeholder.
          Share a result the day you run it. Establish priority. Get credit when it matters.
        </p>

        {address ? (
          <div className="cw-fade-up delay-3">
            <div className="cw-signed-in">
              <div className="cw-signed-in-dot" />
              Signed in as <span className="cw-signed-in-addr">{shortAddr}</span>
            </div>
            <div className="cw-hero-ctas">
              <a href="/explore" className="cw-btn cw-btn-primary cw-btn-lg">
                ⬡ Explore the feed
              </a>
              <a href="/upload" className="cw-btn cw-btn-outline cw-btn-lg">
                + Submit a Research Object
              </a>
            </div>
          </div>
        ) : (
          <div className="cw-fade-up delay-3">
            <div className="cw-hero-ctas">
              <a href="/explore" className="cw-btn cw-btn-outline cw-btn-lg">
                Explore the feed →
              </a>
              <button
                onClick={signIn}
                disabled={status === "loading"}
                className="cw-btn cw-btn-primary cw-btn-lg"
              >
                {status === "loading" ? <span className="cw-spinner" /> : "⬡"}
                Sign in with wallet
              </button>
            </div>
            <div className="cw-hero-wallet-note cw-fade-up delay-4">
              No account needed. No password.&nbsp;·&nbsp;
              <a href="#" onClick={(e) => { e.preventDefault(); setWalletModal(true); }}>
                Get a wallet in 2 minutes
              </a>
            </div>
            {status === "error" && (
              <p style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 12, color: "var(--warn)", textAlign: "center" }}>
                {errorMsg}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── What is an RO ── */}
      <section className="cw-section">
        <div className="cw-section-label">What is a Research Object?</div>
        <div className="cw-ro-grid">
          {RO_TYPES.map((ro, i) => (
            <div key={i} className="cw-ro-card">
              <span className="cw-ro-icon">{ro.icon}</span>
              <h3>{ro.title}</h3>
              <p>
                {ro.desc}<br /><br />
                <strong>{ro.highlight}.</strong>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="cw-stats-section">
        <div className="cw-stats-inner">
          {[
            { num: "∞",    label: "Time to disclosure\nafter experiment",  cls: "accent" },
            { num: "100%", label: "Of findings\nare citable",              cls: "" },
            { num: "0",    label: "Gatekeepers\nbetween you and priority", cls: "green" },
            { num: "∀",    label: "Negative results\nwelcome",             cls: "" },
          ].map((s, i) => (
            <div key={i} className="cw-stat">
              <div className={`cw-stat-num ${s.cls}`}>{s.num}</div>
              <div className="cw-stat-label" style={{ whiteSpace: "pre-line" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Manifesto strip ── */}
      <div className="cw-manifesto">
        <blockquote>
          "The next breakthrough isn't hiding in a lab.<br />
          <em>It's already happened.</em>"
        </blockquote>
        <cite>— Carrierwave</cite>
      </div>

      {/* ── Final CTA ── */}
      <div className="cw-final-cta">
        <h2>Add your result<br />to the map.</h2>
        <p>
          Your wallet is your signature. Every RO you submit carries your address,
          a cryptographic hash, and a timestamp — permanent proof that you were first.
        </p>
        {address ? (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/explore" className="cw-btn cw-btn-outline cw-btn-lg">Explore the feed</a>
            <a href="/upload" className="cw-btn cw-btn-primary cw-btn-lg">+ Submit a Research Object</a>
          </div>
        ) : (
          <button onClick={signIn} disabled={status === "loading"} className="cw-btn cw-btn-primary cw-btn-lg">
            {status === "loading" ? <span className="cw-spinner" /> : "⬡"}
            Sign in with wallet
          </button>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="cw-footer">
        <div className="cw-footer-left">
          carrier<em style={{ color: "var(--accent)", fontStyle: "italic" }}>wave</em>
          &nbsp;·&nbsp; biological knowledge infrastructure &nbsp;·&nbsp; 2026
        </div>
        <div className="cw-footer-links">
          <a href="/explore">Feed</a>
          <a href="/upload">Submit RO</a>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setWalletModal(true); }}
          >Get a wallet</a>
        </div>
      </footer>

      {/* ── Wallet modal ── */}
      {walletModal && (
        <div className="cw-modal-backdrop" onClick={() => setWalletModal(false)}>
          <div className="cw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cw-modal-header">
              <span className="cw-modal-title">Get a wallet</span>
              <button className="cw-modal-close" onClick={() => setWalletModal(false)}>×</button>
            </div>
            <p className="cw-modal-sub">
              Pick any wallet to get started. No account needed — just install and you're ready to sign in.
            </p>
            <div className="cw-wallet-list">
              {WALLETS.map((w) => (
                <a
                  key={w.name}
                  href={w.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cw-wallet-option"
                >
                  <div className="cw-wallet-icon" style={{ background: w.bg + "18" }}>{w.icon}</div>
                  <div className="cw-wallet-info">
                    <div className="cw-wallet-name">{w.name}</div>
                    <div className="cw-wallet-desc">{w.desc}</div>
                  </div>
                  <span className="cw-wallet-arrow">↗</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
