import { ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as keys from "../utils/keys";
import { setUintIfDifferent } from "../utils/dataStore";

const func = async ({ deployments, getNamedAccounts, gmx, network, ethers: hreEthers }: HardhatRuntimeEnvironment) => {
  const { read, execute, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const oracleConfig = await gmx.getOracle();
  const oracleSigners = oracleConfig.signers.map((s) => ethers.utils.getAddress(s));

  // Try to get existing signers, handle errors gracefully
  let existingSigners: string[] = [];
  let existingSignersCount = 0;
  
  try {
    // Try to get OracleStore deployment first
    const oracleStore = await deployments.get("OracleStore");
    if (oracleStore && oracleStore.address) {
      // Use direct contract call instead of deployments.read for better error handling
      const oracleStoreContract = await hreEthers.getContractAt("OracleStore", oracleStore.address);
      existingSignersCount = await oracleStoreContract.getSignerCount();
      existingSigners = await oracleStoreContract.getSigners(0, existingSignersCount);
      log("existing signers", existingSigners.join(","));
    }
  } catch (error: any) {
    // If OracleStore is not accessible, log warning and continue with empty signers list
    log(`⚠️  Could not read existing signers from OracleStore: ${error.message}`);
    log(`   Will attempt to add configured signers anyway...`);
    existingSigners = [];
    existingSignersCount = 0;
  }

  // Add new signers
  for (const oracleSigner of oracleSigners) {
    if (!existingSigners.includes(oracleSigner)) {
      try {
        log("adding oracle signer", oracleSigner);
        await execute("OracleStore", { from: deployer, log: true }, "addSigner", oracleSigner);
      } catch (error: any) {
        log(`⚠️  Failed to add oracle signer ${oracleSigner}: ${error.message}`);
        // Continue with other signers
      }
    }
  }

  // Remove signers that are no longer in config (only if we successfully read existing signers)
  if (existingSignersCount > 0) {
    for (const existingSigner of existingSigners) {
      if (!oracleSigners.includes(existingSigner)) {
        try {
          log("removing oracle signer", existingSigner);
          await execute("OracleStore", { from: deployer, log: true }, "removeSigner", existingSigner);
        } catch (error: any) {
          log(`⚠️  Failed to remove oracle signer ${existingSigner}: ${error.message}`);
          // Continue with other signers
        }
      }
    }
  }

  await setUintIfDifferent(keys.MIN_ORACLE_SIGNERS, oracleConfig.minOracleSigners, "min oracle signers");
};
func.tags = ["OracleSigners"];
func.dependencies = ["RoleStore", "OracleStore", "DataStore"];
export default func;
