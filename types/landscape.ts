// types/landscape.ts
//
// TypeScript types for the AI Landscape Engine report.

export interface LandscapeItem {
  label: string;
  detail?: string;
}

export interface LandscapeCluster {
  name: string;
  roCount: number;
  species: string[];
  types: string[];
}

export interface LandscapeReport {
  status: "ok" | "insufficient_data";
  generatedAt: string;
  roCount: number;
  headline: string;
  summary: string;
  hotAreas: LandscapeItem[];
  gaps: LandscapeItem[];
  replicationTargets: LandscapeItem[];
  contradictions: LandscapeItem[];
  clusters: LandscapeCluster[];
}

// ── 2D RO Landscape Coordinates ───────────────────────────────

export interface RODataPoint {
  id: string;
  title: string;
  claim: string;
  abstract: string;
  roType: string;
  species: string;
  confidence: number;       // 1 | 2 | 3
  diseaseAreaTags: string[];
  minted: boolean;
}

export interface ROCoordinate {
  id: string;
  x: number;   // normalized 0-1
  y: number;   // normalized 0-1
  title: string;
  roType: string;
  species: string;
  confidence: number;
  minted: boolean;
}

export interface LandscapeClusterLabel {
  label: string;
  cx: number;   // cluster center x (0-1)
  cy: number;   // cluster center y (0-1)
  roIds: string[];
}

export interface ROLandscapeResponse {
  coordinates: ROCoordinate[];
  clusters: LandscapeClusterLabel[];
  timestamp: string;
}
