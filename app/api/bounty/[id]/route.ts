// app/api/bounty/[id]/route.ts
//
// GET /api/bounty/:id — single bounty with claims

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { StoredBounty, StoredClaim } from "@/types/bounty";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const raw = await kv.get<string>(`bounty:${id}`);
    if (!raw) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    const bounty: StoredBounty = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Fetch claims for this bounty
    const claimIds = (await kv.lrange(`claim:bounty:${id}`, 0, -1)) as string[];
    let claims: StoredClaim[] = [];

    if (claimIds && claimIds.length > 0) {
      const claimRecords = await Promise.all(
        claimIds.map(cid => kv.get<string>(`claim:${cid}`))
      );
      claims = claimRecords
        .filter((c): c is string => c !== null && c !== undefined)
        .map(c => typeof c === "string" ? JSON.parse(c) : c);
    }

    return NextResponse.json({ bounty, claims }, { status: 200 });
  } catch (err) {
    console.error("bounty fetch error", err);
    return NextResponse.json({ error: "Failed to fetch bounty" }, { status: 500 });
  }
}
