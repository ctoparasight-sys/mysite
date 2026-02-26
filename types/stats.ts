// types/stats.ts
//
// TypeScript types for the explore stats panels.

import type { ROType } from "./ro";

export type StatsPeriod = "week" | "month" | "year";

export interface TimeBucket {
  label: string;   // e.g. "Feb 20" or "Jan"
  count: number;
}

export interface TypeBucket {
  label: string;
  counts: Partial<Record<ROType, number>>;
}

export interface MintBucket {
  label: string;
  minted: number;
  total: number;
}

export interface StatsResponse {
  period: StatsPeriod;
  submissions: TimeBucket[];
  pageviews: TimeBucket[];
  typeBreakdown: TypeBucket[];
  mintRate: MintBucket[];
}
