import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";
import type { StoredResearchObject } from "@/types/ro";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.address) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { roId, txHash, chainId } = await req.json();
    if (!roId || !txHash) return NextResponse.json({ error: "roId and txHash required" }, { status: 400 });

    const ro = await kv.get<StoredResearchObject>(`ro:${roId}`);
    if (!ro) return NextResponse.json({ error: "RO not found" }, { status: 404 });

    if (ro.walletAddress.toLowerCase() !== session.address.toLowerCase())
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    await kv.set(`ro:${roId}`, { ...ro, txHash, chainId: chainId ?? 11155111 });

    return NextResponse.json({ success: true, txHash, chainId });
  } catch (err) {
    console.error("mint route error", err);
    return NextResponse.json({ error: "Failed to record mint" }, { status: 500 });
  }
}
