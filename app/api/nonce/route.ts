// app/api/nonce/route.ts
//
// Issues a one-time SIWE challenge nonce and stores it
// inside the signed iron-session cookie.
// Replaces the previous plain siwe_nonce cookie.

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { generateNonce } from "siwe";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function GET() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  // Generate a fresh nonce and store it in the session
  session.nonce = generateNonce();
  await session.save();

  return NextResponse.json({ nonce: session.nonce });
}
