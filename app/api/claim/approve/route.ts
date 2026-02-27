// app/api/claim/approve/route.ts
//
// POST /api/claim/approve — update claim in KV after on-chain approval/rejection

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { kv } from "@vercel/kv";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";
import type { StoredClaim } from "@/types/bounty";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.address) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { claimId, status, shareBps, txHash } = await req.json();

    if (!claimId || !status || !txHash) {
      return NextResponse.json({ error: "claimId, status, and txHash required" }, { status: 400 });
    }

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json({ error: "Status must be approved or rejected" }, { status: 400 });
    }

    if (status === "approved" && (!shareBps || shareBps <= 0 || shareBps > 10000)) {
      return NextResponse.json({ error: "Valid shareBps required for approval" }, { status: 400 });
    }

    const raw = await kv.get<string>(`claim:${claimId}`);
    if (!raw) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const claim: StoredClaim = typeof raw === "string" ? JSON.parse(raw) : raw;

    claim.status = status;
    claim.approvalTxHash = txHash;
    if (status === "approved") {
      claim.shareBps = shareBps;
    }

    await kv.set(`claim:${claimId}`, JSON.stringify(claim));

    return NextResponse.json({ success: true, claim }, { status: 200 });
  } catch (err) {
    console.error("claim approve error", err);
    return NextResponse.json({ error: "Failed to update claim" }, { status: 500 });
  }
}
