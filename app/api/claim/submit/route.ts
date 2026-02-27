// app/api/claim/submit/route.ts
//
// POST /api/claim/submit — save claim metadata to KV after on-chain submission

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";
import type { StoredClaim, StoredBounty } from "@/types/bounty";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.address) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const {
      bountyId,
      onChainBountyId,
      onChainClaimIndex,
      roId,
      justification,
      txHash,
      chainId,
    } = await req.json();

    if (!bountyId || onChainBountyId === undefined || onChainClaimIndex === undefined) {
      return NextResponse.json({ error: "Missing bounty identifiers" }, { status: 400 });
    }
    if (!roId || !justification || !txHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify bounty exists
    const bountyRaw = await kv.get<string>(`bounty:${bountyId}`);
    if (!bountyRaw) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    const id = randomUUID();
    const claim: StoredClaim = {
      id,
      bountyId,
      onChainBountyId: Number(onChainBountyId),
      onChainClaimIndex: Number(onChainClaimIndex),
      scientistAddress: session.address,
      roId,
      justification: justification.trim(),
      status: "pending",
      shareBps: 0,
      createdAt: new Date().toISOString(),
      txHash,
      chainId: chainId ?? 1,
    };

    // Save claim
    await kv.set(`claim:${id}`, JSON.stringify(claim));

    // Bounty claims index
    await kv.lpush(`claim:bounty:${bountyId}`, id);

    // Scientist claims index
    await kv.lpush(`claim:scientist:${session.address.toLowerCase()}`, id);

    // Update bounty claim count
    const bounty: StoredBounty = typeof bountyRaw === "string" ? JSON.parse(bountyRaw) : bountyRaw;
    bounty.claimCount = (bounty.claimCount || 0) + 1;
    await kv.set(`bounty:${bountyId}`, JSON.stringify(bounty));

    return NextResponse.json({ success: true, claim }, { status: 201 });
  } catch (err) {
    console.error("claim submit error", err);
    return NextResponse.json({ error: "Failed to save claim" }, { status: 500 });
  }
}
