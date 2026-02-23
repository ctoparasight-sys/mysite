"use client";

import { useEffect, useState } from "react";
import { SiweMessage } from "siwe";
import { getAddress } from "ethers";

export default function Home() {
  // --- Auth state ---
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Not signed in");

  // --- AI demo state ---
  const [aiText, setAiText] = useState(
    "We used CRISPR in mouse to study Parkinson disease and performed RNA-seq."
  );
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiStatus, setAiStatus] = useState<string>("");

  // On load: check if there's an existing session cookie
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      const data = await res.json();
      if (data.address) {
        setAddress(data.address);
        setStatus("Signed in");
      }
    })();
  }, []);

  async function signIn() {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      alert("No wallet found. Please use Brave or install a wallet.");
      return;
    }

    setStatus("Requesting wallet…");

    // 1) Ask wallet for account
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    const userAddress = getAddress(accounts[0]); // checksum address

    // 2) Ask server for a nonce (one-time challenge)
    setStatus("Getting nonce…");
    const nonceRes = await fetch("/api/nonce");
    const { nonce } = await nonceRes.json();

    // 3) Build SIWE message
    const message = new SiweMessage({
      domain: window.location.host,
      address: userAddress,
      statement: "Sign in to Carrierwave",
      uri: window.location.origin,
      version: "1",
      chainId: 1, // signing only (no transaction)
      nonce,
    });

    const messageToSign = message.prepareMessage();

    // 4) Wallet signs the message
    setStatus("Signing message…");
    const signature = await ethereum.request({
      method: "personal_sign",
      params: [messageToSign, userAddress],
    });

    // 5) Server verifies signature and sets session cookie
    setStatus("Verifying…");
    const verifyRes = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: messageToSign, signature }),
    });

    const verifyJson = await verifyRes.json();

    if (verifyRes.ok && verifyJson.ok) {
      setAddress(verifyJson.address);
      setStatus("Signed in");
    } else {
      setStatus("Sign-in failed");
      alert(verifyJson.error || "Sign-in failed");
    }
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    setAddress(null);
    setStatus("Not signed in");
  }

  async function runAi() {
    setAiStatus("Analyzing…");
    setAiResult(null);

    const res = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: aiText }),
    });

    const data = await res.json();
    setAiResult(data);
    setAiStatus("Done");
  }

  return (
    <main style={{ padding: "4rem", fontFamily: "sans-serif" }}>
      <h1>Carrierwave</h1>
      <p>An open infrastructure for continuous scientific disclosure.</p>

      <button
        onClick={signIn}
        style={{
          marginTop: "2rem",
          padding: "0.75rem 1.25rem",
          fontSize: "1rem",
        }}
      >
        Sign in with Wallet
      </button>

      <button
        onClick={signOut}
        style={{
          marginTop: "1rem",
          marginLeft: "1rem",
          padding: "0.75rem 1.25rem",
          fontSize: "1rem",
        }}
      >
        Sign out
      </button>

      <p style={{ marginTop: "1rem" }}>Status: {status}</p>

      {address && (
        <p style={{ marginTop: "1rem" }}>
          Signed in as:
          <br />
          <code>{address}</code>
        </p>
      )}

      <hr style={{ margin: "2rem 0" }} />

      <h2>AI (test)</h2>

      <textarea
        value={aiText}
        onChange={(e) => setAiText(e.target.value)}
        rows={5}
        style={{ width: "100%", maxWidth: 800, marginTop: "0.5rem" }}
      />

      <div style={{ marginTop: "0.75rem" }}>
        <button
          onClick={runAi}
          style={{ padding: "0.6rem 1rem", fontSize: "1rem" }}
        >
          Analyze
        </button>
        <span style={{ marginLeft: "1rem" }}>{aiStatus}</span>
      </div>

      {aiResult && (
        <div style={{ marginTop: "1rem", maxWidth: 900 }}>
          <p>
            <b>Summary:</b> {aiResult.summary}
          </p>

          <p>
            <b>Diseases:</b>{" "}
            {aiResult.diseases?.length
              ? aiResult.diseases
                  .map((d: any) => `${d.name} (${d.confidence})`)
                  .join(", ")
              : "None"}
          </p>

          <p>
            <b>Tags:</b>{" "}
            {aiResult.tags?.length
              ? aiResult.tags
                  .map((t: any) => `${t.name} (${t.confidence})`)
                  .join(", ")
              : "None"}
          </p>

          <p>
            <b>Overall confidence:</b> {aiResult.confidence}
          </p>
        </div>
      )}
    </main>
  );
}