// types/dashboard.ts
//
// TypeScript types for the funder dashboard API.

import type { StoredBounty, StoredClaim } from "./bounty";

export interface DashboardSummary {
  totalEthLocked: number;
  activeBounties: number;
  totalClaims: number;
  pendingClaims: number;
  ethByStatus: {
    open: number;
    finalized: number;
    cancelled: number;
  };
  claimsByStatus: {
    pending: number;
    approved: number;
    rejected: number;
  };
  diseaseBreakdown: { tag: string; count: number; eth: number }[];
  timeline: { month: string; count: number }[];
}

export interface DashboardResponse {
  bounties: StoredBounty[];
  claims: StoredClaim[];
  summary: DashboardSummary;
}
