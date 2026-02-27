// app/api/scientist/register/route.ts
//
// POST /api/scientist/register — save scientist profile to KV
// GET  /api/scientist/register?address=0x... — fetch scientist profile

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { kv } from "@vercel/kv";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";
import type { ScientistProfile } from "@/types/bounty";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.address) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { institutionName, institutionSplitBps, txHash, chainId } = await req.json();

    if (!institutionName || typeof institutionName !== "string" || !institutionName.trim()) {
      return NextResponse.json({ error: "Institution name required" }, { status: 400 });
    }
    if (institutionSplitBps === undefined || institutionSplitBps < 0 || institutionSplitBps > 10000) {
      return NextResponse.json({ error: "Split must be 0-10000 bps" }, { status: 400 });
    }

    const profile: ScientistProfile = {
      walletAddress: session.address,
      institutionName: institutionName.trim(),
      institutionSplitBps,
      registeredAt: new Date().toISOString(),
      txHash,
      chainId,
    };

    await kv.set(`scientist:${session.address.toLowerCase()}`, JSON.stringify(profile));

    return NextResponse.json({ success: true, profile }, { status: 201 });
  } catch (err) {
    console.error("scientist register error", err);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Missing address parameter" }, { status: 400 });
    }

    const raw = await kv.get<string>(`scientist:${address.toLowerCase()}`);
    if (!raw) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json({ profile }, { status: 200 });
  } catch (err) {
    console.error("scientist fetch error", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
