import { createContractAddressModule } from "../../../templegold";
import { CONTRACTS as MAINNET_CONTRACTS } from "./mainnet";

const mod = createContractAddressModule('mainnet', MAINNET_CONTRACTS);

export const {
    getDeployedContracts,
    getDeployedContractsUsingOverrides,
    connectToContracts,
    connectToContractsUsingAddr,
} = mod;

export { ContractAddresses, ContractInstances } from "./types";
