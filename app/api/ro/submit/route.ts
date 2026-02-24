// app/api/ro/submit/route.ts
//
// Carrierwave — Research Object Submission Endpoint
//
// POST /api/ro/submit
//   Accepts multipart form with:
//     metadata   — JSON string of ResearchObjectInput fields
//     figure     — optional image file (≤ 20 MB)
//     dataFile   — optional data file (≤ 50 MB)
//
// Pipeline:
//   1. Read iron-session → verify wallet is signed in
//   2. Parse + validate the RO metadata
//   3. Upload any files to Vercel Blob
//   4. Compute deterministic SHA-256 content hash
//   5. Save full record to Vercel KV
//   6. Return { success, ro: { id, contentHash, ... } }
//
// GET /api/ro/submit?id=<uuid>
//   Returns a single stored RO by ID.

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { put } from "@vercel/blob";
import { kv } from "@vercel/kv";
import { createHash, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";
import type {
  ResearchObjectInput,
  StoredResearchObject,
  ROType,
  DataType,
  ExperimentalSystem,
  RelationshipType,
} from "@/types/ro";

// ── Validation ────────────────────────────────────────────────

const REQUIRED_STRINGS: (keyof ResearchObjectInput)[] = [
  "title", "abstract", "claim", "description", "methods", "species",
];

const VALID_RO_TYPES: ROType[] = [
  "new_finding", "negative_result", "replication_successful",
  "replication_unsuccessful", "methodology", "materials_reagents", "data_update",
];

const VALID_DATA_TYPES: DataType[] = [
  "expression_data", "phenotype_data", "interaction_data", "genomic",
  "cell_culture", "biochemistry", "structural_biology", "computational",
  "methodology", "ecology_evolution", "other",
];

const VALID_EXP_SYSTEMS: ExperimentalSystem[] = [
  "in_vivo", "in_vitro", "ex_vivo", "in_silico", "clinical_sample",
];

const VALID_REL_TYPES: RelationshipType[] = [
  "replicates", "contradicts", "extends", "derives_from", "uses_method_from",
];

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function validateRO(data: Partial<ResearchObjectInput>): string[] {
  const errors: string[] = [];

  // Required string fields
  for (const field of REQUIRED_STRINGS) {
    const val = data[field];
    if (!val || typeof val !== "string" || !val.trim()) {
      errors.push(`${field} is required`);
    }
  }

  // Abstract word limit
  if (data.abstract && wordCount(data.abstract) > 150) {
    errors.push("abstract must be ≤ 150 words");
  }

  // Enum checks
  if (data.roType && !VALID_RO_TYPES.includes(data.roType)) {
    errors.push(`invalid roType: ${data.roType}`);
  }
  if (data.dataType && !VALID_DATA_TYPES.includes(data.dataType)) {
    errors.push(`invalid dataType: ${data.dataType}`);
  }
  if (data.experimentalSystem && !VALID_EXP_SYSTEMS.includes(data.experimentalSystem)) {
    errors.push(`invalid experimentalSystem: ${data.experimentalSystem}`);
  }

  // Numeric ranges
  if (data.confidence !== undefined && ![1, 2, 3].includes(data.confidence)) {
    errors.push("confidence must be 1, 2, or 3");
  }
  if (data.replicateCount !== undefined && (data.replicateCount < 1 || data.replicateCount > 999)) {
    errors.push("replicateCount must be between 1 and 999");
  }

  // Reagents
  if (data.reagents !== undefined) {
    if (!Array.isArray(data.reagents)) {
      errors.push("reagents must be an array");
    } else {
      data.reagents.forEach((r, i) => {
        if (!r.name?.trim()) errors.push(`reagent[${i}].name is required`);
        if (!r.source?.trim()) errors.push(`reagent[${i}].source is required`);
      });
    }
  }

  // Relationships
  if (data.relationships !== undefined) {
    if (!Array.isArray(data.relationships)) {
      errors.push("relationships must be an array");
    } else {
      data.relationships.forEach((r, i) => {
        if (!VALID_REL_TYPES.includes(r.type)) {
          errors.push(`relationships[${i}].type is invalid`);
        }
        if (!r.targetId && !r.targetDOI) {
          errors.push(`relationships[${i}] must have targetId or targetDOI`);
        }
      });
    }
  }

  return errors;
}

// ── Content hash ──────────────────────────────────────────────
// Deterministic SHA-256 over all content fields + wallet.
// Sorting keys ensures insertion order never affects the hash.

function computeContentHash(
  ro: ResearchObjectInput,
  walletAddress: string,
  figureUrl?: string,
  dataFileUrl?: string,
): string {
  const canonical = {
    walletAddress: walletAddress.toLowerCase(),
    version: ro.version,
    species: ro.species,
    experimentalSystem: ro.experimentalSystem,
    dataType: ro.dataType,
    roType: ro.roType,
    title: ro.title,
    abstract: ro.abstract,
    claim: ro.claim,
    description: ro.description,
    methods: ro.methods,
    reagents: ro.reagents ?? [],
    confidence: ro.confidence,
    replicateCount: ro.replicateCount,
    statisticalMethod: ro.statisticalMethod,
    relationships: ro.relationships ?? [],
    hasCommercialRelevance: ro.hasCommercialRelevance,
    diseaseAreaTags: [...(ro.diseaseAreaTags ?? [])].sort(),
    ipStatus: ro.ipStatus,
    license: ro.license,
    figureUrl: figureUrl ?? null,
    dataFileUrl: dataFileUrl ?? null,
  };

  const sorted = JSON.stringify(canonical, Object.keys(canonical).sort());
  return createHash("sha256").update(sorted, "utf8").digest("hex");
}

// ── Blob upload helper ────────────────────────────────────────

async function uploadToBlob(
  file: File,
  roId: string,
  fieldName: "figure" | "data",
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const blob = await put(`ro/${roId}/${fieldName}.${ext}`, file, {
    access: "public",
    contentType: file.type || "application/octet-stream",
    addRandomSuffix: false,
  });
  return blob.url;
}

// ── KV storage ────────────────────────────────────────────────

async function saveRO(ro: StoredResearchObject): Promise<void> {
  // Primary record
  await kv.set(`ro:${ro.id}`, JSON.stringify(ro));

  // Wallet index
  const walletKey = `ro:wallet:${ro.walletAddress.toLowerCase()}`;
  const existing = (await kv.get<string[]>(walletKey)) ?? [];
  await kv.set(walletKey, [...existing, ro.id]);

  // Global recents (capped at 1000)
  await kv.lpush("ro:recent", ro.id);
  await kv.ltrim("ro:recent", 0, 999);

  // Disease tag index
  for (const tag of ro.diseaseAreaTags ?? []) {
    const tagKey = `ro:tag:${tag.toLowerCase().replace(/\s+/g, "_")}`;
    const tagIndex = (await kv.get<string[]>(tagKey)) ?? [];
    await kv.set(tagKey, [...tagIndex, ro.id]);
  }
}

// ── POST — submit a new RO ────────────────────────────────────

export async function POST(request: NextRequest) {

  // 1. Auth — must be signed in via SIWE
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  if (!session.address) {
    return NextResponse.json(
      { error: "Unauthorized — please sign in with your wallet" },
      { status: 401 },
    );
  }

  const walletAddress = session.address;

  // 2. Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const metadataRaw = formData.get("metadata");
  if (!metadataRaw || typeof metadataRaw !== "string") {
    return NextResponse.json({ error: "Missing metadata field" }, { status: 400 });
  }

  let roInput: Partial<ResearchObjectInput>;
  try {
    roInput = JSON.parse(metadataRaw);
  } catch {
    return NextResponse.json({ error: "metadata must be valid JSON" }, { status: 400 });
  }

  // 3. Validate
  const errors = validateRO(roInput);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 422 },
    );
  }

  const ro = roInput as ResearchObjectInput;

  // 4. Upload files to Blob
  const roId = randomUUID();
  let figureUrl: string | undefined;
  let dataFileUrl: string | undefined;

  const figureFile = formData.get("figure");
  if (figureFile instanceof File && figureFile.size > 0) {
    if (figureFile.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Figure file exceeds 20 MB limit" }, { status: 413 });
    }
    try {
      figureUrl = await uploadToBlob(figureFile, roId, "figure");
    } catch (err) {
      console.error("Blob upload error (figure):", err);
      return NextResponse.json({ error: "Failed to upload figure" }, { status: 500 });
    }
  }

  const dataFile = formData.get("dataFile");
  if (dataFile instanceof File && dataFile.size > 0) {
    if (dataFile.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "Data file exceeds 50 MB limit" }, { status: 413 });
    }
    try {
      dataFileUrl = await uploadToBlob(dataFile, roId, "data");
    } catch (err) {
      console.error("Blob upload error (data):", err);
      return NextResponse.json({ error: "Failed to upload data file" }, { status: 500 });
    }
  }

  // 5. Compute content hash
  const contentHash = computeContentHash(ro, walletAddress, figureUrl, dataFileUrl);

  // 6. Assemble and save
  const stored: StoredResearchObject = {
    ...ro,
    id: roId,
    walletAddress,
    contentHash,
    timestamp: new Date().toISOString(),
    figureUrl,
    dataFileUrl,
  };

  try {
    await saveRO(stored);
  } catch (err) {
    console.error("KV save error:", err);
    return NextResponse.json({ error: "Failed to save research object" }, { status: 500 });
  }

  // 7. Return
  return NextResponse.json(
    {
      success: true,
      ro: {
        id: stored.id,
        contentHash: stored.contentHash,
        timestamp: stored.timestamp,
        title: stored.title,
        walletAddress: stored.walletAddress,
        figureUrl: stored.figureUrl ?? null,
        dataFileUrl: stored.dataFileUrl ?? null,
        minted: false,
        txHash: null,
      },
    },
    { status: 201 },
  );
}

// ── GET — fetch a single RO by ID ─────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const raw = await kv.get<string>(`ro:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "Research object not found" }, { status: 404 });
  }

  try {
    const ro = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json({ ro }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Corrupted record" }, { status: 500 });
  }
}
