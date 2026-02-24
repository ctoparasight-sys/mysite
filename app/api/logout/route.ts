// app/api/logout/route.ts
//
// Destroys the iron-session, clearing the address and any
// other session data. The signed cookie is overwritten with
// an empty, immediately-expired value.

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  session.destroy();

  return NextResponse.json({ ok: true });
}
