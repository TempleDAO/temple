import { createContractAddressModule } from "../../../templegold";
import { CONTRACTS as BEPOLIA_CONTRACTS } from "./bepolia";

const mod = createContractAddressModule('bepolia', BEPOLIA_CONTRACTS);

export const {
    getDeployedContracts,
    getDeployedContractsUsingOverrides,
    connectToContracts,
    connectToContractsUsingAddr,
} = mod;

export { ContractAddresses, ContractInstances } from "./types";
