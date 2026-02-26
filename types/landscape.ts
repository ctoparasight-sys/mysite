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
