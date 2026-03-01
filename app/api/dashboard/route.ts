// app/api/dashboard/route.ts
//
// GET /api/dashboard — aggregated funder dashboard data
//
// Session-authenticated. Returns all bounties for the signed-in wallet,
// their claims, and computed summary stats.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { kv } from "@vercel/kv";
import { sessionOptions, type SessionData } from "@/lib/session";
import type { StoredBounty, StoredClaim } from "@/types/bounty";
import type { DashboardSummary, DashboardResponse } from "@/types/dashboard";

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.address) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const address = session.address.toLowerCase();

    // Fetch all bounty IDs for this funder
    const bountyIds = (await kv.lrange(`bounty:funder:${address}`, 0, -1)) as string[];

    if (!bountyIds || bountyIds.length === 0) {
      const emptySummary: DashboardSummary = {
        totalEthLocked: 0,
        activeBounties: 0,
        totalClaims: 0,
        pendingClaims: 0,
        ethByStatus: { open: 0, finalized: 0, cancelled: 0 },
        claimsByStatus: { pending: 0, approved: 0, rejected: 0 },
        diseaseBreakdown: [],
        timeline: [],
      };
      return NextResponse.json({ bounties: [], claims: [], summary: emptySummary });
    }

    // Fetch all bounty records in parallel
    const bountyRecords = await Promise.all(
      bountyIds.map(id => kv.get<StoredBounty>(`bounty:${id}`))
    );
    const bounties: StoredBounty[] = bountyRecords
      .filter((b): b is StoredBounty => b !== null && b !== undefined)
      .map(b => typeof b === "string" ? JSON.parse(b) as StoredBounty : b);

    // Fetch all claims for all bounties in parallel
    const claimIdLists = await Promise.all(
      bountyIds.map(id => kv.lrange(`claim:bounty:${id}`, 0, -1))
    );
    const allClaimIds = claimIdLists.flat().filter(Boolean) as string[];

    let claims: StoredClaim[] = [];
    if (allClaimIds.length > 0) {
      const claimRecords = await Promise.all(
        allClaimIds.map(cid => kv.get<StoredClaim>(`claim:${cid}`))
      );
      claims = claimRecords
        .filter((c): c is StoredClaim => c !== null && c !== undefined)
        .map(c => typeof c === "string" ? JSON.parse(c) as StoredClaim : c);
    }

    // Compute summary stats
    const ethByStatus = { open: 0, finalized: 0, cancelled: 0 };
    const claimsByStatus = { pending: 0, approved: 0, rejected: 0 };
    const diseaseMap = new Map<string, { count: number; eth: number }>();
    const monthMap = new Map<string, number>();

    for (const b of bounties) {
      const eth = parseFloat(b.amount) || 0;
      ethByStatus[b.status] = (ethByStatus[b.status] || 0) + eth;

      // Disease breakdown
      const tag = b.diseaseTag || "Other";
      const existing = diseaseMap.get(tag) || { count: 0, eth: 0 };
      diseaseMap.set(tag, { count: existing.count + 1, eth: existing.eth + eth });

      // Timeline (month of creation)
      const month = b.createdAt.slice(0, 7); // "YYYY-MM"
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    }

    for (const c of claims) {
      claimsByStatus[c.status] = (claimsByStatus[c.status] || 0) + 1;
    }

    const summary: DashboardSummary = {
      totalEthLocked: ethByStatus.open,
      activeBounties: bounties.filter(b => b.status === "open").length,
      totalClaims: claims.length,
      pendingClaims: claimsByStatus.pending,
      ethByStatus,
      claimsByStatus,
      diseaseBreakdown: Array.from(diseaseMap.entries())
        .map(([tag, d]) => ({ tag, count: d.count, eth: d.eth }))
        .sort((a, b) => b.eth - a.eth),
      timeline: Array.from(monthMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };

    const response: DashboardResponse = { bounties, claims, summary };
    return NextResponse.json(response);
  } catch (err) {
    console.error("dashboard error", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
