import { createContractAddressModule } from "../../../templegold";
import { CONTRACTS as MAINNET_CONTRACTS } from "../../../mainnet/templegold/contract-addresses/mainnet";

const mod = createContractAddressModule('localhost', MAINNET_CONTRACTS);

export const {
    getDeployedContracts,
    getDeployedContractsUsingOverrides,
    connectToContracts,
    connectToContractsUsingAddr,
} = mod;

export { ContractAddresses, ContractInstances } from "./types";
