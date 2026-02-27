// app/api/bounty/create/route.ts
//
// POST /api/bounty/create — save bounty metadata to KV after on-chain creation

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";
import type { StoredBounty } from "@/types/bounty";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.address) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { onChainId, amount, diseaseTag, criteria, deadline, txHash, chainId } = await req.json();

    if (onChainId === undefined || onChainId === null) {
      return NextResponse.json({ error: "onChainId required" }, { status: 400 });
    }
    if (!amount || !diseaseTag || !criteria || !deadline || !txHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = randomUUID();
    const bounty: StoredBounty = {
      id,
      onChainId: Number(onChainId),
      funderAddress: session.address,
      amount: String(amount),
      diseaseTag: diseaseTag.trim(),
      criteria: criteria.trim(),
      deadline,
      status: "open",
      claimCount: 0,
      createdAt: new Date().toISOString(),
      txHash,
      chainId: chainId ?? 1,
    };

    // Primary record
    await kv.set(`bounty:${id}`, JSON.stringify(bounty));

    // Global recents (capped at 500)
    await kv.lpush("bounty:recent", id);
    await kv.ltrim("bounty:recent", 0, 499);

    // Tag index
    const tagKey = `bounty:tag:${diseaseTag.toLowerCase().trim().replace(/\s+/g, "_")}`;
    await kv.lpush(tagKey, id);

    // Funder index
    await kv.lpush(`bounty:funder:${session.address.toLowerCase()}`, id);

    return NextResponse.json({ success: true, bounty }, { status: 201 });
  } catch (err) {
    console.error("bounty create error", err);
    return NextResponse.json({ error: "Failed to save bounty" }, { status: 500 });
  }
}
