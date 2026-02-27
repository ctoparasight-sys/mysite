// app/api/bounty/finalize/route.ts
//
// POST /api/bounty/finalize — update bounty in KV after on-chain finalization or cancellation

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { kv } from "@vercel/kv";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";
import type { StoredBounty } from "@/types/bounty";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.address) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { bountyId, action, txHash } = await req.json();

    if (!bountyId || !action || !txHash) {
      return NextResponse.json({ error: "bountyId, action, and txHash required" }, { status: 400 });
    }

    if (action !== "finalize" && action !== "cancel") {
      return NextResponse.json({ error: "Action must be finalize or cancel" }, { status: 400 });
    }

    const raw = await kv.get<string>(`bounty:${bountyId}`);
    if (!raw) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    const bounty: StoredBounty = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (bounty.funderAddress.toLowerCase() !== session.address.toLowerCase()) {
      return NextResponse.json({ error: "Only funder can finalize/cancel" }, { status: 403 });
    }

    if (action === "finalize") {
      bounty.status = "finalized";
      bounty.finalizedTxHash = txHash;
    } else {
      bounty.status = "cancelled";
      bounty.cancelledTxHash = txHash;
    }

    await kv.set(`bounty:${bountyId}`, JSON.stringify(bounty));

    return NextResponse.json({ success: true, bounty }, { status: 200 });
  } catch (err) {
    console.error("bounty finalize error", err);
    return NextResponse.json({ error: "Failed to update bounty" }, { status: 500 });
  }
}
