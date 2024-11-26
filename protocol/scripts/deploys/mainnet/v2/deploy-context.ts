import { ethers } from "hardhat";
import { ensureExpectedEnvvars } from "../../helpers";
import { connectToContracts, ContractAddresses, ContractInstances, getDeployedContracts } from "./contract-addresses";

export interface DeployContext {
  owner: string;
  TEMPLE_V2_ADDRESSES: ContractAddresses,
  TEMPLE_V2_INSTANCES: ContractInstances,  
}

export async function getDeployContext() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();
  const TEMPLE_V2_INSTANCES = connectToContracts(owner);
  return {
    owner,
    TEMPLE_V2_ADDRESSES,
    TEMPLE_V2_INSTANCES,
  }
}
