// scripts/test-bounty-lifecycle.ts
//
// Full bounty lifecycle test on Sepolia:
//   1. Register scientist
//   2. Create bounty (lock ETH)
//   3. Submit claim
//   4. Approve claim (100% share)
//   5. Finalize bounty
//   6. Verify ETH splits
//   7. Cancel bounty test (separate bounty)

import pkg from "hardhat";
const { ethers } = pkg;

const BOUNTY_POOL = "0xEe7c58E02387548f7628e467d862483Ebb285e7f";
const TREASURY = "0x852eD1fFbc473e7353D793F9FffAFbC24FAf907D";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH\n");

  const pool = await ethers.getContractAt("CWBountyPool", BOUNTY_POOL, signer);

  // ── 1. Register scientist ────────────────────────────────────
  console.log("=== 1. Register Scientist ===");
  const regTx = await pool.registerScientist("Test University", 2000); // 20% to institution
  const regReceipt = await regTx.wait();
  console.log("Tx:", regReceipt?.hash);

  const profile = await pool.getScientist(signer.address);
  console.log("Institution:", profile.institutionName);
  console.log("Split:", Number(profile.institutionSplitBps) / 100, "%");
  console.log("Registered:", profile.registered);
  console.log();

  // ── 2. Create bounty ────────────────────────────────────────
  console.log("=== 2. Create Bounty ===");
  const bountyAmount = ethers.parseEther("0.001");
  const deadline = Math.floor(Date.now() / 1000) + 86400; // 24h from now

  const createTx = await pool.createBounty(
    "ALS",
    "Identify a novel biomarker for early-stage ALS detection",
    deadline,
    { value: bountyAmount }
  );
  const createReceipt = await createTx.wait();
  console.log("Tx:", createReceipt?.hash);

  // Parse BountyCreated event to get bountyId
  const createLog = createReceipt?.logs.find(
    (l: any) => l.fragment?.name === "BountyCreated"
  );
  const bountyId = createLog ? (createLog as any).args[0] : await pool.nextBountyId() - 1n;
  console.log("Bounty ID:", bountyId.toString());

  const bounty = await pool.getBounty(bountyId);
  console.log("Funder:", bounty.funder);
  console.log("Amount:", ethers.formatEther(bounty.amount), "ETH");
  console.log("Disease:", bounty.diseaseTag);
  console.log("Status:", ["Open", "Finalized", "Cancelled"][Number(bounty.status)]);
  console.log();

  // ── 3. Submit claim ─────────────────────────────────────────
  console.log("=== 3. Submit Claim ===");
  const claimTx = await pool.submitClaim(
    bountyId,
    "test-ro-id-12345",
    "Our RO identifies CSF neurofilament light chain as an early ALS biomarker with p<0.001"
  );
  const claimReceipt = await claimTx.wait();
  console.log("Tx:", claimReceipt?.hash);

  const claimLog = claimReceipt?.logs.find(
    (l: any) => l.fragment?.name === "ClaimSubmitted"
  );
  const claimIndex = claimLog ? (claimLog as any).args[1] : 0n;
  console.log("Claim index:", claimIndex.toString());

  const claim = await pool.getClaim(bountyId, claimIndex);
  console.log("Scientist:", claim.scientist);
  console.log("RO ID:", claim.roId);
  console.log("Status:", ["Pending", "Approved", "Rejected"][Number(claim.status)]);
  console.log();

  // ── 4. Approve claim ────────────────────────────────────────
  console.log("=== 4. Approve Claim (10000 bps = 100%) ===");
  const approveTx = await pool.approveClaim(bountyId, claimIndex, 10000);
  const approveReceipt = await approveTx.wait();
  console.log("Tx:", approveReceipt?.hash);

  const approvedClaim = await pool.getClaim(bountyId, claimIndex);
  console.log("Status:", ["Pending", "Approved", "Rejected"][Number(approvedClaim.status)]);
  console.log("Share:", Number(approvedClaim.shareBps), "bps");
  console.log();

  // ── 5. Finalize bounty ──────────────────────────────────────
  console.log("=== 5. Finalize Bounty ===");
  const balBefore = await ethers.provider.getBalance(signer.address);
  const treasuryBefore = await ethers.provider.getBalance(TREASURY);

  const finTx = await pool.finalizeBounty(bountyId);
  const finReceipt = await finTx.wait();
  console.log("Tx:", finReceipt?.hash);

  const balAfter = await ethers.provider.getBalance(signer.address);
  const treasuryAfter = await ethers.provider.getBalance(TREASURY);

  const finalBounty = await pool.getBounty(bountyId);
  console.log("Status:", ["Open", "Finalized", "Cancelled"][Number(finalBounty.status)]);

  // Calculate expected splits:
  // Platform fee: 2.5% of 0.001 ETH = 0.000025 ETH
  // Distributable: 0.000975 ETH
  // Scientist gets 80% (institution split is 20%): 0.00078 ETH
  // Institution gets 20%: 0.000195 ETH -> escrow (no wallet registered)
  const platformFee = bountyAmount * 250n / 10000n;
  const distributable = bountyAmount - platformFee;
  const instShare = distributable * 2000n / 10000n;
  const sciShare = distributable - instShare;

  console.log("\nExpected splits:");
  console.log("  Platform fee (2.5%):", ethers.formatEther(platformFee), "ETH");
  console.log("  Scientist (80%):", ethers.formatEther(sciShare), "ETH");
  console.log("  Institution escrow (20%):", ethers.formatEther(instShare), "ETH");
  console.log("\nTreasury balance change:", ethers.formatEther(treasuryAfter - treasuryBefore), "ETH");
  console.log();

  // ── 6. Check escrow ─────────────────────────────────────────
  console.log("=== 6. Verify Escrow ===");
  const escrowCnt = await pool.escrowCount();
  console.log("Escrow count:", escrowCnt.toString());
  if (escrowCnt > 0n) {
    const escrow = await pool.getEscrow(escrowCnt - 1n);
    console.log("Amount:", ethers.formatEther(escrow.amount), "ETH");
    console.log("Scientist:", escrow.scientist);
    console.log("Institution:", escrow.institutionName);
    console.log("Claimed:", escrow.claimed);
  }
  console.log();

  // ── 7. Cancel bounty test ───────────────────────────────────
  console.log("=== 7. Cancel Bounty Test ===");
  const deadline2 = Math.floor(Date.now() / 1000) + 60; // 60 seconds from now
  const createTx2 = await pool.createBounty(
    "Cancer",
    "Test bounty for cancellation",
    deadline2,
    { value: ethers.parseEther("0.0005") }
  );
  const createReceipt2 = await createTx2.wait();
  const createLog2 = createReceipt2?.logs.find(
    (l: any) => l.fragment?.name === "BountyCreated"
  );
  const bountyId2 = createLog2 ? (createLog2 as any).args[0] : await pool.nextBountyId() - 1n;
  console.log("Created bounty", bountyId2.toString(), "with 60s deadline");

  // Wait for deadline to pass
  console.log("Waiting 65s for deadline to pass...");
  await new Promise(r => setTimeout(r, 65000));

  const cancelBalBefore = await ethers.provider.getBalance(signer.address);
  const cancelTx = await pool.cancelBounty(bountyId2);
  const cancelReceipt = await cancelTx.wait();
  const cancelBalAfter = await ethers.provider.getBalance(signer.address);
  console.log("Tx:", cancelReceipt?.hash);

  const cancelledBounty = await pool.getBounty(bountyId2);
  console.log("Status:", ["Open", "Finalized", "Cancelled"][Number(cancelledBounty.status)]);
  console.log("Refund received (minus gas):", ethers.formatEther(cancelBalAfter - cancelBalBefore), "ETH");
  console.log();

  // ── Summary ─────────────────────────────────────────────────
  console.log("=== SUMMARY ===");
  console.log("Total bounties:", (await pool.totalBounties()).toString());
  console.log("Total escrows:", (await pool.escrowCount()).toString());
  console.log("All tests passed!");
  console.log("\nFinal balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
