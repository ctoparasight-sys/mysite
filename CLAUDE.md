# Carrierwave — Claude Code Briefing

> Read this entire file before touching any code.
> This is the authoritative reference for the Carrierwave project.

---

## What is Carrierwave?

Carrierwave maps biological knowledge in real time — result by result, not paper by paper. It infers what's known, what's next, and where the value is for every stakeholder.

The core primitive is the **Research Object (RO)**: an atomic unit of scientific output — a single experimental result, negative finding, replication, method, or reagent set. Each RO is:
- Submitted through a 7-step wizard at `/upload`
- Hashed (SHA-256) on submission for content integrity
- Stored in Vercel KV (Redis)
- Browsable in a live explorer feed at `/explore`
- Viewable with full detail at `/ro/[id]`
- Mintable as an ERC-721 NFT on Ethereum Sepolia (mainnet coming soon)

**Live at:** https://carrierwave.org  
**GitHub:** `ctoparasight-sys/mysite`  
**Vercel project:** `ctoparasight-sys-projects/mysite`

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16.1.6, App Router, TypeScript | |
| Styling | Inline CSS via `<style>` JSX tags | NO Tailwind, no CSS modules |
| Auth | Sign-In with Ethereum (SIWE) + iron-session | |
| Storage | Vercel KV (Redis) + Vercel Blob | |
| Deployment | Vercel, auto-deploy from GitHub `main` | |
| Smart contract | Hardhat 2, Solidity 0.8.28, OpenZeppelin | Hardhat 3 was removed — use v2 only |
| Chain | Ethereum Sepolia testnet (chainId: 11155111) | Mainnet deployment is next |
| RPC | Alchemy | `SEPOLIA_RPC_URL` in `.env.local` |
| Contract interaction | viem | |
| Headline font | Space Grotesk 700 | |
| Body font | DM Sans | |
| Mono font | DM Mono | |
| Wordmark | Helvetica | Hardcoded — never change |

---

## Project Structure

```
/Users/dogbach/mysite/
├── app/
│   ├── page.tsx                      <- Landing page + wallet sign-in
│   ├── explore/
│   │   └── page.tsx                  <- RO explorer feed (live KV data)
│   ├── upload/
│   │   └── page.tsx                  <- 7-step RO submission wizard
│   ├── ro/
│   │   └── [id]/
│   │       └── page.tsx              <- RO detail page + mint button
│   ├── profile/
│   │   ├── page.tsx                  <- Suspense wrapper (required for useSearchParams)
│   │   └── ProfileContent.tsx        <- Wallet profile page content
│   └── api/
│       ├── nonce/route.ts            <- SIWE nonce generation
│       ├── verify/route.ts           <- SIWE signature verification
│       ├── me/route.ts               <- Returns current session wallet address
│       ├── logout/route.ts           <- Clears iron-session cookie
│       └── ro/
│           ├── submit/route.ts       <- POST: submit RO / GET: fetch by ID
│           ├── list/route.ts         <- GET: paginated + filtered RO feed
│           └── mint/route.ts         <- POST: save txHash after on-chain mint
├── contracts/
│   └── CarrierwaveRO.sol             <- ERC-721 smart contract
├── ignition/
│   └── modules/
│       └── CarrierwaveRO.ts          <- Hardhat Ignition deploy script
├── lib/
│   └── session.ts                    <- iron-session config (uses SessionOptions)
├── types/
│   └── ro.ts                         <- All TypeScript types for ROs
├── hardhat.config.ts                 <- Hardhat 2 config with Sepolia network
├── CLAUDE.md                         <- This file
└── .env.local                        <- All secrets (gitignored, never commit)
```

---

## Environment Variables

All of these must be present in `.env.local` for local dev.
All except `DEPLOYER_PRIVATE_KEY` must also be set in Vercel dashboard.

```
SESSION_SECRET=...
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
BLOB_READ_WRITE_TOKEN=...
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
DEPLOYER_PRIVATE_KEY=...              # LOCAL ONLY - never add to Vercel or GitHub
NEXT_PUBLIC_CONTRACT_ADDRESS=0xbbf8A6899797139dAbDD717fc4ac8e4A2b38d10f
NEXT_PUBLIC_CHAIN_ID=11155111
```

---

## Smart Contract

**File:** `contracts/CarrierwaveRO.sol`
**Standard:** ERC-721
**Deployed on Sepolia:** `0xbbf8A6899797139dAbDD717fc4ac8e4A2b38d10f`
**Contract owner (founder):** `0xFDD1093EDBECD9f8cC6659F18b0E3c18366432Fd`

Key functions:
- `mintRO(string roId, string contentHash)` - mints a token. Only callable by the submitting wallet. One token per contentHash.
- `getRecord(uint256 tokenId)` - returns full on-chain record
- `totalMinted()` - returns total minted count
- `setMintingPaused(bool)` - founder only emergency pause

---

## KV Data Structure

```
ro:{uuid}             -> StoredResearchObject (full record JSON)
ro:recent             -> List of IDs (lpush, newest first, max 1000)
ro:wallet:{address}   -> List of IDs submitted by this wallet
ro:tag:{tag}          -> List of IDs tagged with this disease area
```

---

## Auth Flow

1. User clicks "Sign in with wallet"
2. Frontend calls `/api/nonce` to get a one-time nonce
3. Detects current chainId from wallet via `eth_chainId`
4. Constructs SIWE message (statement must use plain ASCII - no em dashes)
5. User signs with wallet
6. Frontend POSTs `{ message, signature }` to `/api/verify`
7. Server verifies, saves `address` to iron-session cookie
8. `/api/me` returns `{ address }` for client-side session restore

---

## Design System

```
--bg:      #080b11
--surface: #0f1420
--surface2:#131926
--border:  #1a2035
--muted:   #2e3650
--subtle:  #4a5580
--text:    #c8d0e8
--bright:  #e8edf8
--accent:  #4f8cff   (blue - primary)
--accent2: #2eddaa   (green - success/on-chain)
--warn:    #ff9f43   (orange - preliminary)
--danger:  #ff6b6b   (red - errors)
```

All styling is inline inside each page's `<style>` JSX tag.
Do not introduce Tailwind, CSS modules, or external stylesheets.

---

## Current Status (Feb 2026)

### Complete

**Phase 1 - Data layer**
- Wallet auth (SIWE + iron-session)
- Vercel KV + Blob storage
- RO submit, list, and single-fetch endpoints

**Phase 2 - UI**
- Landing page with knowledge-map messaging and Space Grotesk headlines
- 7-step submission wizard at /upload
- Explorer feed at /explore - live KV data, filters, sidebar
- RO detail page at /ro/[id] - full record, figure, mint button
- Wallet profile page at /profile - stats, type breakdown, shareable URL
- Domain carrierwave.org live on Vercel

**Phase 3 - On-chain (Sepolia)**
- CarrierwaveRO.sol written, compiled, deployed to Sepolia
- Mint button wired with viem on detail page
- Mint API endpoint saves txHash to KV
- Sepolia Etherscan link shown after mint
- First RO successfully minted on Sepolia
- "My profile" nav link on landing page (signed-in users only)
- SIWE chainId fix deployed (reads dynamically from eth_chainId, not hardcoded to 1)

### Next Steps (in order)

1. Verify sign-in works after chainId fix on carrierwave.org
2. Deploy contract to Ethereum mainnet
   - Update NEXT_PUBLIC_CONTRACT_ADDRESS and NEXT_PUBLIC_CHAIN_ID=1
   - Update mint button chain switch from 0xaa36a7 to 0x1
3. Phase 4 - AI landscape engine
   - POST /api/ro/landscape using Claude API
   - Cluster ROs by disease area, species, type
   - Surface hot areas, gaps, replication targets, contradictions
   - Wire to explorer sidebar (currently shows placeholder)
4. Relationship graph between ROs
5. Funder dashboard
6. Phase 5 - value distribution, reputation, DOI minting, IPFS

---

## Deployment

```bash
npm run build          # check before deploying
npx vercel --prod      # deploy to production
npx hardhat compile    # compile contract
```

---

## Hard Rules - Never Violate These

1. No Tailwind - all styling is inline
2. No em dashes in SIWE statement strings
3. SESSION_SECRET must be in Vercel env vars
4. Profile page needs Suspense wrapper for useSearchParams
5. Use Hardhat 2 only - not Hardhat 3
6. DEPLOYER_PRIVATE_KEY stays in .env.local only
7. lib/session.ts uses SessionOptions not IronSessionOptions
8. Ignition Lock.ts was deleted - do not recreate it
9. Wordmark is always Helvetica - never change it

---

## Founder

- Name: Ido
- Wallet: `0xFDD1093EDBECD9f8cC6659F18b0E3c18366432Fd`
- Role: Founder, contract owner, sole developer (with Claude)
- Domain registrar: Namecheap
- Blockchain RPC: Alchemy (Sepolia)
