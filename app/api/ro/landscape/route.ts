// app/api/ro/landscape/route.ts
//
// GET /api/ro/landscape
//
// AI-powered landscape analysis of all submitted ROs.
// Calls Claude Haiku to identify hot areas, gaps, replication targets,
// and contradictions. Caches result in KV with 1-hour TTL.
//
// Query params:
//   refresh=true  — bypass cache and regenerate

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";
import type { StoredResearchObject } from "@/types/ro";
import type { LandscapeReport } from "@/types/landscape";

const CACHE_KEY = "landscape:global";
const CACHE_TTL = 3600; // 1 hour
const MAX_ROS = 200;
const MIN_ROS = 3;

function compactRO(ro: StoredResearchObject) {
  return {
    title: ro.title,
    claim: ro.claim,
    type: ro.roType,
    species: ro.species,
    diseaseTags: ro.diseaseAreaTags,
    confidence: ro.confidence,
    relationships: ro.relationships?.map(r => ({
      type: r.type,
      note: r.note,
    })) ?? [],
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const refresh = searchParams.get("refresh") === "true";

    // Check cache first (unless refresh requested)
    if (!refresh) {
      const cached = await kv.get<LandscapeReport>(CACHE_KEY);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // Fetch all RO IDs from the recent list
    const ids = (await kv.lrange("ro:recent", 0, MAX_ROS - 1)) as string[];

    if (!ids || ids.length < MIN_ROS) {
      const insufficientReport: LandscapeReport = {
        status: "insufficient_data",
        generatedAt: new Date().toISOString(),
        roCount: ids?.length ?? 0,
        headline: "",
        summary: "",
        hotAreas: [],
        gaps: [],
        replicationTargets: [],
        contradictions: [],
        clusters: [],
      };
      return NextResponse.json(insufficientReport);
    }

    // Fetch full records
    const records = await Promise.all(
      ids.map(id => kv.get<StoredResearchObject>(`ro:${id}`))
    );
    const ros = records.filter(
      (r): r is StoredResearchObject => r !== null && r !== undefined
    );

    if (ros.length < MIN_ROS) {
      const insufficientReport: LandscapeReport = {
        status: "insufficient_data",
        generatedAt: new Date().toISOString(),
        roCount: ros.length,
        headline: "",
        summary: "",
        hotAreas: [],
        gaps: [],
        replicationTargets: [],
        contradictions: [],
        clusters: [],
      };
      return NextResponse.json(insufficientReport);
    }

    // Build compact summaries for the prompt
    const compactData = ros.map(compactRO);

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: `You are a biomedical research analyst for Carrierwave, a platform that maps biological knowledge in real time. You analyze collections of Research Objects (ROs) - atomic units of scientific output - and produce structured landscape reports.

Always respond with valid JSON matching this exact schema:
{
  "headline": "string - a single italicized-style sentence capturing the most important pattern",
  "summary": "string - 2-3 sentences summarizing the overall state of the research landscape",
  "hotAreas": [{"label": "string", "detail": "string (optional)"}],
  "gaps": [{"label": "string", "detail": "string (optional)"}],
  "replicationTargets": [{"label": "string", "detail": "string (optional)"}],
  "contradictions": [{"label": "string", "detail": "string (optional)"}],
  "clusters": [{"name": "string", "roCount": number, "species": ["string"], "types": ["string"]}]
}

Rules:
- hotAreas: 2-5 items. Active research areas with the most submissions or strongest signals.
- gaps: 2-4 items. Missing areas that would strengthen the knowledge map.
- replicationTargets: 1-3 items. Findings that most need independent replication.
- contradictions: 0-3 items. Only include if there are genuine conflicting results.
- clusters: Group ROs by disease area or topic. Each cluster should have at least 1 RO.
- Keep all text concise. Labels should be under 60 characters.
- Be specific to the actual data. Do not hallucinate findings not present in the input.`,
      messages: [
        {
          role: "user",
          content: `Analyze these ${ros.length} Research Objects and produce a landscape report:\n\n${JSON.stringify(compactData, null, 0)}`,
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text in AI response" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let parsed: {
      headline: string;
      summary: string;
      hotAreas: { label: string; detail?: string }[];
      gaps: { label: string; detail?: string }[];
      replicationTargets: { label: string; detail?: string }[];
      contradictions: { label: string; detail?: string }[];
      clusters: { name: string; roCount: number; species: string[]; types: string[] }[];
    };

    try {
      // Handle potential markdown code fences in the response
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse landscape JSON:", textBlock.text);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const report: LandscapeReport = {
      status: "ok",
      generatedAt: new Date().toISOString(),
      roCount: ros.length,
      headline: parsed.headline ?? "",
      summary: parsed.summary ?? "",
      hotAreas: parsed.hotAreas ?? [],
      gaps: parsed.gaps ?? [],
      replicationTargets: parsed.replicationTargets ?? [],
      contradictions: parsed.contradictions ?? [],
      clusters: parsed.clusters ?? [],
    };

    // Cache in KV with 1-hour TTL
    await kv.set(CACHE_KEY, report, { ex: CACHE_TTL });

    return NextResponse.json(report);
  } catch (err) {
    console.error("landscape error", err);
    return NextResponse.json(
      { error: "Failed to generate landscape report" },
      { status: 500 }
    );
  }
}
