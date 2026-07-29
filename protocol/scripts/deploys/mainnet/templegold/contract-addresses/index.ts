import { Signer } from "ethers";
import { createContractAddressModule } from "../../../templegold";
import { CONTRACTS as MAINNET_CONTRACTS } from "./mainnet";
import { ContractAddresses, ContractInstances } from "./types";

const mod = createContractAddressModule('mainnet', MAINNET_CONTRACTS);

export function getDeployedContracts(): ContractAddresses {
    return mod.getDeployedContracts() as ContractAddresses;
}

export async function getDeployedContractsUsingOverrides(applyOverridesPath: string): Promise<ContractAddresses> {
    return await mod.getDeployedContractsUsingOverrides(applyOverridesPath) as ContractAddresses;
}

export const connectToContractsUsingAddr = mod.connectToContractsUsingAddr;

export function connectToContracts(owner: Signer): ContractInstances {
    return connectToContractsUsingAddr(owner, getDeployedContracts());
}

export { ContractAddresses, ContractInstances } from "./types";
