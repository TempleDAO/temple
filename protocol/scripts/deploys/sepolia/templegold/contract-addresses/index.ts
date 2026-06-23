import { createContractAddressModule } from "../../../templegold";
import { CONTRACTS as SEPOLIA_CONTRACTS } from "./sepolia";

const mod = createContractAddressModule('sepolia', SEPOLIA_CONTRACTS);

export const {
    getDeployedContracts,
    getDeployedContractsUsingOverrides,
    connectToContracts,
    connectToContractsUsingAddr,
} = mod;

export { ContractAddresses, ContractInstances } from "./types";
