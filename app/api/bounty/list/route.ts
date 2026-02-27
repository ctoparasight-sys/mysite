// app/api/bounty/list/route.ts
//
// GET /api/bounty/list
//
// Query params:
//   page   — page number (default 1)
//   limit  — per page (default 20, max 50)
//   tag    — disease tag filter
//   status — bounty status filter (open, finalized, cancelled)
//   funder — funder wallet filter

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { StoredBounty, BountySummary, BountyStatus } from "@/types/bounty";

function toSummary(b: StoredBounty): BountySummary {
  return {
    id:            b.id,
    onChainId:     b.onChainId,
    funderAddress: b.funderAddress,
    amount:        b.amount,
    diseaseTag:    b.diseaseTag,
    criteria:      b.criteria,
    deadline:      b.deadline,
    status:        b.status,
    claimCount:    b.claimCount,
    createdAt:     b.createdAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const tag    = searchParams.get("tag");
    const status = searchParams.get("status") as BountyStatus | null;
    const funder = searchParams.get("funder");

    // Decide which ID list to pull from
    let ids: string[] = [];

    if (funder) {
      ids = (await kv.lrange(`bounty:funder:${funder.toLowerCase()}`, 0, -1)) as string[];
    } else if (tag) {
      const tagKey = `bounty:tag:${tag.toLowerCase().replace(/\s+/g, "_")}`;
      ids = (await kv.lrange(tagKey, 0, -1)) as string[];
    } else {
      ids = (await kv.lrange("bounty:recent", 0, -1)) as string[];
    }

    if (!ids || ids.length === 0) {
      return NextResponse.json({ bounties: [], total: 0, page: 1, pages: 0 });
    }

    // Fetch all full records
    const records = await Promise.all(
      ids.map(id => kv.get<StoredBounty>(`bounty:${id}`))
    );

    // Filter
    let bounties = records
      .filter((b): b is StoredBounty => b !== null && b !== undefined)
      // Parse stringified JSON if needed
      .map(b => typeof b === "string" ? JSON.parse(b) as StoredBounty : b)
      .filter(b => !status || b.status === status);

    // Sort by newest first
    bounties.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Paginate
    const total = bounties.length;
    const pages = Math.ceil(total / limit);
    const slice = bounties.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      bounties: slice.map(toSummary),
      total,
      page,
      pages,
    });
  } catch (err) {
    console.error("bounty list error", err);
    return NextResponse.json({ error: "Failed to fetch bounties" }, { status: 500 });
  }
}
