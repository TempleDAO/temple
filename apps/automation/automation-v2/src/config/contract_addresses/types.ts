import { Address } from "viem";
  
export interface ContractAddresses {
  CORE: {
    MULTISIG: Address;
  },
  TREASURY_RESERVES_VAULT: {
      ADDRESS: Address;
      D_USD_TOKEN: Address;
      D_TEMPLE_TOKEN: Address;
      TPI_ORACLE: Address;
  };
  TEMPLE_GOLD: {
    TEMPLE_GOLD: Address;
    TEMPLE_GOLD_STAKING: Address;
    SPICE_AUCTION_FACTORY: Address;
    AUCTIONS: {
      BID_FOR_TGLD: Address;
      BID_FOR_SPICE: {
        ENA: Address;
        DAI: Address;
        SENA: Address;
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