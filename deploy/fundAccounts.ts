import { HardhatRuntimeEnvironment } from "hardhat/types";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expandDecimals } from "../utils/math";

const func = async ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { log } = deployments;
  const { deployer } = await getNamedAccounts();
  const balance = expandDecimals(1000, 18);
  log("set deployer %s balance to %s", deployer, balance);
  await setBalance(deployer, balance);
};

func.skip = async ({ network }) => {
  // Skip on live networks and localhost (setBalance only works on in-process hardhat network)
  return network.live || network.name === "localhost";
};
func.tags = ["FundAccounts"];
export default func;
