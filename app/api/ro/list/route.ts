// app/api/ro/list/route.ts
//
// GET /api/ro/list
//
// Query params:
//   page      — page number (default 1)
//   limit     — per page (default 20, max 50)
//   type      — ROType filter
//   wallet    — wallet address filter
//   tag       — disease area tag filter
//   sort      — "newest" | "confidence" | "relationships" (default newest)
//
// Returns:
//   { ros: ROSummary[], total: number, page: number, pages: number }

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { StoredResearchObject, ROSummary, ROType } from "@/types/ro";

function toSummary(ro: StoredResearchObject): ROSummary {
  return {
    id:                   ro.id,
    walletAddress:        ro.walletAddress,
    contentHash:          ro.contentHash,
    timestamp:            ro.timestamp,
    roType:               ro.roType,
    dataType:             ro.dataType,
    species:              ro.species,
    experimentalSystem:   ro.experimentalSystem,
    title:                ro.title,
    abstract:             ro.abstract,
    claim:                ro.claim,
    confidence:           ro.confidence,
    replicateCount:       ro.replicateCount,
    hasCommercialRelevance: ro.hasCommercialRelevance,
    diseaseAreaTags:      ro.diseaseAreaTags ?? [],
    relationshipCount:    ro.relationships?.length ?? 0,
    minted:               !!ro.txHash,
    figureUrl:            ro.figureUrl,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit   = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const type    = searchParams.get("type") as ROType | null;
    const wallet  = searchParams.get("wallet");
    const tag     = searchParams.get("tag");
    const sort    = searchParams.get("sort") ?? "newest";

    // ── Decide which ID list to pull from ────────────────────
    let ids: string[] = [];

    if (wallet) {
      // Wallet-specific list
      const walletKey = `ro:wallet:${wallet.toLowerCase()}`;
      ids = (await kv.lrange(walletKey, 0, -1)) as string[];
    } else if (tag) {
      // Tag-specific list
      const tagKey = `ro:tag:${tag.toLowerCase().replace(/\s+/g, "_")}`;
      ids = (await kv.lrange(tagKey, 0, -1)) as string[];
    } else {
      // Global recent list
      ids = (await kv.lrange("ro:recent", 0, -1)) as string[];
    }

    if (!ids || ids.length === 0) {
      return NextResponse.json({ ros: [], total: 0, page: 1, pages: 0 });
    }

    // ── Fetch all full records ────────────────────────────────
    const records = await Promise.all(
      ids.map(id => kv.get<StoredResearchObject>(`ro:${id}`))
    );

    // ── Filter out nulls and apply type filter ────────────────
    let ros = records
      .filter((r): r is StoredResearchObject => r !== null && r !== undefined)
      .filter(r => !type || r.roType === type);

    // ── Sort ──────────────────────────────────────────────────
    if (sort === "confidence") {
      ros.sort((a, b) => b.confidence - a.confidence || b.replicateCount - a.replicateCount);
    } else if (sort === "relationships") {
      ros.sort((a, b) => (b.relationships?.length ?? 0) - (a.relationships?.length ?? 0));
    } else {
      // newest — already in lpush order but sort by timestamp to be safe
      ros.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    // ── Paginate ──────────────────────────────────────────────
    const total = ros.length;
    const pages = Math.ceil(total / limit);
    const slice = ros.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      ros:   slice.map(toSummary),
      total,
      page,
      pages,
    });
  } catch (err) {
    console.error("list error", err);
    return NextResponse.json({ error: "Failed to fetch research objects" }, { status: 500 });
  }
}
