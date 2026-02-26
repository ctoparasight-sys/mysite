// app/api/ro/stats/route.ts
//
// GET /api/ro/stats?period=week|month|year
//
// Aggregated stats for the explore page panels:
//   - submissions per bucket
//   - pageviews per bucket
//   - type breakdown per bucket
//   - mint rate per bucket
//
// Cached in KV at `stats:{period}` with 5-min TTL.

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { StoredResearchObject, ROType } from "@/types/ro";
import type { StatsResponse, StatsPeriod, TimeBucket, TypeBucket, MintBucket } from "@/types/stats";

const CACHE_TTL = 300; // 5 minutes

function getBuckets(period: StatsPeriod): { labels: string[]; dateRanges: [Date, Date][] } {
  const now = new Date();
  const labels: string[] = [];
  const dateRanges: [Date, Date][] = [];

  if (period === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      labels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
      dateRanges.push([start, end]);
    }
  } else if (period === "month") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      labels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
      dateRanges.push([start, end]);
    }
  } else {
    // year — 12 monthly buckets
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      labels.push(d.toLocaleDateString("en-US", { month: "short" }));
      dateRanges.push([start, end]);
    }
  }

  return { labels, dateRanges };
}

function getDateKeys(dateRanges: [Date, Date][]): string[][] {
  // For each bucket, return all YYYY-MM-DD strings in the range
  return dateRanges.map(([start, end]) => {
    const keys: string[] = [];
    const d = new Date(start);
    while (d < end) {
      keys.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return keys;
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") ?? "month") as StatsPeriod;

    if (!["week", "month", "year"].includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    // Check cache
    const cacheKey = `stats:${period}`;
    const cached = await kv.get<StatsResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch all RO IDs
    const ids = (await kv.lrange("ro:recent", 0, -1)) as string[];

    // Fetch all full records
    let allROs: StoredResearchObject[] = [];
    if (ids && ids.length > 0) {
      const records = await Promise.all(
        ids.map(id => kv.get<StoredResearchObject>(`ro:${id}`))
      );
      allROs = records.filter((r): r is StoredResearchObject => r !== null && r !== undefined);
    }

    const { labels, dateRanges } = getBuckets(period);
    const dateKeys = getDateKeys(dateRanges);

    // 1. Submissions per bucket
    const submissions: TimeBucket[] = labels.map((label, i) => {
      const [start, end] = dateRanges[i];
      const count = allROs.filter(ro => {
        const t = new Date(ro.timestamp).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length;
      return { label, count };
    });

    // 2. Pageviews per bucket — read from KV counters
    const allPageviewKeys = dateKeys.flat();
    const uniqueKeys = [...new Set(allPageviewKeys)];
    const pvMap: Record<string, number> = {};

    if (uniqueKeys.length > 0) {
      // Batch fetch pageview counts
      const pvResults = await Promise.all(
        uniqueKeys.map(k => kv.get<number>(`pageviews:explore:${k}`))
      );
      uniqueKeys.forEach((k, i) => {
        pvMap[k] = pvResults[i] ?? 0;
      });
    }

    const pageviews: TimeBucket[] = labels.map((label, i) => {
      const count = dateKeys[i].reduce((sum, k) => sum + (pvMap[k] ?? 0), 0);
      return { label, count };
    });

    // 3. Type breakdown per bucket
    const typeBreakdown: TypeBucket[] = labels.map((label, i) => {
      const [start, end] = dateRanges[i];
      const counts: Partial<Record<ROType, number>> = {};
      allROs.forEach(ro => {
        const t = new Date(ro.timestamp).getTime();
        if (t >= start.getTime() && t < end.getTime()) {
          counts[ro.roType] = (counts[ro.roType] ?? 0) + 1;
        }
      });
      return { label, counts };
    });

    // 4. Mint rate per bucket
    const mintRate: MintBucket[] = labels.map((label, i) => {
      const [start, end] = dateRanges[i];
      let minted = 0;
      let total = 0;
      allROs.forEach(ro => {
        const t = new Date(ro.timestamp).getTime();
        if (t >= start.getTime() && t < end.getTime()) {
          total++;
          if (ro.txHash) minted++;
        }
      });
      return { label, minted, total };
    });

    const response: StatsResponse = { period, submissions, pageviews, typeBreakdown, mintRate };

    // Cache
    await kv.set(cacheKey, response, { ex: CACHE_TTL });

    return NextResponse.json(response);
  } catch (err) {
    console.error("stats error", err);
    return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
  }
}
