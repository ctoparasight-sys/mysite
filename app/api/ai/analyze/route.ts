import { NextResponse } from "next/server";

type AnalyzeRequest = {
  text: string;
};

type AnalyzeResponse = {
  summary: string;
  diseases: { name: string; confidence: number }[];
  tags: { name: string; confidence: number }[];
  confidence: number;
};

function pickFromLexicon(text: string, lexicon: string[]) {
  const t = text.toLowerCase();
  const hits = lexicon
    .map((name) => {
      const n = name.toLowerCase();
      const hit = t.includes(n);
      return hit ? { name, confidence: 0.7 } : null;
    })
    .filter(Boolean) as { name: string; confidence: number }[];
  return hits.slice(0, 5);
}

function naiveSummary(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "No content provided.";
  // crude “first sentence-ish” summary
  const cut = clean.split(/(?<=[.!?])\s+/)[0] ?? clean;
  return cut.length > 220 ? cut.slice(0, 220) + "…" : cut;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<AnalyzeRequest>;
  const text = (body.text ?? "").toString();

  // Very small starter lexicons (we can expand later)
  const diseaseLexicon = [
    "Parkinson",
    "Alzheimer",
    "ALS",
    "Huntington",
    "diabetes",
    "cancer",
    "COVID",
    "autism",
    "schizophrenia",
    "multiple sclerosis",
  ];

  const tagLexicon = [
    "mouse",
    "zebrafish",
    "human",
    "CRISPR",
    "RNA-seq",
    "single-cell",
    "western blot",
    "immunofluorescence",
    "ELISA",
    "mass spectrometry",
    "organoid",
  ];

  const diseases = pickFromLexicon(text, diseaseLexicon);
  const tags = pickFromLexicon(text, tagLexicon);

  const summary = naiveSummary(text);

  const response: AnalyzeResponse = {
    summary,
    diseases,
    tags,
    confidence: Math.min(
      0.9,
      0.3 + 0.15 * diseases.length + 0.1 * tags.length
    ),
  };

  return NextResponse.json(response);
}