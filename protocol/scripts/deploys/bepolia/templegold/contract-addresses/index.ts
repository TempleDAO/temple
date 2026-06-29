import { Signer } from "ethers";
import { createContractAddressModule } from "../../../templegold";
import { FakeERC20__factory } from "../../../../../typechain";
import { CONTRACTS as BEPOLIA_CONTRACTS } from "./bepolia";
import { ContractAddresses, ContractInstances } from "./types";

const mod = createContractAddressModule('bepolia', BEPOLIA_CONTRACTS);

export function getDeployedContracts(): ContractAddresses {
    return mod.getDeployedContracts() as ContractAddresses;
}

export async function getDeployedContractsUsingOverrides(applyOverridesPath: string): Promise<ContractAddresses> {
    return await mod.getDeployedContractsUsingOverrides(applyOverridesPath) as ContractAddresses;
}

export function connectToContractsUsingAddr(owner: Signer, ADDRS: ContractAddresses): ContractInstances {
    const base = mod.connectToContractsUsingAddr(owner, ADDRS);
    return {
        ...base,
        TEMPLE_GOLD: {
            ...base.TEMPLE_GOLD,
            SPICE_TOKEN: FakeERC20__factory.connect(ADDRS.TEMPLE_GOLD.SPICE_TOKEN, owner),
        },
    };
}

export { ContractAddresses, ContractInstances } from "./types";
