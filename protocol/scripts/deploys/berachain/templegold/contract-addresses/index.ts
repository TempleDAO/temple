import { createContractAddressModule } from "../../../templegold";
import { CONTRACTS as BERACHAIN_CONTRACTS } from "./berachain";

const mod = createContractAddressModule('berachain', BERACHAIN_CONTRACTS);

export const {
    getDeployedContracts,
    getDeployedContractsUsingOverrides,
    connectToContracts,
    connectToContractsUsingAddr,
} = mod;

export { ContractAddresses, ContractInstances } from "./types";
