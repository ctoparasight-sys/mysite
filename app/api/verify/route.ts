// app/api/verify/route.ts
//
// Verifies a SIWE signature against the nonce stored in the
// iron-session cookie, then upgrades the session with the
// verified wallet address.
//
// Security properties:
//   - Nonce is read from the signed session (cannot be forged)
//   - Nonce is cleared after use (replay-proof)
//   - Address stored is the one SIWE verified (not the one the
//     client claims), so it cannot be spoofed

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SiweMessage } from "siwe";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  const { message, signature } = await req.json();

  // Nonce must exist in the session — reject anything without it
  if (!session.nonce) {
    return NextResponse.json(
      { ok: false, error: "No nonce found. Please request a new nonce." },
      { status: 400 },
    );
  }

  try {
    const siweMessage = new SiweMessage(message);
    const result = await siweMessage.verify({
      signature,
      nonce: session.nonce,
    });

    // Verification passed — store address, clear nonce
    session.address = result.data.address;
    session.nonce = undefined;
    await session.save();

    return NextResponse.json({ ok: true, address: result.data.address });

  } catch (e: unknown) {
    // Clear the session on failure to force a fresh sign-in
    session.address = undefined;
    session.nonce = undefined;
    await session.save();

    const message = e instanceof Error ? e.message : "Verification failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}
