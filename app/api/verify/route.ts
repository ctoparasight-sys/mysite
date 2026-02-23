import { NextResponse } from "next/server";
import { SiweMessage } from "siwe";

export async function POST(req: Request) {
  const { message, signature } = await req.json();

  const siweNonce = req.headers.get("cookie")?.match(/siwe_nonce=([^;]+)/)?.[1];

  try {
    const siweMessage = new SiweMessage(message);
    const result = await siweMessage.verify({
      signature,
      nonce: siweNonce,
    });

    // If verification succeeds, set a simple session cookie (MVP)
    const res = NextResponse.json({ ok: true, address: result.data.address });

    res.cookies.set("session_address", result.data.address, {
      httpOnly: true,
      sameSite: "none",
      secure: true, // local dev
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "verify failed" }, { status: 400 });
  }
}