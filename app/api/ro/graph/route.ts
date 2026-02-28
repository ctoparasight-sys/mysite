// app/api/ro/graph/route.ts
//
// GET /api/ro/graph
//
// Returns all ROs as a graph structure with nodes and edges.
// No auth required (public read).

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { StoredResearchObject } from "@/types/ro";

interface GraphNode {
  id: string;
  title: string;
  roType: string;
  species: string;
  minted: boolean;
  diseaseAreaTags: string[];
  confidence: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export async function GET() {
  try {
    const ids = (await kv.lrange("ro:recent", 0, -1)) as string[];

    if (!ids || ids.length === 0) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    const records = await Promise.all(
      ids.map(id => kv.get<StoredResearchObject>(`ro:${id}`))
    );

    const roMap = new Map<string, StoredResearchObject>();
    for (const r of records) {
      if (r && r.id && r.title) roMap.set(r.id, r);
    }

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    for (const ro of roMap.values()) {
      nodes.push({
        id: ro.id,
        title: ro.title,
        roType: ro.roType,
        species: ro.species,
        minted: !!ro.txHash,
        diseaseAreaTags: ro.diseaseAreaTags ?? [],
        confidence: ro.confidence,
      });

      if (ro.relationships) {
        for (const rel of ro.relationships) {
          if (rel.targetId && roMap.has(rel.targetId)) {
            edges.push({
              source: ro.id,
              target: rel.targetId,
              type: rel.type,
            });
          }
        }
      }
    }

    return NextResponse.json({ nodes, edges });
  } catch (err) {
    console.error("graph error", err);
    return NextResponse.json({ error: "Failed to build graph" }, { status: 500 });
  }
}
