import { network } from "hardhat";
import { FakeERC20, FakeERC20CustomDecimals, FakeERC20CustomDecimals__factory, FakeERC20__factory, OtcOffer, OtcOffer__factory, TempleERC20Token, TempleERC20Token__factory } from '../../../../typechain';
import { Signer } from "ethers";

export interface ContractAddresses {
  CORE: {
    TEMPLE_TOKEN: string,
    CORE_MULTISIG: string,
  },

  OTC_OFFER: {
    DAI_OHM: string,
    DAI_GOHM: string,
    FUNDS_OWNER: string,
  }

  EXTERNAL: {
      MAKER_DAO: {
          DAI_TOKEN: string,
      },
      OLYMPUS: {
          OHM_TOKEN: string,
          GOHM_TOKEN: string,
      },
  }
}

const CORE_DEPLOYED_CONTRACTS: {[key: string]: ContractAddresses} = {
    mainnet: {
        CORE: {
            TEMPLE_TOKEN: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
            CORE_MULTISIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
        },
        OTC_OFFER: {
            DAI_OHM: '0x687A4B0Ac18Ed3796D55E6A1d747bD75591a8bac',
            DAI_GOHM: '0x2c4b131BEf9d676877Ae0b5b2B46914b07FB9272',
            FUNDS_OWNER: '0x5C8898f8E0F9468D4A677887bC03EE2659321012',
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: '0x6b175474e89094c44da98b954eedeac495271d0f',
            },
            OLYMPUS: {
                OHM_TOKEN: '0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5',
                GOHM_TOKEN: '0x0ab87046fBb341D058F17CBC4c1133F25a20a52f',
            },
        }
    },
}

export function getDeployedContracts(): ContractAddresses {
    if (CORE_DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return CORE_DEPLOYED_CONTRACTS[network.name];
    }
}

export interface ContractInstances {
    CORE: {
        TEMPLE_TOKEN: TempleERC20Token,
    },
    OTC_OFFER: {
        DAI_OHM: OtcOffer,
        DAI_GOHM: OtcOffer,
    },
    EXTERNAL: {
        MAKER_DAO: {
            DAI_TOKEN: FakeERC20,
        },
        OLYMPUS: {
            OHM_TOKEN: FakeERC20CustomDecimals, // 9DP
            GOHM_TOKEN: FakeERC20, // 18DP
        },
    },
}

export function connectToContracts(owner: Signer): ContractInstances {
    const CORE_ADDRESSES = getDeployedContracts();

    return {
        CORE: {
            TEMPLE_TOKEN: TempleERC20Token__factory.connect(CORE_ADDRESSES.CORE.TEMPLE_TOKEN, owner),
        },
        OTC_OFFER: {
            DAI_OHM: OtcOffer__factory.connect(CORE_ADDRESSES.OTC_OFFER.DAI_OHM, owner),
            DAI_GOHM: OtcOffer__factory.connect(CORE_ADDRESSES.OTC_OFFER.DAI_GOHM, owner),
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: FakeERC20__factory.connect(CORE_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, owner),
            },
            OLYMPUS: {
                OHM_TOKEN: FakeERC20CustomDecimals__factory.connect(CORE_ADDRESSES.EXTERNAL.OLYMPUS.OHM_TOKEN, owner),
                GOHM_TOKEN: FakeERC20__factory.connect(CORE_ADDRESSES.EXTERNAL.OLYMPUS.GOHM_TOKEN, owner),
            },
        },
    }
}