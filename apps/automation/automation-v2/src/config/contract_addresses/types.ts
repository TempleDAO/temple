import { Address } from "viem";
  
export interface ContractAddresses {
  CORE: {
    MULTISIG: Address;
  },
  TEMPLE_GOLD: {
    STABLE_GOLD_AUCTION: Address;
    TEMPLE_GOLD: Address;
    TEMPLE_GOLD_STAKING: Address;
    SPICE_AUCTION_FACTORY: Address;
    SPICE_DAI_TGLD: Address;
  },
  EXTERNAL: {
    MAKER_DAO: {
      DAI_TOKEN: Address;
    },
    SKY: {
      USDS_TOKEN: Address;
    }
  }
}