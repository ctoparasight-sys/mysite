// lib/session.ts
//
// Single source of truth for iron-session configuration.
// Import { sessionOptions, SessionData } into any API route
// that needs to read or write the session.
//
// iron-session encrypts and signs the cookie with SESSION_SECRET,
// so it cannot be forged or tampered with client-side.
//
// Add SESSION_SECRET to your .env.local:
//   SESSION_SECRET=a-random-string-at-least-32-characters-long
//
// Generate one quickly:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

import type { IronSessionOptions } from "iron-session";

export interface SessionData {
  address?: string;   // checksummed Ethereum address, set after SIWE verify
  nonce?: string;     // one-time SIWE challenge, cleared after verify
}

export const sessionOptions: IronSessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "carrierwave_session",
  cookieOptions: {
    // In production (HTTPS) this must be true.
    // For local dev over HTTP set COOKIE_SECURE=false in .env.local.
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  },
};
