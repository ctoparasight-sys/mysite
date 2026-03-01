# Carrierwave — Claude Code Briefing

> Read this entire file before touching any code.
> This is the authoritative reference for the Carrierwave project.

---

## What is Carrierwave?

Carrierwave maps biological knowledge in real time — result by result, not paper by paper. It infers what's known, what's next, and where the value is for every stakeholder.

The core primitive is the **Research Object (RO)**: an atomic unit of scientific output — a single experimental result, negative finding, replication, method, or reagent set. Each RO is:
- Submitted through an 8-step wizard at `/upload`
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
| Chain | Ethereum Mainnet (chainId: 1) | Sepolia testnet also available |
| RPC | Alchemy | `SEPOLIA_RPC_URL` in `.env.local` |
| Contract interaction | viem | |
| Graph visualization | d3-force, d3-selection, d3-zoom | Lightweight D3 modules only |
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
│   │   └── page.tsx                  <- 8-step RO submission wizard
│   ├── dashboard/
│   │   └── page.tsx                  <- Funder dashboard (portfolio, claims queue, analytics)
│   ├── graph/
│   │   └── page.tsx                  <- Interactive D3 force-directed RO relationship graph
│   ├── ro/
│   │   └── [id]/
│   │       └── page.tsx              <- RO detail page + mint button + relationships
│   ├── profile/
│   │   ├── page.tsx                  <- Suspense wrapper (required for useSearchParams)
│   │   └── ProfileContent.tsx        <- Wallet profile + scientist profile section
│   ├── register/
│   │   └── page.tsx                  <- Scientist registration form
│   ├── bounties/
│   │   ├── page.tsx                  <- Bounty listing/browse feed
│   │   ├── create/
│   │   │   └── page.tsx              <- Bounty creation form (funders)
│   │   └── [id]/
│   │       └── page.tsx              <- Bounty detail + claim/approve/finalize
│   └── api/
│       ├── nonce/route.ts            <- SIWE nonce generation
│       ├── verify/route.ts           <- SIWE signature verification
│       ├── me/route.ts               <- Returns current session wallet address
│       ├── logout/route.ts           <- Clears iron-session cookie
│       ├── ro/
│       │   ├── submit/route.ts       <- POST: submit RO / GET: fetch by ID
│       │   ├── list/route.ts         <- GET: paginated + filtered RO feed (supports ?search=)
│       │   ├── graph/route.ts       <- GET: all ROs as graph nodes + edges
│       │   └── mint/route.ts         <- POST: save txHash after on-chain mint
│       ├── dashboard/
│       │   └── route.ts              <- GET: aggregated funder dashboard data
│       ├── scientist/
│       │   └── register/route.ts     <- POST/GET: scientist profile to/from KV
│       ├── bounty/
│       │   ├── create/route.ts       <- POST: save bounty to KV after on-chain creation
│       │   ├── list/route.ts         <- GET: paginated bounty feed with filters
│       │   ├── [id]/route.ts         <- GET: single bounty with claims
│       │   └── finalize/route.ts     <- POST: update bounty after finalize/cancel
│       └── claim/
│           ├── submit/route.ts       <- POST: save claim to KV after on-chain submission
│           └── approve/route.ts      <- POST: update claim after on-chain approval
├── contracts/
│   ├── CarrierwaveRO.sol             <- ERC-721 RO minting contract
│   ├── CarrierwaveROv2.sol           <- ERC-721 v2 with mint fee + treasury
│   ├── CWTreasury.sol                <- Revenue split contract (founder/investor/ops)
│   └── CWBountyPool.sol              <- Bounty lifecycle + escrow + institutional split
├── ignition/
│   └── modules/
│       ├── CarrierwaveRO.ts          <- Ignition deploy: CarrierwaveRO
│       ├── TreasuryAndRO.ts          <- Ignition deploy: CWTreasury + CarrierwaveROv2
│       └── BountyPool.ts             <- Ignition deploy: CWBountyPool
├── scripts/
│   └── test-bounty-lifecycle.ts      <- Full bounty lifecycle test (Sepolia)
├── lib/
│   └── session.ts                    <- iron-session config (uses SessionOptions)
├── types/
│   ├── ro.ts                         <- TypeScript types for ROs
│   ├── bounty.ts                     <- TypeScript types for bounties, claims, scientists
│   └── dashboard.ts                  <- TypeScript types for funder dashboard
├── hardhat.config.ts                 <- Hardhat 2 config with optimizer + Etherscan
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
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
DEPLOYER_PRIVATE_KEY=...              # LOCAL ONLY - never add to Vercel or GitHub
ETHERSCAN_API_KEY=...                 # LOCAL ONLY - for contract verification
NEXT_PUBLIC_CONTRACT_ADDRESS=0xEe7c58E02387548f7628e467d862483Ebb285e7f
NEXT_PUBLIC_BOUNTY_CONTRACT=0x63d28D915Ab0dF57a86547562d5f4A086d3b2A81
NEXT_PUBLIC_CHAIN_ID=1
ANTHROPIC_API_KEY=...                 # For AI landscape engine (Claude Haiku)
```

---

## Smart Contracts

All contracts verified on Etherscan (mainnet + Sepolia). Owner: `0xFDD1093EDBECD9f8cC6659F18b0E3c18366432Fd`

### CarrierwaveRO (v1)
**File:** `contracts/CarrierwaveRO.sol` | **Mainnet:** `0xbbf8A6899797139dAbDD717fc4ac8e4A2b38d10f` | **Sepolia:** `0xbbf8A6899797139dAbDD717fc4ac8e4A2b38d10f`
- `mintRO(roId, contentHash)` - mints ERC-721 token, one per contentHash
- `getRecord(tokenId)` - returns on-chain record
- `totalMinted()` / `setMintingPaused(bool)`

### CarrierwaveROv2
**File:** `contracts/CarrierwaveROv2.sol` | **Mainnet:** `0xEe7c58E02387548f7628e467d862483Ebb285e7f` | **Sepolia:** `0xB93A8033883f7d9050bbfabEf35bD6a7D09d834a`
- Same as v1 but adds `mintFee` sent to CWTreasury on each mint

### CWTreasury
**File:** `contracts/CWTreasury.sol` | **Mainnet:** `0xB93A8033883f7d9050bbfabEf35bD6a7D09d834a` | **Sepolia:** `0x852eD1fFbc473e7353D793F9FffAFbC24FAf907D`
- Receives platform fees (mint fees + bounty fees)
- `distribute()` splits balance to recipients (founder 45%, investor 45%, ops 10%)
- `setRecipients()` - owner only, must sum to 10000 bps

### CWBountyPool
**File:** `contracts/CWBountyPool.sol` | **Mainnet:** `0x63d28D915Ab0dF57a86547562d5f4A086d3b2A81` | **Sepolia:** `0xEe7c58E02387548f7628e467d862483Ebb285e7f`
- Bounty lifecycle: funders lock ETH, scientists claim with ROs, funders approve, payouts split
- 2.5% platform fee to CWTreasury (owner-adjustable, max 10%)
- Automatic scientist/institution split based on self-reported percentage
- Institution share goes to escrow if no wallet registered (12-month expiry)
- Key functions:
  - `registerScientist(institutionName, splitBps)` - self-reported, can update
  - `createBounty(diseaseTag, criteria, deadline) payable` - funder locks ETH
  - `submitClaim(bountyId, roId, justification)` - scientist links RO
  - `approveClaim(bountyId, claimIndex, shareBps)` / `rejectClaim()` - funder only
  - `finalizeBounty(bountyId)` - distributes ETH (approved shares must sum to 10000)
  - `cancelBounty(bountyId)` - refund after deadline, only if no approved claims
  - `claimEscrow(escrowId)` - pays institution after wallet registration
  - `withdrawExpiredEscrow(escrowId)` - scientist reclaims after 12 months
  - `registerInstitutionWallet(name, wallet)` - owner only (v1)

---

## KV Data Structure

```
# Research Objects
ro:{uuid}                   -> StoredResearchObject (full record JSON)
ro:recent                   -> List of IDs (lpush, newest first, max 1000)
ro:wallet:{address}         -> List of IDs submitted by this wallet
ro:tag:{tag}                -> List of IDs tagged with this disease area

# Bounty Pool
scientist:{walletAddress}   -> ScientistProfile JSON
bounty:{uuid}               -> StoredBounty JSON
bounty:recent               -> List of bounty UUIDs (lpush, max 500)
bounty:tag:{diseaseTag}     -> List of bounty UUIDs
bounty:funder:{address}     -> List of bounty UUIDs
claim:{uuid}                -> StoredClaim JSON
claim:bounty:{bountyUuid}   -> List of claim UUIDs
claim:scientist:{address}   -> List of claim UUIDs

# AI Landscape
landscape:global            -> Cached landscape JSON (1-hour TTL)
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
- 8-step submission wizard at /upload (Step 6: relationship linking)
- Explorer feed at /explore - live KV data, filters, sidebar
- RO detail page at /ro/[id] - full record, figure, mint button, relationships
- Wallet profile page at /profile - stats, type breakdown, shareable URL
- Domain carrierwave.org live on Vercel

**Phase 3 - On-chain (Sepolia + Mainnet)**
- CarrierwaveRO.sol written, compiled, deployed to Sepolia + Mainnet
- CarrierwaveROv2.sol with mint fee, deployed to Sepolia + Mainnet
- CWTreasury.sol for revenue splits, deployed to Sepolia + Mainnet
- CWBountyPool.sol deployed to Sepolia + Mainnet
- All contracts verified on both Sepolia and Mainnet Etherscan
- Mint button wired with viem on detail page
- Mint API endpoint saves txHash to KV
- Etherscan links switch automatically based on NEXT_PUBLIC_CHAIN_ID
- SIWE chainId fix deployed (reads dynamically from eth_chainId)
- App now live on Ethereum mainnet (chainId: 1)

**Phase 4 - AI landscape engine**
- POST /api/ro/landscape using Claude Haiku
- Clusters ROs by disease area, species, type
- Surfaces hot areas, gaps, replication targets, contradictions
- Wired to explorer sidebar

**Phase 5 - Bounty Pool**
- CWBountyPool.sol deployed to Sepolia and verified on Etherscan
- Full lifecycle tested: register -> create bounty -> claim -> approve -> finalize
- Platform fee (2.5%) flows to CWTreasury
- Institutional split with escrow for unregistered institutions
- Scientist registration at /register
- Bounty browse feed at /bounties
- Bounty creation at /bounties/create
- Bounty detail with claim/approve/finalize at /bounties/[id]
- 7 API routes for bounty system (scientist, bounty, claim CRUD)
- Profile page shows scientist registration status + bounty link
- "Bounties" nav link on landing page

**Phase 5.5 - RO Relationship Graph**
- Interactive force-directed graph at /graph using D3 (d3-force, d3-selection, d3-zoom)
- GET /api/ro/graph returns all ROs as nodes + edges
- Nodes colored by roType, sized by confidence, minted ROs get green ring
- Edges colored by relationship type with arrow markers (dashed for contradicts)
- Zoom, pan, drag nodes, hover highlights connected subgraph, click navigates to /ro/[id]
- 5 relationship types: replicates, contradicts, extends, derives_from, uses_method_from
- Step 6 in upload wizard: search existing ROs and link relationships during submission
- RO detail page shows outgoing + incoming relationships with colored type badges
- Search filter (?search=) added to /api/ro/list for title substring matching
- "Graph" nav link on landing page

**Phase 6 - Funder Dashboard**
- Funder dashboard at /dashboard with summary stats, portfolio, claims queue, analytics
- GET /api/dashboard aggregates all funder bounties + claims with computed summary
- Summary cards: ETH locked, active bounties, total claims, pending actions
- Portfolio tab: all bounties with quick finalize/cancel actions
- Claims queue tab: all claims across bounties with approve/reject actions
- Analytics tab: ETH by status bar, claims by status, disease breakdown, monthly timeline
- Gate screens for unauthenticated users and funders with no bounties
- Dashboard nav link on landing page (signed-in only), bounties page, bounty detail page

### Next Steps (in order)

1. Phase 7 - reputation, DOI minting, IPFS

---

## Deployment

```bash
npm run build          # check before deploying
npx vercel --prod      # deploy to production
npx hardhat compile    # compile contracts (optimizer enabled)

# Deploy a contract to Sepolia
npx hardhat ignition deploy ignition/modules/BountyPool.ts --network sepolia \
  --parameters '{"BountyPoolModule": {"founderWallet": "0xFDD1093EDBECD9f8cC6659F18b0E3c18366432Fd", "treasuryAddress": "0x852eD1fFbc473e7353D793F9FffAFbC24FAf907D"}}'

# Verify a contract on Etherscan
npx hardhat verify --network sepolia <address> <constructor args...>

# Run bounty lifecycle test
npx hardhat run scripts/test-bounty-lifecycle.ts --network sepolia
```

---

## Hard Rules - Never Violate These

1. No Tailwind - all styling is inline
2. No em dashes in SIWE statement strings or Solidity string literals
3. SESSION_SECRET must be in Vercel env vars
4. Profile page needs Suspense wrapper for useSearchParams
5. Use Hardhat 2 only - not Hardhat 3
6. DEPLOYER_PRIVATE_KEY and ETHERSCAN_API_KEY stay in .env.local only
7. lib/session.ts uses SessionOptions not IronSessionOptions
8. Ignition Lock.ts was deleted - do not recreate it
9. Wordmark is always Helvetica - never change it
10. Solidity optimizer must stay enabled (CWBountyPool exceeds 24KB without it)

---

## Founder

- Name: Ido
- Wallet: `0xFDD1093EDBECD9f8cC6659F18b0E3c18366432Fd`
- Role: Founder, contract owner, sole developer (with Claude)
- Domain registrar: Namecheap
- Blockchain RPC: Alchemy (Sepolia)
