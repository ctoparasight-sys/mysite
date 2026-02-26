// app/api/stats/pageview/route.ts
//
// POST /api/stats/pageview
// Fire-and-forget daily pageview counter for the explore page.
// Increments `pageviews:explore:YYYY-MM-DD` in Vercel KV.

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function POST() {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await kv.incr(`pageviews:explore:${today}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("pageview incr error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
