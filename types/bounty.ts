// types/bounty.ts
//
// Canonical TypeScript types for the Carrierwave Bounty Pool system.
// Import these in API routes and UI components.

export interface ScientistProfile {
  walletAddress: string;
  institutionName: string;
  institutionSplitBps: number; // 0-10000
  registeredAt: string;
  // On-chain tx that registered the profile
  txHash?: string;
  chainId?: number;
}

export type BountyStatus = "open" | "finalized" | "cancelled";

export interface StoredBounty {
  id: string;
  onChainId: number;
  funderAddress: string;
  amount: string; // ETH amount as string for precision
  diseaseTag: string;
  criteria: string;
  deadline: string; // ISO timestamp
  status: BountyStatus;
  claimCount: number;
  createdAt: string;
  txHash: string;
  chainId: number;
  finalizedTxHash?: string;
  cancelledTxHash?: string;
}

export interface BountySummary {
  id: string;
  onChainId: number;
  funderAddress: string;
  amount: string;
  diseaseTag: string;
  criteria: string;
  deadline: string;
  status: BountyStatus;
  claimCount: number;
  createdAt: string;
}

export type ClaimStatus = "pending" | "approved" | "rejected";

export interface StoredClaim {
  id: string;
  bountyId: string;
  onChainBountyId: number;
  onChainClaimIndex: number;
  scientistAddress: string;
  roId: string;
  justification: string;
  status: ClaimStatus;
  shareBps: number;
  createdAt: string;
  txHash: string;
  chainId: number;
  approvalTxHash?: string;
}
