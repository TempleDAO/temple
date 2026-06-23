import { createContractAddressModule } from "../../../templegold";
import { CONTRACTS as ARBITRUM_SEPOLIA_CONTRACTS } from "./arbitrumSepolia";

const mod = createContractAddressModule('arbitrumSepolia', ARBITRUM_SEPOLIA_CONTRACTS);

export const {
    getDeployedContracts,
    getDeployedContractsUsingOverrides,
    connectToContracts,
    connectToContractsUsingAddr,
} = mod;

export { ContractAddresses, ContractInstances } from "./types";
