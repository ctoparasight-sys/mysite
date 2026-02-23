import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const addr = cookieStore.get("session_address")?.value || null;
  return NextResponse.json({ address: addr });
}