import { ethers } from "hardhat";
import { ensureExpectedEnvvars } from "../../helpers";
import { ContractInstances, connectToContractsUsingAddr, getDeployedContractsUsingOverrides } from "./contract-addresses";
import { ContractAddresses } from "./contract-addresses/types";
import { Signer } from "ethers";
import { anvilSignerIndex } from "../../anvil";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export interface DeployContext {
  owner: Signer;
  ADDRS: ContractAddresses,
  INSTANCES: ContractInstances,
}

export async function getDeployContext(dirname: string) {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  await logDeployer(owner);
  const ADDRS = await getDeployedContractsUsingOverrides(dirname);
  const INSTANCES = connectToContractsUsingAddr(owner, ADDRS);
  return {
    owner,
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