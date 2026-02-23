"use client";

import { useEffect, useState } from "react";
import { SiweMessage } from "siwe";
import { getAddress } from "ethers";

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Not signed in");
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
    const userAddress = getAddress(accounts[0]);

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
      chainId: 1, // OK for signing; no transaction
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

  return (
    <main style={{ padding: "4rem", fontFamily: "sans-serif" }}>
      <h1>Carrierwave</h1>
      <p>An open infrastructure for continuous scientific disclosure.</p>

      <button
        onClick={signIn}
        style={{ marginTop: "2rem", padding: "0.75rem 1.25rem", fontSize: "1rem" }}
      >
        Sign in with Wallet
      </button>

<button
  onClick={async () => {
    await fetch("/api/logout", { method: "POST" });
    setAddress(null);
    setStatus("Not signed in");
  }}
  style={{ marginTop: "1rem", padding: "0.5rem 1rem", fontSize: "1rem" }}
>
  Sign out
</button>

      <p style={{ marginTop: "1rem" }}>Status: {status}</p>

      {address && (
        <p style={{ marginTop: "1rem" }}>
          Signed in as:<br />
          <code>{address}</code>
        </p>
      )}
    </main>
  );
}