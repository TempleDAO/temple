import { ethers } from "hardhat";
import { ensureExpectedEnvvars } from "../../helpers";
import { ContractInstances, connectToContractsUsingAddr, getDeployedContractsUsingOverrides } from "./contract-addresses";
import { ContractAddresses } from "./contract-addresses/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { anvilSignerIndex } from "../../anvil";

export interface LocalhostDeployContext {
  owner: SignerWithAddress;
  rescuer: SignerWithAddress;
  ADDRS: ContractAddresses,
  INSTANCES: ContractInstances,
}

export async function getLocalhostDeployContext(dirname: string): Promise<LocalhostDeployContext> {
  ensureExpectedEnvvars();
  const [owner, rescuer] = await ethers.getSigners();
  await logDeployer(owner);
  const ADDRS = await getDeployedContractsUsingOverrides(dirname);
  const INSTANCES = connectToContractsUsingAddr(owner, ADDRS);
  return {
    owner,
    rescuer,
    ADDRS,
    INSTANCES,
  }
}

async function logDeployer(owner: SignerWithAddress) {
  const ownerAddr = await owner.getAddress();
  const asi = anvilSignerIndex(ownerAddr);
  const anvilSuffix = asi !== undefined
    ? ` [ANVIL SIGNER ${asi}]`
    : '';  
  console.log(`Using Deployer Address: ${ownerAddr}${anvilSuffix}`);
}
