import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: Request) {
  const form = await req.formData();

  const file = form.get("file") as File | null;
  const title = (form.get("title") as string | null) ?? "";
  const summary = (form.get("summary") as string | null) ?? "";
  const hash = (form.get("hash") as string | null) ?? "";

  if (!file || !title || !hash) {
    return NextResponse.json(
      { error: "Missing required fields: file, title, hash" },
      { status: 400 }
    );
  }

  // Upload the file to Vercel Blob
  const fileBlob = await put(`ro/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  // Create metadata JSON (for tokenURI later)
  const metadata = {
    name: title,
    description: summary,
    createdAt: new Date().toISOString(),
    contentHashSha256: hash,
    file: {
      name: file.name,
      size: file.size,
      type: file.type,
      url: fileBlob.url,
    },
    // Optional: add fields later (authors, lab, methods, diseases, etc.)
  };

  // Upload metadata JSON as well
  const metadataBlob = await put(
    `ro/${Date.now()}-metadata.json`,
    JSON.stringify(metadata, null, 2),
    { access: "public", contentType: "application/json" }
  );

  return NextResponse.json({
    ok: true,
    fileUrl: fileBlob.url,
    metadataUrl: metadataBlob.url,
    metadata,
  });
}