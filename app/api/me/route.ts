// app/api/me/route.ts
//
// Returns the currently signed-in wallet address from the
// iron-session cookie, or null if not signed in.
// Used by the frontend on every page load to restore auth state.

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function GET() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  return NextResponse.json({
    address: session.address ?? null,
  });
}
