// types/ro.ts
//
// Canonical TypeScript types for Carrierwave Research Objects.
// Import these in API routes and UI components alike.

export type ROType =
  | "new_finding"
  | "negative_result"
  | "replication_successful"
  | "replication_unsuccessful"
  | "methodology"
  | "materials_reagents"
  | "data_update";

export type DataType =
  | "expression_data"
  | "phenotype_data"
  | "interaction_data"
  | "genomic"
  | "cell_culture"
  | "biochemistry"
  | "structural_biology"
  | "computational"
  | "methodology"
  | "ecology_evolution"
  | "other";

export type ExperimentalSystem =
  | "in_vivo"
  | "in_vitro"
  | "ex_vivo"
  | "in_silico"
  | "clinical_sample";

export type ConfidenceLevel = 1 | 2 | 3;

export type StatisticalMethod =
  | "none"
  | "t_test"
  | "anova"
  | "chi_square"
  | "mann_whitney"
  | "fisher_exact"
  | "linear_regression"
  | "survival_analysis"
  | "other";

export type RelationshipType =
  | "replicates"
  | "contradicts"
  | "extends"
  | "derives_from"
  | "uses_method_from";

export type IPStatus =
  | "no_restrictions"
  | "institutional_review_pending"
  | "licensed";

export type License = "CC-BY-4.0" | "delayed_commercial";

export interface Reagent {
  name: string;
  type: "strain" | "antibody" | "plasmid" | "chemical" | "cell_line" | "other";
  identifier: string;
  source: string;
}

export interface RORelationship {
  type: RelationshipType;
  targetId?: string;   // ID of another Carrierwave RO
  targetDOI?: string;  // DOI of an external paper
  note?: string;
}

// What the client submits
export interface ResearchObjectInput {
  version: number;
  orcid?: string;
  species: string;
  experimentalSystem: ExperimentalSystem;
  dataType: DataType;
  roType: ROType;
  title: string;
  abstract: string;
  claim: string;
  description: string;
  methods: string;
  reagents: Reagent[];
  confidence: ConfidenceLevel;
  replicateCount: number;
  statisticalMethod: StatisticalMethod;
  relationships: RORelationship[];
  hasCommercialRelevance: boolean;
  diseaseAreaTags: string[];
  ipStatus: IPStatus;
  license: License;
}

// What is stored in KV (input + server-assigned fields)
export interface StoredResearchObject extends ResearchObjectInput {
  id: string;
  walletAddress: string;
  contentHash: string;
  timestamp: string;
  figureUrl?: string;
  dataFileUrl?: string;
  // Populated after minting
  txHash?: string;
  chainId?: number;
  tokenId?: string;
}

// Slim shape returned by the list endpoint
export interface ROSummary {
  id: string;
  walletAddress: string;
  contentHash: string;
  timestamp: string;
  roType: ROType;
  dataType: DataType;
  species: string;
  experimentalSystem: ExperimentalSystem;
  title: string;
  abstract: string;
  claim: string;
  confidence: ConfidenceLevel;
  replicateCount: number;
  hasCommercialRelevance: boolean;
  diseaseAreaTags: string[];
  relationshipCount: number;
  minted: boolean;
  figureUrl?: string;
}
