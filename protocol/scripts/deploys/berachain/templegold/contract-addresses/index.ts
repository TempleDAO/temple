import { network } from "hardhat";
import {
    FakeERC20__factory,
    TempleGold__factory,
    TempleGoldAdmin__factory,
    TempleGoldStaking__factory,
    SpiceAuctionFactory__factory,
    StableGoldAuction__factory,
    TempleTeleporter__factory,
    TempleERC20Token__factory
} from '../../../../../typechain';
import { Signer } from "ethers";
import { ContractAddresses, ContractInstances } from "./types";
import { CONTRACTS as BERACHAIN_CONTRACTS } from "./berachain";

export { ContractAddresses, ContractInstances } from "./types";

export function getDeployedContracts(): ContractAddresses {
    if (network.name === 'berachain') {
        return BERACHAIN_CONTRACTS;
    }
    console.log(`No contracts configured for ${network.name} in this local directory.`);
    throw new Error(`No contracts configured for ${network.name}`);
}

// dirname is expected to be the path of the hardhat deploy script
// This will crudely search for the `scripts/${dir}/address-overrides.ts` module
// and apply the overrides to addrs
async function applyOverrides(addrs: ContractAddresses, dirname: string) {
  const dirs = dirname.split("/");
  let scriptDir = "";
  for (let i = dirs.length-1; i >= 0; i--) {
    if (dirs[i] == "mainnet" || dirs[i] == "scripts") {
      scriptDir = dirs[i+1];
      break;
    }
  }

  const module = await import(`../scripts/${scriptDir}/address-overrides`);
  return module.applyOverrides(addrs);
}

export async function getDeployedContractsUsingOverrides(
  applyOverridesPath: string
): Promise<ContractAddresses> {
  if (network.name === 'sepolia') {
    return BERACHAIN_CONTRACTS;
  } else if (network.name === 'localhost') {
    return await applyOverrides(BERACHAIN_CONTRACTS, applyOverridesPath);
  }
  console.log(`No contracts configured for ${network.name}`);
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
