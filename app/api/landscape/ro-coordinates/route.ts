// app/api/landscape/ro-coordinates/route.ts
//
// POST /api/landscape/ro-coordinates
//
// Given an array of RODataPoints, asks Claude Haiku to place each
// on a 2D plane (0-1) by semantic similarity and identify emergent clusters.
// No predefined axes — layout is purely content-driven.
//
// Caches in KV with 24h TTL keyed by SHA-256 of the input IDs.

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import type { RODataPoint, ROCoordinate, LandscapeClusterLabel, ROLandscapeResponse } from "@/types/landscape";

const CACHE_TTL = 86400; // 24 hours

function hashIds(ids: string[]): string {
  return crypto.createHash("sha256").update(ids.sort().join(",")).digest("hex").slice(0, 16);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

const SYSTEM_PROMPT = `You are a biomedical research analyst. You are given a list of Research Objects (ROs) — atomic units of scientific output. Each has a title, claim, abstract, type, species, and disease tags.

Your task: place each RO on a 2D plane where position reflects semantic similarity. ROs about related topics, species, or disease areas should cluster together. There are NO predefined axes — the layout is purely content-driven, like a t-SNE embedding.

Also identify 4-8 emergent clusters and give each a short label.

Respond with valid JSON only. No markdown fences, no explanation.
Schema:
{
  "coordinates": [
    { "id": "string", "x": number, "y": number }
  ],
  "clusters": [
    { "label": "string", "cx": number, "cy": number, "roIds": ["string"] }
  ]
}

Rules:
- x and y MUST be between 0.0 and 1.0
- Spread ROs across the FULL range (0.05 to 0.95) — do NOT bunch everything in the center
- Semantically similar ROs should be near each other
- Dissimilar ROs should be far apart
- Each cluster label should be 1-3 words (e.g. "Neuroscience", "CRISPR Methods", "Metabolic Disease")
- cx, cy should be the approximate center of the cluster
- Every RO must appear in exactly one cluster's roIds
- Return every RO from the input — do not skip any`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ros = body.ros as RODataPoint[];

    if (!ros || !Array.isArray(ros) || ros.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty ros array" },
        { status: 400 }
      );
    }

    // Check cache
    const ids = ros.map(r => r.id);
    const hash = hashIds(ids);
    const cacheKey = `landscape:ro-coords:${hash}`;
    const cached = await kv.get<ROLandscapeResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Build compact input for the prompt
    const compactInput = ros.map(r => ({
      id: r.id,
      title: r.title,
      claim: r.claim,
      type: r.roType,
      species: r.species,
      tags: r.diseaseAreaTags,
    }));

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Place these ${ros.length} Research Objects on a 2D semantic plane:\n\n${JSON.stringify(compactInput, null, 0)}`,
      }],
    });

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text in AI response" },
        { status: 500 }
      );
    }

    // Parse JSON — strip markdown fences if present
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsed: {
      coordinates: { id: string; x: number; y: number }[];
      clusters: { label: string; cx: number; cy: number; roIds: string[] }[];
    };

    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse ro-coordinates JSON:", jsonText);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // Build coordinate lookup
    const coordMap = new Map<string, { x: number; y: number }>();
    for (const c of parsed.coordinates) {
      coordMap.set(c.id, { x: clamp(c.x), y: clamp(c.y) });
    }

    // Build ROCoordinate array enriched with original RO data
    const roLookup = new Map(ros.map(r => [r.id, r]));
    const coordinates: ROCoordinate[] = ros.map(r => {
      const pos = coordMap.get(r.id) ?? { x: 0.5, y: 0.5 };
      return {
        id: r.id,
        x: pos.x,
        y: pos.y,
        title: r.title,
        roType: r.roType,
        species: r.species,
        confidence: r.confidence,
        minted: r.minted,
      };
    });

    // Build cluster labels with clamped centers
    const clusters: LandscapeClusterLabel[] = (parsed.clusters ?? []).map(c => ({
      label: c.label,
      cx: clamp(c.cx),
      cy: clamp(c.cy),
      roIds: c.roIds.filter(id => roLookup.has(id)),
    }));

    const result: ROLandscapeResponse = {
      coordinates,
      clusters,
      timestamp: new Date().toISOString(),
    };

    // Cache
    await kv.set(cacheKey, result, { ex: CACHE_TTL });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ro-coordinates error:", message, err);
    return NextResponse.json(
      { error: message || "Failed to generate RO coordinates" },
      { status: 500 }
    );
  }
}
