import { network } from "hardhat";
import {
    FakeERC20, FakeERC20__factory,
    TempleGold__factory, TempleGold,
    TempleGoldAdmin, TempleGoldAdmin__factory,
    TempleGoldStaking, TempleGoldStaking__factory,
    SpiceAuction__factory, SpiceAuction,
    SpiceAuctionFactory__factory, SpiceAuctionFactory,
    DaiGoldAuction__factory, DaiGoldAuction,
    TempleTeleporter, TempleTeleporter__factory,
    TempleERC20Token, TempleERC20Token__factory
} from '../../../../typechain';
import { Signer } from "ethers";

export interface ContractAddresses {
    TEMPLE_GOLD: {
        AUCTION_AUTOMATION_EOA: string,
        STAKING_AUTOMATION_EOA: string,
        SPICE_AUCTION_OPERATOR: string,
        TEMPLE_GOLD: string,
        TEMPLE_GOLD_ADMIN: string,
        TEMPLE_GOLD_STAKING: string,
        TEMPLE_TELEPORTER: string,
        SPICE_AUCTION: string,
        SPICE_AUCTION_FACTORY: string,
        DAI_GOLD_AUCTION: string,
        EXECUTOR_MSIG: string,
        RESCUER_MSIG: string,
    },
    CORE: {
        TEMPLE_TOKEN: string,
    },
    EXTERNAL: {
        LAYER_ZERO: {
            ENDPOINT: string,
        },
        MAKER_DAO: {
            DAI_TOKEN: string,
        }
    }
}

const TEMPLEGOLD_DEPLOYED_CONTRACTS: {[key: string]: ContractAddresses} = {
    arbitrumOne: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "string",
            STAKING_AUTOMATION_EOA: "string",
            SPICE_AUCTION_OPERATOR: "string",
            TEMPLE_GOLD: "string",
            TEMPLE_GOLD_ADMIN: "string",
            TEMPLE_GOLD_STAKING: "string",
            TEMPLE_TELEPORTER: "string",
            SPICE_AUCTION: "string",
            SPICE_AUCTION_FACTORY: "string",
            DAI_GOLD_AUCTION: "string",
            EXECUTOR_MSIG: "string",
            RESCUER_MSIG: "string",
        },
        CORE: {
            TEMPLE_TOKEN: "string",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x1a44076050125825900e736c501f859c50fE728c",
            },
            MAKER_DAO: {
                DAI_TOKEN: "",
            }
        },
    },
    mainnet: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "string",
            STAKING_AUTOMATION_EOA: "string",
            SPICE_AUCTION_OPERATOR: "string",
            TEMPLE_GOLD: "string",
            TEMPLE_GOLD_ADMIN: "string",
            TEMPLE_GOLD_STAKING: "string",
            TEMPLE_TELEPORTER: "string",
            SPICE_AUCTION: "string",
            SPICE_AUCTION_FACTORY: "string",
            DAI_GOLD_AUCTION: "string",
            EXECUTOR_MSIG: "string",
            RESCUER_MSIG: "string",
        },
        CORE: {
            TEMPLE_TOKEN: "string",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x1a44076050125825900e736c501f859c50fE728c",
            },
            MAKER_DAO: {
                DAI_TOKEN: "",
            }
        },
    },
    arbitrumSepolia: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "string",
            STAKING_AUTOMATION_EOA: "string",
            SPICE_AUCTION_OPERATOR: "string",
            TEMPLE_GOLD: "0x8afB7E03a6e115577361C5648924eBA3163381Fc",
            TEMPLE_GOLD_ADMIN: "string",
            TEMPLE_GOLD_STAKING: "0xa2f7B537B530481b12A5538bE7309fB6a34849f3",
            TEMPLE_TELEPORTER: "0x57cde11128c70948B910Bf34cF6F834c78B66b0f",
            SPICE_AUCTION: "string",
            SPICE_AUCTION_FACTORY: "0x30223FD9CDBCb97F15FE188769B0170F2a993A3E",
            DAI_GOLD_AUCTION: "0xF5B76f09B9df3eBD45155007590a9C14fEa2D4c1",
            EXECUTOR_MSIG: "string",
            RESCUER_MSIG: "string",
        },
        CORE: {
            TEMPLE_TOKEN: "0x36061ce3Ac2F5d69667F0c7B98Ec6021ef33b8cB",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x6EDCE65403992e310A62460808c4b910D972f10f",
            },
            MAKER_DAO: {
                DAI_TOKEN: "0x5879B1ae381DDbBa701170160162025d297ce3D3",
            }
        },
    },
    localhost: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            STAKING_AUTOMATION_EOA: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            SPICE_AUCTION_OPERATOR: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            TEMPLE_GOLD: "0xf3800C1f5374d9104ab20A48F1F83485BD9a37da",
            TEMPLE_GOLD_ADMIN: "0x0222F49C69567eB50f425AF01E2F9FCc451e807B",
            TEMPLE_GOLD_STAKING: "0xa7390dA200fcB4ce8C1032Cc024779F488B0D03a",
            TEMPLE_TELEPORTER: "0x876d471068e723279Fe52Eb10A6A587cA1a26CA4",
            SPICE_AUCTION: "string",
            SPICE_AUCTION_FACTORY: "string",
            DAI_GOLD_AUCTION: "0xA3174691290D9F0D8Fe3E98D8222441e117d1c46",
            EXECUTOR_MSIG: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            RESCUER_MSIG: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        },
        CORE: {
            TEMPLE_TOKEN: "0x7816d99063dfEc136d2139681D3fbD92375Ec14c",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: '0x1a44076050125825900e736c501f859c50fE728c',
            },
            MAKER_DAO: {
                DAI_TOKEN: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
            }
        },
    }
}

export function getDeployedTempleGoldContracts(): ContractAddresses {
    if (TEMPLEGOLD_DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return TEMPLEGOLD_DEPLOYED_CONTRACTS[network.name];
    }
}

export interface ContractInstances {
    TEMPLE_GOLD: {
        TEMPLE_GOLD: TempleGold,
        TEMPLE_GOLD_ADMIN: TempleGoldAdmin,
        TEMPLE_GOLD_STAKING: TempleGoldStaking,
        TEMPLE_TELEPORTER: TempleTeleporter,
        SPICE_AUCTION: SpiceAuction,
        SPICE_AUCTION_FACTORY: SpiceAuctionFactory,
        DAI_GOLD_AUCTION: DaiGoldAuction,
    },
    CORE: {
        TEMPLE_TOKEN: TempleERC20Token
    },
    EXTERNAL: {
        MAKER_DAO: {
            DAI_TOKEN: FakeERC20,
        },
    },
}

export function connectToContracts(owner: Signer): ContractInstances {
    const TEMPLE_GOLD_ADDRESSES = getDeployedTempleGoldContracts();

    return {
        TEMPLE_GOLD: {
            TEMPLE_GOLD: TempleGold__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD, owner),
            TEMPLE_GOLD_ADMIN: TempleGoldAdmin__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_ADMIN, owner),
            TEMPLE_GOLD_STAKING: TempleGoldStaking__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, owner),
            SPICE_AUCTION: SpiceAuction__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION, owner),
            SPICE_AUCTION_FACTORY: SpiceAuctionFactory__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY, owner),
            DAI_GOLD_AUCTION: DaiGoldAuction__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.DAI_GOLD_AUCTION, owner),
            TEMPLE_TELEPORTER: TempleTeleporter__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_TELEPORTER, owner),
        },
        CORE: {
            TEMPLE_TOKEN: TempleERC20Token__factory.connect(TEMPLE_GOLD_ADDRESSES.CORE.TEMPLE_TOKEN, owner),
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: FakeERC20__factory.connect(TEMPLE_GOLD_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, owner),
            },
        }
    }
}