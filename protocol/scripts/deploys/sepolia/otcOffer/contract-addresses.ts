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
    FUNDS_OWNER: string,
  }

  EXTERNAL: {
      MAKER_DAO: {
          DAI_TOKEN: string,
      },
      OLYMPUS: {
          OHM_TOKEN: string,
      },
  }
}

const CORE_DEPLOYED_CONTRACTS: {[key: string]: ContractAddresses} = {
    sepolia: {
        CORE: {
            // Deployed within ../v2/contract-addresses.ts
            TEMPLE_TOKEN: '0x64a925B0fA211c44337148C0807f959Bd44b0B67',

            // Dev controlled wallet
            CORE_MULTISIG: '0x81960c465605cddD9772a8653111D4aBE580Ce1e',
        },
        OTC_OFFER: {
            DAI_OHM: '0x09fDF85893c1277BDC9Ef1be2ACDf29EE5e19771',

            // Dev controlled wallet
            FUNDS_OWNER: '0x81960c465605cddD9772a8653111D4aBE580Ce1e',
        },
        EXTERNAL: {
            MAKER_DAO: {
                // Deployed within ../v2/contract-addresses.ts
                DAI_TOKEN: '0x33FA9618365F67c5345066d5Cfd7f3A2f183599A',
            },
            OLYMPUS: {
                OHM_TOKEN: '0xf7f739Bb945880aD0398122069Fd3beC282c6621',
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
    },
    EXTERNAL: {
        MAKER_DAO: {
            DAI_TOKEN: FakeERC20,
        },
        OLYMPUS: {
            OHM_TOKEN: FakeERC20CustomDecimals,
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
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: FakeERC20__factory.connect(CORE_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, owner),
            },
            OLYMPUS: {
                OHM_TOKEN: FakeERC20CustomDecimals__factory.connect(CORE_ADDRESSES.EXTERNAL.OLYMPUS.OHM_TOKEN, owner),
            },
        },
    }
}