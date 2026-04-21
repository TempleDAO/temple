import { network } from "hardhat";
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
} from '../../../../../typechain';
import { Signer } from "ethers";
import { ContractAddresses, ContractInstances } from "./types";
import { CONTRACTS as BEPOLIA_CONTRACTS } from "./bepolia";

export { ContractAddresses, ContractInstances } from "./types";

export function getDeployedContracts(): ContractAddresses {
    if (network.name === 'bepolia') {
        return BEPOLIA_CONTRACTS;
    }
    console.log(`No contracts configured for ${network.name} in this local directory.`);
    throw new Error(`No contracts configured for ${network.name}`);
}

export function connectToContracts(owner: Signer): ContractInstances {
    return connectToContractsUsingAddr(owner, getDeployedContracts());
}

export function connectToContractsUsingAddr(owner: Signer, ADDRS: ContractAddresses): ContractInstances {
    return {
        TEMPLE_GOLD: {
            TEMPLE_GOLD: TempleGold__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD, owner),
            TEMPLE_GOLD_ADMIN: TempleGoldAdmin__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD_ADMIN, owner),
            TEMPLE_GOLD_STAKING: TempleGoldStaking__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, owner),
            SPICE_AUCTION: SpiceAuction__factory.connect(ADDRS.TEMPLE_GOLD.SPICE_AUCTION, owner),
            SPICE_AUCTION_FACTORY: SpiceAuctionFactory__factory.connect(ADDRS.TEMPLE_GOLD.SPICE_AUCTION_FACTORY, owner),
            STABLE_GOLD_AUCTION: StableGoldAuction__factory.connect(ADDRS.TEMPLE_GOLD.STABLE_GOLD_AUCTION, owner),
            TEMPLE_TELEPORTER: TempleTeleporter__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_TELEPORTER, owner),
            SPICE_TOKEN: FakeERC20__factory.connect(ADDRS.TEMPLE_GOLD.SPICE_TOKEN, owner),
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
