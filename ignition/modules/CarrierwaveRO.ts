import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CarrierwaveROModule = buildModule("CarrierwaveROModule", (m) => {
  const founderWallet = m.getParameter(
    "founderWallet",
    "0x0000000000000000000000000000000000000000"
  );

  const carrierwaveRO = m.contract("CarrierwaveRO", [founderWallet]);

  return { carrierwaveRO };
});

export default CarrierwaveROModule;
