import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TreasuryAndROModule = buildModule("TreasuryAndROModule", (m) => {
  const founderWallet = m.getParameter(
    "founderWallet",
    "0x0000000000000000000000000000000000000000"
  );
  const initialMintFee = m.getParameter(
    "initialMintFee",
    BigInt("200000000000000") // 0.0002 ETH
  );

  const treasury = m.contract("CWTreasury", [founderWallet]);

  const carrierwaveROv2 = m.contract("CarrierwaveROv2", [
    founderWallet,
    treasury,
    initialMintFee,
  ]);

  return { treasury, carrierwaveROv2 };
});

export default TreasuryAndROModule;
