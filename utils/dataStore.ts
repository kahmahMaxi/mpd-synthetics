import hre from "hardhat";
import { BigNumber, ethers } from "ethers";
import { signalHoldingAddressIfDifferent } from "./timelock";

export async function setUintIfDifferent(key: string, value: BigNumber | string | number, label?: string) {
  await setIfDifferent("uint", key, value, {
    compare: (a, b) => a.eq(b),
    label,
  });
}

export async function setIntIfDifferent(key: string, value: BigNumber | string | number, label?: string) {
  await setIfDifferent("int", key, value, {
    compare: (a, b) => a.eq(b),
    label,
  });
}

export async function setAddressIfDifferent(key: string, value: string, label?: string) {
  await setIfDifferent("address", key, value, {
    compare: (a, b) => a.toLowerCase() == b.toLowerCase(),
    label,
  });
}

export async function setBytes32IfDifferent(key: string, value: string, label?: string) {
  await setIfDifferent("bytes32", key, value, { label });
}

export async function setBoolIfDifferent(key: string, value: boolean, label?: string) {
  await setIfDifferent("bool", key, value, { label });
}

async function setIfDifferent(
  type: "uint" | "int" | "address" | "data" | "bool" | "bytes32",
  key: string,
  value: any,
  { compare, label }: { compare?: (a: any, b: any) => boolean; label?: string } = {}
) {
  if (value === undefined) {
    throw new Error(`Value for ${label || key} of type ${type} is undefined`);
  }

  if (hre.gmx.isExistingMainnetDeployment) {
    return;
  }

  const { read, execute, log } = hre.deployments;
  const { getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();

  const getMethod = `get${type[0].toUpperCase()}${type.slice(1)}`;
  const setMethod = `set${type[0].toUpperCase()}${type.slice(1)}`;

  // Check if DataStore is deployed and accessible
  let currentValue: any;
  try {
    // Try to get DataStore deployment first
    const dataStore = await hre.deployments.get("DataStore");
    if (!dataStore || !dataStore.address) {
      throw new Error("DataStore not deployed");
    }
    
    // Use direct contract call instead of deployments.read for better error handling
    const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);
    const rawValue = await dataStoreContract[getMethod](key);
    
    // Convert to appropriate type based on the data type
    if (type === "uint" || type === "int") {
      currentValue = BigNumber.from(rawValue);
    } else {
      currentValue = rawValue;
    }
  } catch (error: any) {
    // If DataStore is not accessible, log warning and attempt to set anyway
    log(`⚠️  Could not read ${type} for ${label || key}: ${error.message}`);
    log(`   Attempting to set value anyway...`);
    // Use appropriate default value based on type
    if (type === "uint" || type === "int") {
      currentValue = BigNumber.from(0);
    } else {
      currentValue = type === "address" ? ethers.constants.AddressZero : "";
    }
  }

  // Convert value to BigNumber if needed for comparison
  let valueToCompare = value;
  if ((type === "uint" || type === "int") && !BigNumber.isBigNumber(value)) {
    valueToCompare = BigNumber.from(value);
  }

  if (compare ? !compare(currentValue, valueToCompare) : currentValue != valueToCompare) {
    try {
      log("setting %s %s (%s) to %s, prev: %s", type, label || "", key, value.toString(), currentValue.toString());
      await execute("DataStore", { from: deployer, log: true }, setMethod, key, value);
    } catch (error: any) {
      log(`❌ Failed to set ${type} ${label || key}: ${error.message}`);
      throw error;
    }
  } else {
    log("skipping %s %s (%s) as it is already set to %s", type, label, key, value.toString());
  }
}
