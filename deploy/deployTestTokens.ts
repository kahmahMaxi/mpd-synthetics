import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TokenConfig } from "../config/tokens";

import * as keys from "../utils/keys";
import { setAddressIfDifferent, setUintIfDifferent } from "../utils/dataStore";
import { expandDecimals } from "../utils/math";

const func = async ({ getNamedAccounts, deployments, gmx, network }: HardhatRuntimeEnvironment) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const { getTokens } = gmx;
  
  log("Loading tokens config...");
  let tokens: Record<string, TokenConfig>;
  try {
    tokens = await getTokens();
    log(`Loaded ${Object.keys(tokens).length} tokens`);
    for (const [symbol, token] of Object.entries(tokens)) {
      log(`Token ${symbol}: decimals=${token.decimals}, deploy=${token.deploy}, synthetic=${token.synthetic}`);
    }
  } catch (e) {
    log(`Error loading tokens: ${e}`);
    throw e;
  }

  for (const [tokenSymbol, token] of Object.entries(tokens)) {
    if (token.synthetic || !token.deploy) {
      continue;
    }

    if (network.live) {
      console.warn("WARN: Deploying token on live network");
    }

    // Skip tokens with undefined decimals
    if (token.decimals === undefined) {
      console.warn(`WARN: Skipping ${tokenSymbol} - decimals not defined`);
      continue;
    }

    const existingToken = await deployments.getOrNull(tokenSymbol);
    if (existingToken) {
      log(`Reusing ${tokenSymbol} at ${existingToken.address}`);
      console.warn(`WARN: bytecode diff is not checked`);
      tokens[tokenSymbol].address = existingToken.address;
      continue;
    }

    log(`Deploying ${tokenSymbol} with decimals: ${token.decimals}`);
    const { address, newlyDeployed } = await deploy(tokenSymbol, {
      from: deployer,
      log: true,
      contract: token.wrappedNative ? "WNT" : "MintableToken",
      args: token.wrappedNative ? [] : [tokenSymbol, tokenSymbol, token.decimals],
    });

    tokens[tokenSymbol].address = address;
    if (newlyDeployed) {
      // setBalance only works on in-process hardhat network, not localhost via RPC
      if (token.wrappedNative && !network.live && network.name !== "localhost") {
        await setBalance(address, expandDecimals(1000, token.decimals));
      }

      if (!token.wrappedNative) {
        const tokenContract = await ethers.getContractAt("MintableToken", address);
        await tokenContract.mint(deployer, expandDecimals(1000000000, token.decimals));
      }
    }
  }

  for (const [tokenSymbol, token] of Object.entries(tokens)) {
    if (token.synthetic) {
      continue;
    }

    // Skip if transferGasLimit is not defined
    if (token.transferGasLimit !== undefined) {
      await setUintIfDifferent(
        keys.tokenTransferGasLimit(token.address!),
        token.transferGasLimit,
        `${tokenSymbol} transfer gas limit`
      );
    }
  }

  const wrappedAddress = Object.values(tokens).find((token) => token.wrappedNative)?.address;
  if (!wrappedAddress) {
    throw new Error("No wrapped native token found");
  }
  await setAddressIfDifferent(keys.WNT, wrappedAddress, "WNT");
};

func.tags = ["Tokens"];
func.dependencies = ["DataStore", "GrantDeployerRoles"];
export default func;
