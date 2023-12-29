import { network } from "hardhat";
import { 
    NexusCommon, NexusCommon__factory, 
    PartnerZeroSacrifice, PartnerZeroSacrifice__factory, 
    Relic, Relic__factory, 
    Shard, Shard__factory, 
    TempleERC20Token, TempleERC20Token__factory, 
    TempleSacrifice, TempleSacrifice__factory
} from '../../../../typechain';
import { Signer } from "ethers";

export interface ContractAddresses {
  CORE: {
    TEMPLE_TOKEN: string,
    CORE_MULTISIG: string,
  },

  NEXUS: {
    NEXUS_COMMON: string,
    RELIC: string,
    SHARD: string,
    TEMPLE_SACRIFICE: string,
    PARTNER_ZERO_SACRIFICE: string,
  }
}

const NEXUS_DEPLOYED_CONTRACTS: {[key: string]: ContractAddresses} = {
    sepolia: {
        CORE: {
            TEMPLE_TOKEN: '0x64a925B0fA211c44337148C0807f959Bd44b0B67',
            CORE_MULTISIG: '0x81960c465605cddD9772a8653111D4aBE580Ce1e',
        },
        NEXUS: {
            NEXUS_COMMON: '0xf5968367a8acBe9ffACA4049E40A4C1F78b18952',
            RELIC: '0x73F27cF3329344cF728571826eC844C5518aD679',
            SHARD: '0x5Ad4Bf5aa9C00eDaa6c8a30c6ac21e5497B6E58f',
            TEMPLE_SACRIFICE: '0xd69D0CC9E0AD59ee30A53455A2E3957d0ebfFFC7',
            PARTNER_ZERO_SACRIFICE: '0x30ACA5d7e58502585F4653BA6330B24170b109Eb',
          }
    },
}

export function getDeployedContracts(): ContractAddresses {
    if (NEXUS_DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return NEXUS_DEPLOYED_CONTRACTS[network.name];
    }
}

export interface ContractInstances {
    CORE: {
      TEMPLE_TOKEN: TempleERC20Token,
    },
    
    NEXUS: {
      NEXUS_COMMON: NexusCommon,
      RELIC: Relic,
      SHARD: Shard,
      TEMPLE_SACRIFICE: TempleSacrifice,
      PARTNER_ZERO_SACRIFICE: PartnerZeroSacrifice,
    },
}

export function connectToContracts(owner: Signer): ContractInstances {
    const CORE_ADDRESSES = getDeployedContracts();

    return {
      CORE: {
        TEMPLE_TOKEN: TempleERC20Token__factory.connect(CORE_ADDRESSES.CORE.TEMPLE_TOKEN, owner),
      },
      NEXUS: {
        NEXUS_COMMON: NexusCommon__factory.connect(CORE_ADDRESSES.NEXUS.NEXUS_COMMON, owner),
        RELIC: Relic__factory.connect(CORE_ADDRESSES.NEXUS.RELIC, owner),
        SHARD: Shard__factory.connect(CORE_ADDRESSES.NEXUS.SHARD, owner),
        TEMPLE_SACRIFICE: TempleSacrifice__factory.connect(CORE_ADDRESSES.NEXUS.TEMPLE_SACRIFICE, owner),
        PARTNER_ZERO_SACRIFICE: PartnerZeroSacrifice__factory.connect(CORE_ADDRESSES.NEXUS.PARTNER_ZERO_SACRIFICE, owner),
      },
    }
}