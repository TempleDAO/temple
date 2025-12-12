import { Address } from "viem";
  
export interface ContractAddresses {
  CORE: {
    MULTISIG: Address;
  },
  TEMPLE_GOLD: {
    TEMPLE_GOLD: Address;
    TEMPLE_GOLD_STAKING: Address;
    SPICE_AUCTION_FACTORY: Address;
    AUCTIONS: {
      BID_FOR_TGLD: Address;
      BID_FOR_SPICE: {
        ENA: Address;
        DAI: Address;
      },
    },
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