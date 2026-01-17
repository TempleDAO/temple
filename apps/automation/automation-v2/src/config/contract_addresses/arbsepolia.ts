import { ContractAddresses } from "./types";

export const CONTRACTS: ContractAddresses = {
  CORE: {
    MULTISIG: '0x781B4c57100738095222bd92D37B07ed034AB696',
  },
  TREASURY_RESERVES_VAULT: {
      ADDRESS: '0x',
      D_USD_TOKEN: '0x',
      D_TEMPLE_TOKEN: '0x',
      TPI_ORACLE: '0x',
  },
  TEMPLE_GOLD: {
    TEMPLE_GOLD: '0x',
    TEMPLE_GOLD_STAKING: '0x',
    SPICE_AUCTION_FACTORY: '0x',
    AUCTIONS: {
      BID_FOR_TGLD: '0x',
      BID_FOR_SPICE: {
        ENA: '0x',
        DAI: '0x',
        SENA: '0x',
      },
    },
  },
  EXTERNAL: {
    MAKER_DAO: {
      DAI_TOKEN: '0x',
    },
    SKY: {
      USDS_TOKEN: '0x',
    }
  }
}