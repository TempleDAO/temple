import { Signer } from "ethers";
import { createContractAddressModule } from "../../../templegold";
import { CONTRACTS as BERACHAIN_CONTRACTS } from "./berachain";
import { ContractAddresses, ContractInstances } from "./types";

const mod = createContractAddressModule('berachain', BERACHAIN_CONTRACTS);

export function getDeployedContracts(): ContractAddresses {
    return mod.getDeployedContracts() as ContractAddresses;
}

export async function getDeployedContractsUsingOverrides(applyOverridesPath: string): Promise<ContractAddresses> {
    return await mod.getDeployedContractsUsingOverrides(applyOverridesPath) as ContractAddresses;
}

export const connectToContractsUsingAddr = mod.connectToContractsUsingAddr;

export { ContractAddresses, ContractInstances } from "./types";
