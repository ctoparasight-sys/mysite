import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BountyPoolModule = buildModule("BountyPoolModule", (m) => {
  const founderWallet = m.getParameter(
    "founderWallet",
    "0x0000000000000000000000000000000000000000"
  );

  const treasuryAddress = m.getParameter(
    "treasuryAddress",
    "0x0000000000000000000000000000000000000000"
  );

  const bountyPool = m.contract("CWBountyPool", [founderWallet, treasuryAddress]);

  return { bountyPool };
});

export default BountyPoolModule;
