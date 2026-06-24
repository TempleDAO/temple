import { network } from "hardhat";
import path from "path";
import {
    FakeERC20__factory,
    TempleGold__factory,
    TempleGoldAdmin__factory,
    TempleGoldStaking__factory,
    SpiceAuction__factory,
    SpiceAuctionFactory__factory,
    StableGoldAuction__factory,
    TempleTeleporter__factory,
    TempleERC20Token__factory
} from '../../../typechain';
import { Signer } from "ethers";
import { ContractAddresses, ContractInstances } from "./types";

export { ContractAddresses, ContractInstances } from "./types";

export function createContractAddressModule(
    networkName: string,
    contractsMap: ContractAddresses,
) {
    // dirname is expected to be the absolute path of the hardhat deploy script
    // This will resolve the address-overrides module relative to the network directory
    async function applyOverrides(addrs: ContractAddresses, dirname: string) {
        // Find the network directory in the path
        const dirs = dirname.split("/");
        let networkDirIndex = -1;
        for (let i = dirs.length - 1; i >= 0; i--) {
            if (dirs[i] == networkName) {
                networkDirIndex = i;
                break;
            }
        }

        if (networkDirIndex === -1) {
            throw new Error(`Could not find network directory "${networkName}" in path: ${dirname}`);
        }

        // Reconstruct the network directory path
        const networkDir = dirs.slice(0, networkDirIndex + 1).join("/");

        // Find the category directory (the segment after templegold)
        // e.g., .../mainnet/templegold/01-external -> category = "01-external"
        let category = "";
        const templegoldIndex = dirs.indexOf("templegold", networkDirIndex);
        if (templegoldIndex !== -1 && templegoldIndex + 1 < dirs.length) {
            category = dirs[templegoldIndex + 1];
        }

        if (!category) {
            throw new Error(`Could not determine category from path: ${dirname}. Expected path like .../templegold/{category}/...`);
        }

        // Build absolute path to the address-overrides module
        const overridesPath = path.join(networkDir, "templegold", "scripts", category, "address-overrides");
        const module = await import(overridesPath);
        return module.applyOverrides(addrs);
    }

    function getDeployedContracts(): ContractAddresses {
        if (network.name === networkName) {
            return contractsMap;
        }
        console.log(`No contracts configured for ${network.name} in this local directory.`);
        throw new Error(`No contracts configured for ${network.name}`);
    }

    async function getDeployedContractsUsingOverrides(
        applyOverridesPath: string
    ): Promise<ContractAddresses> {
        if (network.name === networkName) {
            return contractsMap;
        } else if (network.name === 'localhost') {
            return await applyOverrides(contractsMap, applyOverridesPath);
        }
        console.log(`No contracts configured for ${network.name}`);
        throw new Error(`No contracts configured for ${network.name}`);
    }

    function connectToContracts(owner: Signer): ContractInstances {
        return connectToContractsUsingAddr(owner, getDeployedContracts());
    }

    function connectToContractsUsingAddr(owner: Signer, ADDRS: ContractAddresses): ContractInstances {
        return {
            TEMPLE_GOLD: {
                TEMPLE_GOLD: TempleGold__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD, owner),
                TEMPLE_GOLD_ADMIN: TempleGoldAdmin__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD_ADMIN, owner),
                TEMPLE_GOLD_STAKING: TempleGoldStaking__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, owner),
                TEMPLE_TELEPORTER: TempleTeleporter__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_TELEPORTER, owner),
                ...(ADDRS.TEMPLE_GOLD.SPICE_AUCTION
                    ? { SPICE_AUCTION: SpiceAuction__factory.connect(ADDRS.TEMPLE_GOLD.SPICE_AUCTION, owner) }
                    : {}),
                SPICE_AUCTION_FACTORY: SpiceAuctionFactory__factory.connect(ADDRS.TEMPLE_GOLD.SPICE_AUCTION_FACTORY, owner),
                STABLE_GOLD_AUCTION: StableGoldAuction__factory.connect(ADDRS.TEMPLE_GOLD.STABLE_GOLD_AUCTION, owner),
                ...(ADDRS.TEMPLE_GOLD.SPICE_TOKEN
                    ? { SPICE_TOKEN: FakeERC20__factory.connect(ADDRS.TEMPLE_GOLD.SPICE_TOKEN, owner) }
                    : {}),
            },
            CORE: {
                TEMPLE_TOKEN: TempleERC20Token__factory.connect(ADDRS.CORE.TEMPLE_TOKEN, owner),
            },
            EXTERNAL: {
                MAKER_DAO: {
                    DAI_TOKEN: FakeERC20__factory.connect(ADDRS.EXTERNAL.MAKER_DAO.DAI_TOKEN, owner),
                },
            }
        }
    }

    return {
        getDeployedContracts,
        getDeployedContractsUsingOverrides,
        connectToContracts,
        connectToContractsUsingAddr,
    };
}
