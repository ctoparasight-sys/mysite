// lib/submitRO.ts
//
// Client-side helper that packages the RO form state and any
// files into a multipart POST to /api/ro/submit.
//
// Usage in your form component:
//   import { submitRO } from "@/lib/submitRO";
//   const result = await submitRO(formData, figureFile, dataFile);
//   if (result.success) router.push(`/ro/${result.ro.id}`);

export interface SubmitROResult {
  success: true;
  ro: {
    id: string;
    contentHash: string;
    timestamp: string;
    title: string;
    walletAddress: string;
    figureUrl: string | null;
    dataFileUrl: string | null;
    minted: boolean;
    txHash: string | null;
  };
}

export interface SubmitROError {
  success: false;
  error: string;
  details?: string[];
}

export async function submitRO(
  metadata: object,
  figureFile?: File | null,
  dataFile?: File | null,
): Promise<SubmitROResult | SubmitROError> {

  const form = new FormData();
  form.append("metadata", JSON.stringify(metadata));
  if (figureFile) form.append("figure", figureFile);
  if (dataFile) form.append("dataFile", dataFile);

  let response: Response;
  try {
    // Do NOT set Content-Type — browser sets it with the correct boundary
    response = await fetch("/api/ro/submit", { method: "POST", body: form });
  } catch {
    return { success: false, error: "Network error — check your connection" };
  }

  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    return { success: false, error: `Unexpected server response (HTTP ${response.status})` };
  }

  if (!response.ok) {
    return {
      success: false,
      error: (body.error as string) ?? "Submission failed",
      details: body.details as string[] | undefined,
    };
  }

  return body as unknown as SubmitROResult;
}

// Fetch a single RO by ID — use in detail pages
export async function fetchRO(id: string) {
  const res = await fetch(`/api/ro/submit?id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const { ro } = await res.json();
  return ro;
}
