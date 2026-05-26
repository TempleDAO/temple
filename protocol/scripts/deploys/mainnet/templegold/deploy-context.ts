import { ethers } from "hardhat";
import { ensureExpectedEnvvars } from "../../helpers";
import { ContractInstances, connectToContractsUsingAddr, getDeployedContractsUsingOverrides } from "./contract-addresses";
import { ContractAddresses } from "./contract-addresses/types";

export interface DeployContext {
  owner: string;
  ADDRS: ContractAddresses,
  INSTANCES: ContractInstances,
}

export async function getDeployContext(dirname: string) {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const ADDRS = await getDeployedContractsUsingOverrides(dirname);
  const INSTANCES = connectToContractsUsingAddr(owner, ADDRS);
  return {
    owner,
    ADDRS,
    INSTANCES,
  }
}